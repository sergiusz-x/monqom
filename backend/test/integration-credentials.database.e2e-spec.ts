import { HttpException } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { randomUUID } from 'crypto'
import { AuditService } from '../src/shared/audit/audit.service'
import { IntegrationCredentialService } from '../src/modules/integrations/integration-credential.service'
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
            await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds.splice(0) } } })
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
