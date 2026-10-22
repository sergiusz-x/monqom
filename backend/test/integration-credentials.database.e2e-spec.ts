import { HttpException } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { randomUUID } from 'crypto'
import { AuditService } from '../src/shared/audit/audit.service'
import { IntegrationCredentialService } from '../src/modules/integrations/integration-credential.service'
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common'
import {
    IntegrationRateLimitExceededError,
    IntegrationRateLimitService,
} from '../src/modules/integrations/integration-rate-limit.service'

const databaseUrl = process.env.INTEGRATION_TEST_DATABASE_URL
if (!databaseUrl) {
    throw new Error(
        'INTEGRATION_TEST_DATABASE_URL must point to a disposable PostgreSQL test database',
    )
}
const databaseName = new URL(databaseUrl).pathname.slice(1)
if (!/(^|[_-])test([_-]|$)/i.test(databaseName)) {
    throw new Error('Database integration tests require a database name containing a test segment')
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
const credentialService = new IntegrationCredentialService(
    prisma as never,
    new AuditService(prisma as never),
)
describe('integration credential PostgreSQL lifecycle', () => {
    const workspaceIds: string[] = []
    const userIds: string[] = []

    beforeAll(async () => prisma.$connect())

    afterEach(async () => {
        await prisma.integrationRateLimit.deleteMany()
        if (workspaceIds.length) {
            const workspaces = workspaceIds.splice(0)
            await prisma.transaction.deleteMany({ where: { workspaceId: { in: workspaces } } })
            await prisma.integrationCredential.deleteMany({
                where: { integration: { workspaceId: { in: workspaces } } },
            })
            await prisma.workspace.deleteMany({ where: { id: { in: workspaces } } })
        }
        if (userIds.length) {
            await prisma.user.deleteMany({ where: { id: { in: userIds.splice(0) } } })
        }
    })

    afterAll(async () => prisma.$disconnect())

    it('revokes on creator demotion and account deletion, preserving integration attribution', async () => {
        const creator = await createUser('creator')
        const first = await createWorkspace(creator.id)
        const second = await createWorkspace(creator.id)
        const firstIntegration = await credentialService.createIntegration({
            workspaceId: first.workspaceId,
            createdByUserId: creator.id,
            name: 'demotion lifecycle test',
        })
        const firstCredential = await credentialService.createCredential({
            integrationId: firstIntegration.id,
            expiresAt: expiryInDays(30),
            scopes: ['transactions:create'],
            categoryAllowlistEnabled: false,
            paymentSourceAllowlistEnabled: false,
        })
        const secondIntegration = await credentialService.createIntegration({
            workspaceId: second.workspaceId,
            createdByUserId: creator.id,
            name: 'account deletion lifecycle test',
        })
        const secondCredential = await credentialService.createCredential({
            integrationId: secondIntegration.id,
            expiresAt: expiryInDays(30),
            scopes: ['transactions:create'],
            categoryAllowlistEnabled: false,
            paymentSourceAllowlistEnabled: false,
        })

        await expect(
            credentialService.authenticateAuthorizationHeader(
                `Bearer ${firstCredential.token}`,
                '127.0.0.1',
            ),
        ).resolves.toMatchObject({ integrationId: firstIntegration.id })

        await prisma.workspaceMembership.update({
            where: { userId_workspaceId: { userId: creator.id, workspaceId: first.workspaceId } },
            data: { role: 'member' },
        })
        await expect(
            credentialService.authenticateAuthorizationHeader(
                `Bearer ${firstCredential.token}`,
                '127.0.0.1',
            ),
        ).rejects.toThrow('Integration authentication failed')
        await expect(
            prisma.integrationCredential.findUniqueOrThrow({
                where: { id: firstCredential.credentialId },
            }),
        ).resolves.toMatchObject({ status: 'revoked' })

        await prisma.user.delete({ where: { id: creator.id } })
        await expect(
            credentialService.authenticateAuthorizationHeader(
                `Bearer ${secondCredential.token}`,
                '127.0.0.1',
            ),
        ).rejects.toThrow('Integration authentication failed')
        const retainedIntegration = await prisma.integration.findUniqueOrThrow({
            where: { id: secondIntegration.id },
        })
        expect(retainedIntegration).toMatchObject({
            creatorReference: creator.id,
            createdByUserId: null,
        })
        await expect(
            prisma.integrationCredential.findUniqueOrThrow({
                where: { id: secondCredential.credentialId },
            }),
        ).resolves.toMatchObject({ status: 'revoked' })

        const revocationEvents = await prisma.auditEvent.findMany({
            where: {
                workspaceId: { in: [first.workspaceId, second.workspaceId] },
                action: 'INTEGRATION_CREDENTIAL_REVOKED',
            },
        })
        expect(
            revocationEvents.map(({ metadata }) => (metadata as { reason: string }).reason),
        ).toEqual(expect.arrayContaining(['CREATOR_AUTHORITY_LOST', 'CREATOR_ACCOUNT_DELETED']))
    })

    it('atomically issues policy, rotates as another admin, then revokes and safely hides the version', async () => {
        const creator = await createUser('management-creator')
        const actor = await createUser('management-admin')
        const workspace = await createWorkspace(creator.id)
        const source = await prisma.paymentSource.findFirstOrThrow({
            where: { workspaceId: workspace.workspaceId },
        })
        await prisma.workspaceMembership.create({
            data: {
                userId: actor.id,
                workspaceId: workspace.workspaceId,
                role: 'admin',
                lastPaymentSourceId: source.id,
            },
        })
        const category = await prisma.category.create({
            data: { workspaceId: workspace.workspaceId, name: 'integration test category' },
        })
        const original = await credentialService.createIntegrationWithCredential({
            workspaceId: workspace.workspaceId,
            createdByUserId: creator.id,
            name: 'atomic management lifecycle',
            expiresAt: expiryInDays(30),
            scopes: ['transactions:create'],
            categoryAllowlistEnabled: true,
            allowedCategoryIds: [category.id],
            paymentSourceAllowlistEnabled: true,
            allowedPaymentSourceIds: [source.id],
            cidrAllowlistEnabled: false,
        })
        const transaction = await prisma.transaction.create({
            data: {
                workspaceId: workspace.workspaceId,
                integrationId: original.integrationId,
                externalId: 'record-1',
                categoryId: category.id,
                paymentSourceId: source.id,
                amount: 1234,
                currency: 'PLN',
                date: new Date('2026-10-17T00:00:00.000Z'),
                description: 'Owned import',
            },
        })

        expect(original.token).toMatch(/^mqic_[A-Za-z0-9_-]{12}\.[A-Za-z0-9_-]{43}$/)
        expect(original.tokenPrefix).toBe(original.token.slice(0, original.token.indexOf('.')))
        await expect(
            prisma.integrationCredential.findUniqueOrThrow({
                where: { id: original.credentialId },
            }),
        ).resolves.toMatchObject({ tokenDigest: expect.not.stringContaining(original.token) })
        await expect(
            credentialService.authenticateAuthorizationHeader(
                `Bearer ${original.token}`,
                '127.0.0.1',
            ),
        ).resolves.toMatchObject({ integrationId: original.integrationId })

        const rotated = await credentialService.rotateCredential(
            original.credentialId,
            expiryInDays(60),
            new Date(),
            actor.id,
            { workspaceId: workspace.workspaceId, integrationId: original.integrationId },
            {
                scopes: [],
                categoryAllowlistEnabled: true,
                allowedCategoryIds: [],
                paymentSourceAllowlistEnabled: false,
                allowedPaymentSourceIds: [],
            },
        )
        await expect(
            credentialService.authenticateAuthorizationHeader(
                `Bearer ${original.token}`,
                '127.0.0.1',
            ),
        ).rejects.toThrow('Integration authentication failed')
        await expect(
            credentialService.authenticateAuthorizationHeader(
                `Bearer ${rotated.token}`,
                '127.0.0.1',
            ),
        ).resolves.toMatchObject({ integrationId: original.integrationId, scopes: [] })

        await expect(
            credentialService.revokeCredential(rotated.credentialId, new Date(), actor.id, {
                workspaceId: workspace.workspaceId,
                integrationId: original.integrationId,
            }),
        ).resolves.toBe(true)
        await expect(
            credentialService.revokeCredential(rotated.credentialId, new Date(), actor.id, {
                workspaceId: workspace.workspaceId,
                integrationId: original.integrationId,
            }),
        ).resolves.toBe(false)
        await expect(
            credentialService.authenticateAuthorizationHeader(
                `Bearer ${rotated.token}`,
                '127.0.0.1',
            ),
        ).rejects.toThrow('Integration authentication failed')

        await credentialService.deleteCredential(rotated.credentialId, actor.id, {
            workspaceId: workspace.workspaceId,
            integrationId: original.integrationId,
        })
        await expect(
            prisma.integrationCredential.findUniqueOrThrow({
                where: { id: rotated.credentialId },
            }),
        ).resolves.toMatchObject({ status: 'revoked', deletedAt: expect.any(Date) })
        await expect(
            prisma.integrationCredential.findUniqueOrThrow({
                where: { id: original.credentialId },
            }),
        ).resolves.toMatchObject({ status: 'revoked', deletedAt: null })
        await expect(
            prisma.integration.findUniqueOrThrow({
                where: { id: original.integrationId },
            }),
        ).resolves.toMatchObject({ status: 'active', creatorReference: creator.id })
        await expect(
            prisma.transaction.findUniqueOrThrow({
                where: { id: transaction.id },
            }),
        ).resolves.toMatchObject({ integrationId: original.integrationId, externalId: 'record-1' })

        const lifecycleEvents = await prisma.auditEvent.findMany({
            where: {
                workspaceId: workspace.workspaceId,
                entityId: { in: [original.credentialId, rotated.credentialId] },
            },
            orderBy: { createdAt: 'asc' },
        })
        expect(lifecycleEvents).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    action: 'INTEGRATION_CREDENTIAL_ROTATED',
                    userId: actor.id,
                    entityId: rotated.credentialId,
                    metadata: expect.objectContaining({ previous_credential_status: 'revoked' }),
                }),
                expect.objectContaining({
                    action: 'INTEGRATION_CREDENTIAL_DELETED',
                    userId: actor.id,
                }),
            ]),
        )
        expect(JSON.stringify(lifecycleEvents)).not.toContain(original.token)
        expect(JSON.stringify(lifecycleEvents)).not.toContain(rotated.token)
    }, 15_000)

    it('rejects archived and foreign workspace restrictions without creating partial integrations', async () => {
        const owner = await createUser('invalid-management-policy')
        const first = await createWorkspace(owner.id)
        const foreignOwner = await createUser('foreign-management-policy')
        const foreign = await createWorkspace(foreignOwner.id)
        const archivedCategory = await prisma.category.create({
            data: { workspaceId: first.workspaceId, name: 'archived management category' },
        })
        const foreignCategory = await prisma.category.create({
            data: { workspaceId: foreign.workspaceId, name: 'foreign management category' },
        })
        await prisma.category.update({
            where: { id: archivedCategory.id },
            data: { deletedAt: new Date() },
        })
        const existingIntegrations = await prisma.integration.count({
            where: { workspaceId: first.workspaceId },
        })
        const policy = {
            workspaceId: first.workspaceId,
            createdByUserId: owner.id,
            name: 'invalid policy must not persist',
            expiresAt: expiryInDays(30),
            scopes: ['transactions:create'],
            categoryAllowlistEnabled: true,
            paymentSourceAllowlistEnabled: false,
        }
        await expect(
            credentialService.createIntegrationWithCredential({
                ...policy,
                allowedCategoryIds: [archivedCategory.id],
            }),
        ).rejects.toBeInstanceOf(BadRequestException)
        await expect(
            credentialService.createIntegrationWithCredential({
                ...policy,
                allowedCategoryIds: [foreignCategory.id],
            }),
        ).rejects.toBeInstanceOf(BadRequestException)
        expect(await prisma.integration.count({ where: { workspaceId: first.workspaceId } })).toBe(
            existingIntegrations,
        )
        expect(
            await prisma.integrationCredential.count({
                where: { integration: { workspaceId: first.workspaceId } },
            }),
        ).toBe(0)
        expect(
            await prisma.auditEvent.count({
                where: { workspaceId: first.workspaceId, action: 'INTEGRATION_CREDENTIAL_ISSUED' },
            }),
        ).toBe(0)
    })

    it('rolls back integration and credential creation when a required audit write fails', async () => {
        const owner = await createUser('audit-rollback')
        const workspace = await createWorkspace(owner.id)
        const existingIntegrations = await prisma.integration.count({
            where: { workspaceId: workspace.workspaceId },
        })
        const existingAuditEvents = await prisma.auditEvent.count({
            where: { workspaceId: workspace.workspaceId },
        })
        const failingAudit = {
            record: jest.fn(async (event: { action: string }, tx: unknown) => {
                if (event.action === 'INTEGRATION_CREDENTIAL_ISSUED')
                    throw new Error('synthetic lifecycle audit failure')
                return new AuditService(prisma as never).record(event as never, tx as never)
            }),
        }
        const service = new IntegrationCredentialService(prisma as never, failingAudit as never)

        await expect(
            service.createIntegrationWithCredential({
                workspaceId: workspace.workspaceId,
                createdByUserId: owner.id,
                name: 'must roll back',
                expiresAt: expiryInDays(30),
                scopes: [],
                categoryAllowlistEnabled: false,
                paymentSourceAllowlistEnabled: false,
            }),
        ).rejects.toBeInstanceOf(ServiceUnavailableException)

        expect(
            await prisma.integration.count({ where: { workspaceId: workspace.workspaceId } }),
        ).toBe(existingIntegrations)
        expect(
            await prisma.integrationCredential.count({
                where: { integration: { workspaceId: workspace.workspaceId } },
            }),
        ).toBe(0)
        expect(
            await prisma.auditEvent.count({ where: { workspaceId: workspace.workspaceId } }),
        ).toBe(existingAuditEvents)
    })

    it('serializes simultaneous rotations to one active replacement under the same identity', async () => {
        const creator = await createUser('rotation')
        const workspace = await createWorkspace(creator.id)
        const integration = await credentialService.createIntegration({
            workspaceId: workspace.workspaceId,
            createdByUserId: creator.id,
            name: 'concurrent rotation test',
        })
        const original = await credentialService.createCredential({
            integrationId: integration.id,
            expiresAt: expiryInDays(30),
            scopes: ['transactions:create'],
            categoryAllowlistEnabled: false,
            paymentSourceAllowlistEnabled: false,
        })

        const now = new Date()
        const outcomes = await Promise.allSettled([
            credentialService.rotateCredential(
                original.credentialId,
                expiryInDays(45),
                now,
                creator.id,
            ),
            credentialService.rotateCredential(
                original.credentialId,
                expiryInDays(60),
                now,
                creator.id,
            ),
        ])
        const replacements = outcomes.filter(
            (
                outcome,
            ): outcome is PromiseFulfilledResult<
                Awaited<ReturnType<typeof credentialService.rotateCredential>>
            > => outcome.status === 'fulfilled',
        )
        const conflicts = outcomes.filter(
            (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
        )
        expect(replacements).toHaveLength(1)
        expect(conflicts).toHaveLength(1)
        expect(conflicts[0]?.reason).toBeInstanceOf(HttpException)
        expect((conflicts[0]?.reason as HttpException).getStatus()).toBe(409)

        const credentials = await prisma.integrationCredential.findMany({
            where: { integrationId: integration.id },
        })
        expect(credentials).toHaveLength(2)
        expect(credentials.filter(({ status }) => status === 'active')).toHaveLength(1)
        expect(credentials.every(({ integrationId }) => integrationId === integration.id)).toBe(
            true,
        )
        const rotationEvents = await prisma.auditEvent.count({
            where: {
                workspaceId: workspace.workspaceId,
                action: 'INTEGRATION_CREDENTIAL_ROTATED',
            },
        })
        expect(rotationEvents).toBe(1)
        await expect(
            credentialService.authenticateAuthorizationHeader(
                `Bearer ${replacements[0]!.value.token}`,
                '127.0.0.1',
            ),
        ).resolves.toMatchObject({ integrationId: integration.id })
    })

    it('serializes creator demotion against rotation and leaves no active credential', async () => {
        const creator = await createUser('demotion-race')
        const workspace = await createWorkspace(creator.id)
        const integration = await credentialService.createIntegration({
            workspaceId: workspace.workspaceId,
            createdByUserId: creator.id,
            name: 'demotion rotation race test',
        })
        const original = await credentialService.createCredential({
            integrationId: integration.id,
            expiresAt: expiryInDays(30),
            scopes: ['transactions:create'],
            categoryAllowlistEnabled: false,
            paymentSourceAllowlistEnabled: false,
        })

        const outcomes = await Promise.allSettled([
            credentialService.rotateCredential(
                original.credentialId,
                expiryInDays(45),
                new Date(),
                creator.id,
            ),
            prisma.workspaceMembership.update({
                where: {
                    userId_workspaceId: {
                        userId: creator.id,
                        workspaceId: workspace.workspaceId,
                    },
                },
                data: { role: 'member' },
            }),
        ])

        expect(outcomes[1]?.status).toBe('fulfilled')
        if (outcomes[0]?.status === 'rejected') {
            expect(outcomes[0].reason).toBeInstanceOf(HttpException)
            expect((outcomes[0].reason as HttpException).getStatus()).toBe(409)
        }
        const credentials = await prisma.integrationCredential.findMany({
            where: { integrationId: integration.id },
        })
        expect(credentials.length).toBeGreaterThanOrEqual(1)
        expect(credentials.filter(({ status }) => status === 'active')).toHaveLength(0)
        expect(
            await prisma.auditEvent.count({
                where: {
                    workspaceId: workspace.workspaceId,
                    action: 'INTEGRATION_CREDENTIAL_REVOKED',
                    metadata: { path: ['reason'], equals: 'CREATOR_AUTHORITY_LOST' },
                },
            }),
        ).toBeGreaterThanOrEqual(1)
    }, 15_000)

    it('linearizes explicit revoke against rotation of the same credential', async () => {
        const creator = await createUser('revoke-race')
        const workspace = await createWorkspace(creator.id)
        const integration = await credentialService.createIntegration({
            workspaceId: workspace.workspaceId,
            createdByUserId: creator.id,
            name: 'revoke rotation race test',
        })
        const original = await credentialService.createCredential({
            integrationId: integration.id,
            expiresAt: expiryInDays(30),
            scopes: ['transactions:create'],
            categoryAllowlistEnabled: false,
            paymentSourceAllowlistEnabled: false,
        })

        const outcomes = await Promise.allSettled([
            credentialService.rotateCredential(
                original.credentialId,
                expiryInDays(45),
                new Date(),
                creator.id,
            ),
            credentialService.revokeCredential(original.credentialId, new Date(), creator.id),
        ])

        expect(outcomes[1]?.status).toBe('fulfilled')
        const credentials = await prisma.integrationCredential.findMany({
            where: { integrationId: integration.id },
        })
        expect(credentials.find(({ id }) => id === original.credentialId)?.status).toBe('revoked')
        const active = credentials.filter(({ status }) => status === 'active')
        if (outcomes[0]?.status === 'fulfilled') {
            expect(outcomes[1]).toMatchObject({ status: 'fulfilled', value: false })
            expect(active.map(({ id }) => id)).toEqual([outcomes[0].value.credentialId])
        } else {
            expect(outcomes[0].reason).toBeInstanceOf(HttpException)
            expect((outcomes[0].reason as HttpException).getStatus()).toBe(409)
            expect(outcomes[1]).toMatchObject({ status: 'fulfilled', value: true })
            expect(active).toHaveLength(0)
        }
    }, 15_000)

    it('revokes a replacement when creator membership is removed during rotation', async () => {
        const creator = await createUser('removal-race')
        const workspace = await createWorkspace(creator.id)
        const integration = await credentialService.createIntegration({
            workspaceId: workspace.workspaceId,
            createdByUserId: creator.id,
            name: 'membership removal race test',
        })
        const original = await credentialService.createCredential({
            integrationId: integration.id,
            expiresAt: expiryInDays(30),
            scopes: ['transactions:create'],
            categoryAllowlistEnabled: false,
            paymentSourceAllowlistEnabled: false,
        })

        const outcomes = await Promise.allSettled([
            credentialService.rotateCredential(
                original.credentialId,
                expiryInDays(45),
                new Date(),
                creator.id,
            ),
            prisma.workspaceMembership.delete({
                where: {
                    userId_workspaceId: {
                        userId: creator.id,
                        workspaceId: workspace.workspaceId,
                    },
                },
            }),
        ])

        expect(outcomes[1]?.status).toBe('fulfilled')
        if (outcomes[0]?.status === 'rejected') {
            expect(outcomes[0].reason).toBeInstanceOf(HttpException)
            expect((outcomes[0].reason as HttpException).getStatus()).toBe(409)
        }
        const credentials = await prisma.integrationCredential.findMany({
            where: { integrationId: integration.id },
        })
        expect(credentials.filter(({ status }) => status === 'active')).toHaveLength(0)
        expect(
            await prisma.auditEvent.count({
                where: {
                    workspaceId: workspace.workspaceId,
                    action: 'INTEGRATION_CREDENTIAL_REVOKED',
                    metadata: { path: ['reason'], equals: 'CREATOR_REMOVED' },
                },
            }),
        ).toBeGreaterThanOrEqual(1)
    }, 15_000)

    it('preserves attribution and leaves no active credential when account deletion races rotation', async () => {
        const creator = await createUser('account-race')
        const workspace = await createWorkspace(creator.id)
        const integration = await credentialService.createIntegration({
            workspaceId: workspace.workspaceId,
            createdByUserId: creator.id,
            name: 'account deletion rotation race test',
        })
        const original = await credentialService.createCredential({
            integrationId: integration.id,
            expiresAt: expiryInDays(30),
            scopes: ['transactions:create'],
            categoryAllowlistEnabled: false,
            paymentSourceAllowlistEnabled: false,
        })

        const outcomes = await Promise.allSettled([
            credentialService.rotateCredential(
                original.credentialId,
                expiryInDays(45),
                new Date(),
                creator.id,
            ),
            prisma.user.delete({ where: { id: creator.id } }),
        ])

        expect(outcomes[1]?.status).toBe('fulfilled')
        if (outcomes[0]?.status === 'rejected') {
            expect(outcomes[0].reason).toBeInstanceOf(HttpException)
            expect((outcomes[0].reason as HttpException).getStatus()).toBe(409)
        }
        const retainedIntegration = await prisma.integration.findUniqueOrThrow({
            where: { id: integration.id },
        })
        expect(retainedIntegration).toMatchObject({
            creatorReference: creator.id,
            createdByUserId: null,
        })
        const credentials = await prisma.integrationCredential.findMany({
            where: { integrationId: integration.id },
        })
        expect(credentials.filter(({ status }) => status === 'active')).toHaveLength(0)
        expect(
            await prisma.auditEvent.count({
                where: {
                    workspaceId: workspace.workspaceId,
                    action: 'INTEGRATION_CREDENTIAL_REVOKED',
                    metadata: { path: ['reason'], equals: 'CREATOR_ACCOUNT_DELETED' },
                },
            }),
        ).toBeGreaterThanOrEqual(1)
    }, 15_000)

    it('shares management step-up budgets across users and independent limiter instances', async () => {
        const firstLimiter = new IntegrationRateLimitService(prisma as never)
        const secondLimiter = new IntegrationRateLimitService(prisma as never)

        for (let attempt = 0; attempt < 5; attempt++) {
            await firstLimiter.consumeManagementStepUp(
                'shared-management-user',
                `198.51.100.${attempt + 1}`,
            )
        }
        await expect(
            secondLimiter.consumeManagementStepUp('shared-management-user', '203.0.113.10'),
        ).rejects.toBeInstanceOf(IntegrationRateLimitExceededError)

        for (let attempt = 0; attempt < 20; attempt++) {
            await firstLimiter.consumeManagementStepUp(
                `source-management-user-${attempt}`,
                '::ffff:192.0.2.55',
            )
        }
        await expect(
            secondLimiter.consumeManagementStepUp('another-source-user', '192.0.2.55'),
        ).rejects.toBeInstanceOf(IntegrationRateLimitExceededError)
    }, 15_000)

    it('serializes shared request and mutation budgets across concurrent PostgreSQL transactions', async () => {
        const rateLimits = new IntegrationRateLimitService(prisma as never)
        const now = new Date()
        for (let index = 0; index < 59; index++) {
            await rateLimits.consumeCredential(
                'rate-limit-concurrency',
                now,
                true,
                'test-workspace',
            )
        }

        const outcomes = await Promise.allSettled([
            rateLimits.consumeCredential('rate-limit-concurrency', now, true, 'test-workspace'),
            rateLimits.consumeCredential('rate-limit-concurrency', now, true, 'test-workspace'),
        ])
        expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1)
        const rejected = outcomes.filter(
            (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
        )
        expect(rejected).toHaveLength(1)
        expect(rejected[0]?.reason).toBeInstanceOf(IntegrationRateLimitExceededError)

        const rows = await prisma.integrationRateLimit.findMany()
        expect(rows).toHaveLength(1)
        expect(rows[0]?.requestTimes).toHaveLength(61)
        expect(rows[0]?.mutationTimes).toHaveLength(60)
    }, 15_000)

    async function createUser(label: string) {
        const user = await prisma.user.create({
            data: {
                email: `${label}-${randomUUID()}@integration-test.invalid`,
                name: `Integration ${label} test`,
                passwordHash: 'test-only-not-a-real-password-hash',
            },
        })
        userIds.push(user.id)
        return user
    }

    async function createWorkspace(userId: string) {
        const workspace = await prisma.workspace.create({
            data: { name: 'integration lifecycle test' },
        })
        workspaceIds.push(workspace.id)
        const paymentSource = await prisma.paymentSource.create({
            data: { workspaceId: workspace.id, name: 'test cash', type: 'cash' },
        })
        await prisma.workspaceMembership.create({
            data: {
                userId,
                workspaceId: workspace.id,
                role: 'admin',
                lastPaymentSourceId: paymentSource.id,
            },
        })
        return { workspaceId: workspace.id }
    }

    function expiryInDays(days: number): Date {
        return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    }
})
