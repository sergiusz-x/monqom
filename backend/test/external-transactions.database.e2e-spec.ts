import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
    PreconditionFailedException,
} from '@nestjs/common'
import { Prisma, PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { randomUUID } from 'crypto'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { Client } from 'pg'
import { AuditService } from '../src/shared/audit/audit.service'
import { CurrencyService } from '../src/shared/currency/currency.service'
import { TransactionsRepository } from '../src/modules/transactions/transactions.repository'
import { DashboardRepository } from '../src/modules/dashboard/dashboard.repository'
import { BudgetsRepository } from '../src/modules/budgets/budgets.repository'
import {
    IntegrationCredentialService,
    MachinePrincipal,
} from '../src/modules/integrations/integration-credential.service'
import {
    ExternalTransactionCreateCommand,
    ExternalTransactionOwnershipService,
    fingerprintExternalTransactionCreate,
    digestIdempotencyKey,
    IDEMPOTENCY_RETENTION_MS,
    IdempotencyInProgressException,
} from '../src/modules/integrations/external-transaction-ownership.service'

const databaseUrl = process.env.INTEGRATION_TEST_DATABASE_URL
if (!databaseUrl || !/(^|[_-])test([_-]|$)/i.test(new URL(databaseUrl).pathname.slice(1))) {
    throw new Error(
        'INTEGRATION_TEST_DATABASE_URL must point to a disposable PostgreSQL test database',
    )
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
const otherPrisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
const audit = new AuditService(prisma as never)
const repository = new TransactionsRepository(prisma as never, audit)
const currency = new CurrencyService()
const service = new ExternalTransactionOwnershipService(
    prisma as never,
    repository,
    audit,
    currency,
)
const otherService = new ExternalTransactionOwnershipService(
    otherPrisma as never,
    new TransactionsRepository(otherPrisma as never, new AuditService(otherPrisma as never)),
    new AuditService(otherPrisma as never),
    currency,
)
const credentials = new IntegrationCredentialService(prisma as never, audit)
const scopes = [
    'transactions:create',
    'transactions:read-own',
    'transactions:update-own',
    'transactions:delete-own',
] as const
const date = new Date('2026-09-04')

describe('external transaction PostgreSQL reconciliation', () => {
    let workspaceId: string
    let userId: string
    let principal: MachinePrincipal
    let token: string
    let command: ExternalTransactionCreateCommand

    beforeAll(async () => {
        await prisma.$connect()
        await otherPrisma.$connect()
    })
    beforeEach(async () => {
        const user = await prisma.user.create({
            data: {
                email: `${randomUUID()}@reconciliation-test.invalid`,
                name: 'Synthetic test',
                passwordHash: 'synthetic-test-only',
            },
        })
        userId = user.id
        const workspace = await prisma.workspace.create({
            data: { name: 'Reconciliation test', baseCurrency: 'PLN' },
        })
        workspaceId = workspace.id
        const source = await prisma.paymentSource.create({
            data: { workspaceId, name: 'Test source', type: 'cash' },
        })
        const category = await prisma.category.create({
            data: { workspaceId, name: 'Test category', type: 'expense' },
        })
        await prisma.workspaceMembership.create({
            data: { userId, workspaceId, role: 'admin', lastPaymentSourceId: source.id },
        })
        const issued = await credentials.createIntegrationWithCredential({
            workspaceId,
            createdByUserId: userId,
            name: 'Test importer',
            expiresAt: new Date(Date.now() + 86_400_000),
            scopes,
            categoryAllowlistEnabled: false,
            paymentSourceAllowlistEnabled: false,
        })
        token = issued.token
        principal = await credentials.authenticateAuthorizationHeader(
            `Bearer ${token}`,
            '127.0.0.1',
        )
        command = {
            externalId: 'account-a:record-1',
            type: 'expense',
            amount: 1234,
            currency: 'PLN',
            date,
            description: 'Synthetic purchase',
            notes: null,
            tags: ['Food', 'daily', ' food '],
            categoryId: category.id,
            paymentSourceId: source.id,
        }
    })
    afterEach(async () => {
        jest.restoreAllMocks()
        await prisma.transaction.deleteMany({ where: { workspaceId } })
        await prisma.workspace.delete({ where: { id: workspaceId } })
        await prisma.user.delete({ where: { id: userId } })
    })
    afterAll(async () => {
        await prisma.$disconnect()
        await otherPrisma.$disconnect()
    })

    it('commits integer money, tags, machine audit and the original replay result atomically', async () => {
        const key = randomUUID()
        const before = Date.now()
        const created = await service.createIdempotently(principal, key, command)
        expect(created).toMatchObject({
            responseStatus: 201,
            replayed: false,
            etag: '"tx-v1"',
            transaction: {
                amount: 1234,
                baseAmount: 1234,
                integrationId: principal.integrationId,
                version: 1,
            },
        })
        expect(created.transaction?.tags.map((tag) => tag.name).sort()).toEqual(['Food', 'daily'])
        const record = await prisma.integrationIdempotencyRecord.findFirstOrThrow({
            where: { integrationId: principal.integrationId },
        })
        expect(record).toMatchObject({
            status: 'completed',
            workspaceId,
            responseStatus: 201,
            responseEtag: '"tx-v1"',
            targetTransactionId: created.transaction?.id,
            leaseExpiresAt: null,
        })
        expect(record.completedAt!.getTime()).toBeGreaterThanOrEqual(before)
        expect(record.expiresAt.getTime() - record.completedAt!.getTime()).toBe(
            IDEMPOTENCY_RETENTION_MS,
        )
        expect(record.keyDigest).not.toContain(key)
        const events = await prisma.auditEvent.findMany({
            where: { workspaceId, action: 'TRANSACTION_CREATED' },
        })
        expect(events).toHaveLength(1)
        expect(events[0]).toMatchObject({
            userId: null,
            metadata: {
                integration_id: principal.integrationId,
                credential_id: principal.credentialId,
            },
        })
        expect(JSON.stringify(events)).not.toContain(key)
        const replay = await service.createIdempotently(principal, ` ${key} `, {
            ...command,
            tags: ['daily', 'Food'],
        })
        expect(replay).toEqual({ ...created, replayed: true })
        expect(
            await prisma.auditEvent.count({
                where: { workspaceId, action: 'TRANSACTION_CREATED' },
            }),
        ).toBe(1)
    })

    it('serializes identical requests across independent clients into one effect and result', async () => {
        const key = randomUUID()
        const results = await Promise.all(
            Array.from({ length: 8 }, (_, i) =>
                (i % 2 ? service : otherService).createIdempotently(principal, key, command),
            ),
        )
        expect(results.filter((result) => !result.replayed)).toHaveLength(1)
        expect(new Set(results.map((result) => result.transaction!.id)).size).toBe(1)
        expect(
            results.every((result) => result.responseStatus === 201 && result.etag === '"tx-v1"'),
        ).toBe(true)
        expect(await prisma.transaction.count({ where: { workspaceId } })).toBe(1)
        expect(
            await prisma.integrationIdempotencyRecord.count({
                where: { integrationId: principal.integrationId },
            }),
        ).toBe(1)
    }, 15_000)

    it('acknowledges concurrent duplicate external IDs without a request key', async () => {
        const results = await Promise.all([
            service.createIdempotently(principal, undefined, command),
            otherService.createIdempotently(principal, undefined, { ...command, amount: 999 }),
        ])
        expect(results.map((result) => result.responseStatus).sort()).toEqual([200, 201])
        expect(results.find((result) => result.responseStatus === 200)).toEqual({
            alreadyExists: { status: 'already_exists', external_id: command.externalId },
            responseStatus: 200,
            replayed: false,
        })
        expect(await prisma.transaction.count({ where: { workspaceId } })).toBe(1)
        expect(
            await prisma.integrationIdempotencyRecord.count({
                where: { integrationId: principal.integrationId },
            }),
        ).toBe(0)
    })

    it('acknowledges a database uniqueness race from a writer outside the command service', async () => {
        const original = repository.createTransactionWithTags.bind(repository)
        const otherRepository = new TransactionsRepository(
            otherPrisma as never,
            new AuditService(otherPrisma as never),
        )
        jest.spyOn(repository, 'createTransactionWithTags').mockImplementationOnce(
            async (input, tx) => {
                await otherRepository.createTransactionWithTags(input)
                return original(input, tx)
            },
        )
        await expect(
            service.createIdempotently(principal, randomUUID(), command),
        ).resolves.toMatchObject({
            responseStatus: 200,
            alreadyExists: { status: 'already_exists' },
        })
        expect(await prisma.transaction.count({ where: { workspaceId } })).toBe(1)
        expect(
            await prisma.auditEvent.count({
                where: { workspaceId, action: 'TRANSACTION_CREATED' },
            }),
        ).toBe(1)
    })

    it('keeps identical purchases distinct with different or omitted source IDs', async () => {
        for (const externalId of ['first', 'second', null, null])
            await service.createIdempotently(principal, undefined, { ...command, externalId })
        expect(await prisma.transaction.count({ where: { workspaceId } })).toBe(4)
        expect(await prisma.transaction.count({ where: { workspaceId, externalId: null } })).toBe(2)
    })

    it('preserves human edits and tombstones when an existing source ID is submitted again', async () => {
        const created = await service.createIdempotently(principal, undefined, command)
        await repository.updateTransactionWithTags({
            ...command,
            externalId: undefined,
            categoryId: command.categoryId!,
            workspaceId,
            transactionId: created.transaction!.id,
            userId,
            amount: 9999,
            description: 'Human edit',
            tags: ['manual'],
        })
        const before = await prisma.transaction.findUniqueOrThrow({
            where: { id: created.transaction!.id },
        })
        const acknowledgement = await service.createIdempotently(principal, randomUUID(), {
            ...command,
            amount: 1,
        })
        expect(acknowledgement).toEqual({
            alreadyExists: { status: 'already_exists', external_id: command.externalId },
            responseStatus: 200,
            replayed: false,
        })
        const replayKey = randomUUID()
        await service.createIdempotently(principal, replayKey, command)
        await prisma.transaction.update({
            where: { id: before.id },
            data: { deletedAt: new Date() },
        })
        const repeated = await service.createIdempotently(principal, replayKey, command)
        expect(repeated).toEqual({ ...acknowledgement, replayed: true })
        const final = await prisma.transaction.findUniqueOrThrow({ where: { id: before.id } })
        expect(final).toMatchObject({
            amount: 9999,
            description: 'Human edit',
            version: before.version + 1,
        })
        expect(final.deletedAt).not.toBeNull()
    })

    it('replays before FX resolution and stale preconditions, retaining the original representation', async () => {
        const key = randomUUID()
        const created = await service.createIdempotently(principal, key, command)
        const updateKey = randomUUID()
        const changed = await service.updateIdempotently(principal, updateKey, 1, {
            ...command,
            amount: 5678,
        })
        const quote = jest
            .spyOn(currency, 'getHistoricalQuote')
            .mockRejectedValue(new Error('Synthetic provider outage'))
        expect(
            await service.createIdempotently(principal, key, {
                ...command,
                fxRate: 999,
                baseAmount: 999,
            }),
        ).toEqual({ ...created, replayed: true })
        expect(
            await service.updateIdempotently(principal, updateKey, 1, { ...command, amount: 5678 }),
        ).toEqual({ ...changed, replayed: true })
        expect(quote).not.toHaveBeenCalled()
        expect(
            (await prisma.transaction.findUniqueOrThrow({ where: { id: created.transaction!.id } }))
                .amount,
        ).toBe(5678)
    })

    it('conflicts on changed body, operation, target or precondition without mutation', async () => {
        const key = randomUUID()
        await service.createIdempotently(principal, key, command)
        await expect(
            service.createIdempotently(principal, key, { ...command, amount: 1 }),
        ).rejects.toBeInstanceOf(ConflictException)
        await expect(
            service.createIdempotently(principal, key, { ...command, externalId: 'different' }),
        ).rejects.toBeInstanceOf(ConflictException)
        await expect(service.updateIdempotently(principal, key, 1, command)).rejects.toBeInstanceOf(
            ConflictException,
        )
        await expect(
            service.deleteIdempotently(principal, key, command.externalId!, 1),
        ).rejects.toBeInstanceOf(ConflictException)
        const updateKey = randomUUID()
        await service.updateIdempotently(principal, updateKey, 1, command)
        await expect(
            service.updateIdempotently(principal, updateKey, 2, command),
        ).rejects.toBeInstanceOf(ConflictException)
        expect(await prisma.transaction.count({ where: { workspaceId } })).toBe(1)
    })

    it('soft deletes once and replays delete successfully while keeping source identity reserved', async () => {
        const created = await service.createIdempotently(principal, undefined, command)
        const key = randomUUID()
        expect(await service.deleteIdempotently(principal, key, command.externalId!, 1)).toEqual({
            responseStatus: 204,
            replayed: false,
        })
        expect(await service.deleteIdempotently(principal, key, command.externalId!, 1)).toEqual({
            responseStatus: 204,
            replayed: true,
        })
        expect(
            await prisma.auditEvent.count({
                where: { workspaceId, action: 'TRANSACTION_DELETED' },
            }),
        ).toBe(1)
        expect(
            await prisma.transaction.findUniqueOrThrow({ where: { id: created.transaction!.id } }),
        ).toMatchObject({
            version: 2,
            externalId: command.externalId,
            integrationId: principal.integrationId,
            deletedAt: expect.any(Date),
        })
        await expect(
            service.findOwnedTransaction(principal, command.externalId!),
        ).rejects.toBeInstanceOf(NotFoundException)
        await expect(
            service.createIdempotently(principal, undefined, command),
        ).resolves.toMatchObject({
            responseStatus: 200,
            alreadyExists: { status: 'already_exists' },
        })
    })

    it('invalidates machine preconditions after a session edit and session soft delete', async () => {
        const created = await service.createIdempotently(principal, undefined, command)
        const edited = await repository.updateTransactionWithTags({
            ...command,
            externalId: undefined,
            categoryId: command.categoryId!,
            workspaceId,
            transactionId: created.transaction!.id,
            userId,
            tags: ['edited'],
        })
        expect(edited?.version).toBe(2)
        await expect(
            service.updateIdempotently(principal, randomUUID(), 1, command),
        ).rejects.toBeInstanceOf(PreconditionFailedException)
        await expect(
            service.deleteIdempotently(principal, randomUUID(), command.externalId!, 1),
        ).rejects.toBeInstanceOf(PreconditionFailedException)
        await repository.softDeleteTransaction({
            workspaceId,
            transactionId: edited!.id,
            userId,
            deletedAt: new Date(),
            transaction: edited!,
        })
        expect(
            (await prisma.transaction.findUniqueOrThrow({ where: { id: edited!.id } })).version,
        ).toBe(3)
    })

    it('permits only one competing replacement with the same version', async () => {
        await service.createIdempotently(principal, undefined, command)
        const outcomes = await Promise.allSettled([
            service.updateIdempotently(principal, randomUUID(), 1, { ...command, amount: 100 }),
            otherService.updateIdempotently(principal, randomUUID(), 1, {
                ...command,
                amount: 200,
            }),
        ])
        expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
        const failure = outcomes.find(
            (result) => result.status === 'rejected',
        ) as PromiseRejectedResult
        expect(failure.reason).toBeInstanceOf(PreconditionFailedException)
        expect(
            await prisma.integrationIdempotencyRecord.count({
                where: { integrationId: principal.integrationId },
            }),
        ).toBe(1)
    })

    it('enforces integration and workspace ownership without exposing manual or foreign targets', async () => {
        await service.createIdempotently(principal, undefined, command)
        const other = await credentials.createIntegrationWithCredential({
            workspaceId,
            createdByUserId: userId,
            name: 'Second integration',
            expiresAt: new Date(Date.now() + 86_400_000),
            scopes,
            categoryAllowlistEnabled: false,
            paymentSourceAllowlistEnabled: false,
        })
        const foreign = await credentials.authenticateAuthorizationHeader(
            `Bearer ${other.token}`,
            '127.0.0.1',
        )
        for (const actor of [foreign, { ...principal, workspaceId: randomUUID() }]) {
            await expect(
                service.findOwnedTransaction(actor, command.externalId!),
            ).rejects.toBeInstanceOf(NotFoundException)
            await expect(
                service.updateIdempotently(actor, randomUUID(), 1, command),
            ).rejects.toBeInstanceOf(NotFoundException)
            await expect(
                service.deleteIdempotently(actor, randomUUID(), command.externalId!, 1),
            ).rejects.toBeInstanceOf(NotFoundException)
        }
        const manual = await repository.createTransactionWithTags({
            ...command,
            externalId: undefined,
            integrationId: undefined,
            categoryId: command.categoryId!,
            workspaceId,
            userId,
        })
        for (const id of [manual.id, 'missing']) {
            await expect(service.findOwnedTransaction(principal, id)).rejects.toBeInstanceOf(
                NotFoundException,
            )
            await expect(
                service.updateIdempotently(principal, randomUUID(), 1, {
                    ...command,
                    externalId: id,
                }),
            ).rejects.toBeInstanceOf(NotFoundException)
            await expect(
                service.deleteIdempotently(principal, randomUUID(), id, 1),
            ).rejects.toBeInstanceOf(NotFoundException)
        }
        await expect(
            service.createIdempotently(foreign, undefined, command),
        ).resolves.toMatchObject({ responseStatus: 201 })
    })

    it('retains owned access and retry results after real credential rotation', async () => {
        const key = randomUUID()
        const created = await service.createIdempotently(principal, key, command)
        const rotated = await credentials.rotateCredential(
            principal.credentialId,
            new Date(Date.now() + 86_400_000),
        )
        await expect(
            credentials.authenticateAuthorizationHeader(`Bearer ${token}`, '127.0.0.1'),
        ).rejects.toThrow('Integration authentication failed')
        const replacement = await credentials.authenticateAuthorizationHeader(
            `Bearer ${rotated.token}`,
            '127.0.0.1',
        )
        expect(replacement.integrationId).toBe(principal.integrationId)
        expect(replacement.credentialId).not.toBe(principal.credentialId)
        expect((await service.findOwnedTransaction(replacement, command.externalId!)).id).toBe(
            created.transaction!.id,
        )
        expect(await service.createIdempotently(replacement, key, command)).toEqual({
            ...created,
            replayed: true,
        })
        await expect(
            service.updateIdempotently(replacement, randomUUID(), 1, command),
        ).resolves.toMatchObject({ transaction: { id: created.transaction!.id, version: 2 } })
    })

    it('applies stored and proposed restrictions to read, update, delete, and all replays', async () => {
        const key = randomUUID()
        await service.createIdempotently(principal, key, command)
        const otherCategory = await prisma.category.create({
            data: { workspaceId, name: 'Excluded category', type: 'expense' },
        })
        const restricted: MachinePrincipal = {
            ...principal,
            categoryAllowlistEnabled: true,
            allowedCategoryIds: [otherCategory.id],
        }
        await expect(
            service.findOwnedTransaction(restricted, command.externalId!),
        ).rejects.toBeInstanceOf(NotFoundException)
        await expect(
            service.deleteIdempotently(restricted, randomUUID(), command.externalId!, 1),
        ).rejects.toBeInstanceOf(NotFoundException)
        await expect(
            service.updateIdempotently(restricted, randomUUID(), 1, {
                ...command,
                categoryId: otherCategory.id,
            }),
        ).rejects.toBeInstanceOf(NotFoundException)
        await expect(service.createIdempotently(restricted, key, command)).rejects.toBeInstanceOf(
            NotFoundException,
        )
        await prisma.transaction.updateMany({
            where: { workspaceId },
            data: { categoryId: otherCategory.id },
        })
        // Current target is allowed, but the old response would disclose an excluded category.
        await expect(service.createIdempotently(restricted, key, command)).rejects.toBeInstanceOf(
            NotFoundException,
        )
        const allowed = {
            ...principal,
            categoryAllowlistEnabled: true,
            allowedCategoryIds: [otherCategory.id],
        }
        await expect(
            service.updateIdempotently(allowed, randomUUID(), 2, command),
        ).rejects.toBeInstanceOf(BadRequestException)
        const noSources = {
            ...principal,
            paymentSourceAllowlistEnabled: true,
            allowedPaymentSourceIds: [],
        }
        await expect(
            service.findOwnedTransaction(noSources, command.externalId!),
        ).rejects.toBeInstanceOf(NotFoundException)
        await expect(
            service.createIdempotently(noSources, undefined, { ...command, externalId: 'new' }),
        ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('makes narrower rotated credentials unable to replay or access excluded old records', async () => {
        const key = randomUUID()
        await service.createIdempotently(principal, key, command)
        const rotated = await credentials.rotateCredential(
            principal.credentialId,
            new Date(Date.now() + 86_400_000),
            new Date(),
            undefined,
            undefined,
            {
                categoryAllowlistEnabled: true,
                allowedCategoryIds: [],
                paymentSourceAllowlistEnabled: false,
            },
        )
        const narrower = await credentials.authenticateAuthorizationHeader(
            `Bearer ${rotated.token}`,
            '127.0.0.1',
        )
        await expect(
            service.findOwnedTransaction(narrower, command.externalId!),
        ).rejects.toBeInstanceOf(NotFoundException)
        await expect(service.createIdempotently(narrower, key, command)).rejects.toBeInstanceOf(
            NotFoundException,
        )
    })

    it.each(['category', 'paymentSource'] as const)(
        'rejects archived %s for creates, stored access and replay, leaving no success claim',
        async (resource) => {
            const key = randomUUID()
            await service.createIdempotently(principal, key, command)
            if (resource === 'category')
                await prisma.category.update({
                    where: { id: command.categoryId! },
                    data: { deletedAt: new Date() },
                })
            else
                await prisma.paymentSource.update({
                    where: { id: command.paymentSourceId },
                    data: { deletedAt: new Date() },
                })
            await expect(
                service.createIdempotently(principal, randomUUID(), {
                    ...command,
                    externalId: 'new',
                }),
            ).rejects.toBeInstanceOf(BadRequestException)
            await expect(
                service.findOwnedTransaction(principal, command.externalId!),
            ).rejects.toBeInstanceOf(NotFoundException)
            await expect(
                service.createIdempotently(principal, key, command),
            ).rejects.toBeInstanceOf(NotFoundException)
            await expect(
                service.deleteIdempotently(principal, randomUUID(), command.externalId!, 1),
            ).rejects.toBeInstanceOf(NotFoundException)
            expect(await prisma.transaction.count({ where: { workspaceId } })).toBe(1)
            expect(
                await prisma.integrationIdempotencyRecord.count({
                    where: { integrationId: principal.integrationId },
                }),
            ).toBe(1)
        },
    )

    it('allows uncategorized imports only for unrestricted category policies and includes them in totals', async () => {
        const noCategory = { ...command, categoryId: null }
        await expect(
            service.createIdempotently(
                { ...principal, categoryAllowlistEnabled: true, allowedCategoryIds: [] },
                randomUUID(),
                noCategory,
            ),
        ).rejects.toBeInstanceOf(BadRequestException)
        const created = await service.createIdempotently(principal, undefined, noCategory)
        expect(created.transaction?.categoryId).toBeNull()
        expect(
            (await repository.listTransactions({ workspaceId, limit: 20, offset: 0 }))[0]
                ?.category_id,
        ).toBeNull()
        const dashboard = new DashboardRepository(prisma as never)
        expect(
            await dashboard.getTotalSpendForRange(
                workspaceId,
                new Date('2026-09-01'),
                new Date('2026-10-01'),
            ),
        ).toBe(1234)
        expect(
            await dashboard.listCategorySpendForRange(
                workspaceId,
                new Date('2026-09-01'),
                new Date('2026-10-01'),
            ),
        ).toEqual([{ categoryId: null, amount: 1234 }])
        const budgets = new BudgetsRepository(prisma as never, audit)
        expect(
            await budgets.listTransactionSpendByCategory(
                workspaceId,
                new Date('2026-09-01'),
                new Date('2026-10-01'),
            ),
        ).toEqual([])
    })

    it('rolls back finance, tags, and claims after audit failure and permits a clean retry', async () => {
        const key = randomUUID()
        jest.spyOn(audit, 'record').mockRejectedValueOnce(new Error('Synthetic audit outage'))
        await expect(service.createIdempotently(principal, key, command)).rejects.toThrow(
            'Synthetic audit outage',
        )
        expect(await prisma.transaction.count({ where: { workspaceId } })).toBe(0)
        expect(await prisma.transactionTag.count({ where: { workspaceId } })).toBe(0)
        expect(
            await prisma.integrationIdempotencyRecord.count({
                where: { integrationId: principal.integrationId },
            }),
        ).toBe(0)
        await expect(service.createIdempotently(principal, key, command)).resolves.toMatchObject({
            responseStatus: 201,
        })
    })

    it('rolls back finance and audit if persisting the completed response fails', async () => {
        const failureName = `replay_failure_${randomUUID().replace(/-/g, '')}`
        await prisma.$executeRawUnsafe(`CREATE FUNCTION "${failureName}"() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN RAISE EXCEPTION 'Synthetic response storage failure'; END; $$`)
        await prisma.$executeRawUnsafe(`CREATE TRIGGER "${failureName}" BEFORE UPDATE ON integration_idempotency_records
            FOR EACH ROW WHEN (NEW.workspace_id = '${workspaceId}' AND NEW.status = 'completed') EXECUTE FUNCTION "${failureName}"()`)
        try {
            await expect(
                service.createIdempotently(principal, randomUUID(), command),
            ).rejects.toThrow('Synthetic response storage failure')
        } finally {
            await prisma.$executeRawUnsafe(
                `DROP TRIGGER "${failureName}" ON integration_idempotency_records`,
            )
            await prisma.$executeRawUnsafe(`DROP FUNCTION "${failureName}"()`)
        }
        expect(await prisma.transaction.count({ where: { workspaceId } })).toBe(0)
        expect(await prisma.transactionTag.count({ where: { workspaceId } })).toBe(0)
        expect(
            await prisma.auditEvent.count({
                where: { workspaceId, action: 'TRANSACTION_CREATED' },
            }),
        ).toBe(0)
        expect(
            await prisma.integrationIdempotencyRecord.count({
                where: { integrationId: principal.integrationId },
            }),
        ).toBe(0)
    })

    it('resolves authoritative FX only for a new effect and rolls back provider failures', async () => {
        const quote = jest
            .spyOn(currency, 'getHistoricalQuote')
            .mockResolvedValueOnce({ rate: 4.5, rateDate: date, source: 'ecb-frankfurter' })
        const foreignCurrency = { ...command, currency: 'EUR', baseAmount: 1, fxRate: 999 }
        const key = randomUUID()
        const result = await service.createIdempotently(principal, key, foreignCurrency)
        expect(quote).toHaveBeenCalledWith('EUR', 'PLN', date)
        expect(result.transaction).toMatchObject({
            amount: 1234,
            currency: 'EUR',
            baseAmount: 5553,
        })
        expect(result.transaction?.fxRate.toString()).toBe('4.5')
        quote.mockRejectedValue(new Error('Synthetic FX outage'))
        await expect(
            service.createIdempotently(principal, key, foreignCurrency),
        ).resolves.toMatchObject({ replayed: true })
        await expect(
            service.createIdempotently(principal, randomUUID(), {
                ...foreignCurrency,
                externalId: 'new-fx-record',
            }),
        ).rejects.toThrow('Synthetic FX outage')
        expect(await prisma.transaction.count({ where: { workspaceId } })).toBe(1)
        expect(
            await prisma.integrationIdempotencyRecord.count({
                where: { integrationId: principal.integrationId },
            }),
        ).toBe(1)
    })

    it('holds active reference locks until the financial commit', async () => {
        let release!: () => void
        let entered!: () => void
        const waiting = new Promise<void>((resolve) => {
            entered = resolve
        })
        const gate = new Promise<void>((resolve) => {
            release = resolve
        })
        jest.spyOn(currency, 'getHistoricalQuote').mockImplementation(async () => {
            entered()
            await gate
            return { rate: 1, rateDate: date, source: 'ecb-frankfurter' }
        })
        const pending = service.createIdempotently(principal, randomUUID(), command)
        await waiting
        try {
            await expect(
                otherPrisma.$transaction((tx) =>
                    tx.$queryRaw(
                        Prisma.sql`SELECT id FROM categories WHERE id = ${command.categoryId} FOR UPDATE NOWAIT`,
                    ),
                ),
            ).rejects.toMatchObject({ meta: { driverAdapterError: expect.anything() } })
            await expect(
                otherPrisma.$transaction((tx) =>
                    tx.$queryRaw(
                        Prisma.sql`SELECT id FROM payment_sources WHERE id = ${command.paymentSourceId} FOR UPDATE NOWAIT`,
                    ),
                ),
            ).rejects.toBeDefined()
        } finally {
            release()
            await pending
        }
    })

    it('workspace deletion cascades through ownership and replay records', async () => {
        const temporary = await prisma.workspace.create({
            data: { name: 'Cascade test', baseCurrency: 'PLN' },
        })
        const source = await prisma.paymentSource.create({
            data: { workspaceId: temporary.id, name: 'Cascade source', type: 'cash' },
        })
        const identity = await prisma.integration.create({
            data: {
                workspaceId: temporary.id,
                name: 'Cascade integration',
                creatorReference: userId,
            },
        })
        await service.createIdempotently(
            { ...principal, workspaceId: temporary.id, integrationId: identity.id },
            randomUUID(),
            { ...command, categoryId: null, paymentSourceId: source.id },
        )
        await prisma.workspace.delete({ where: { id: temporary.id } })
        expect(await prisma.transaction.count({ where: { workspaceId: temporary.id } })).toBe(0)
        expect(
            await prisma.integrationIdempotencyRecord.count({
                where: { integrationId: identity.id },
            }),
        ).toBe(0)
    })

    it('rolls back updates and deletes including their success claims on audit failure', async () => {
        await service.createIdempotently(principal, undefined, command)
        jest.spyOn(audit, 'record').mockRejectedValue(new Error('Synthetic audit outage'))
        await expect(
            service.updateIdempotently(principal, randomUUID(), 1, {
                ...command,
                amount: 99,
                tags: ['changed'],
            }),
        ).rejects.toThrow('Synthetic audit outage')
        await expect(
            service.deleteIdempotently(principal, randomUUID(), command.externalId!, 1),
        ).rejects.toThrow('Synthetic audit outage')
        expect(await prisma.transaction.findFirstOrThrow({ where: { workspaceId } })).toMatchObject(
            { amount: 1234, version: 1, deletedAt: null },
        )
        expect(await prisma.transactionTag.count({ where: { workspaceId } })).toBe(2)
        expect(
            await prisma.integrationIdempotencyRecord.count({
                where: { integrationId: principal.integrationId },
            }),
        ).toBe(0)
    })

    it('enforces uniqueness and workspace ownership in database constraints', async () => {
        const created = await service.createIdempotently(principal, undefined, command)
        const {
            id: _id,
            createdAt: _createdAt,
            updatedAt: _updatedAt,
            tags: _tags,
            ...data
        } = created.transaction!
        void [_id, _createdAt, _updatedAt, _tags]
        await expect(prisma.transaction.create({ data })).rejects.toMatchObject({ code: 'P2002' })
        const otherWorkspace = await prisma.workspace.create({ data: { name: 'Other tenant' } })
        try {
            const source = await prisma.paymentSource.create({
                data: { workspaceId: otherWorkspace.id, name: 'Other', type: 'cash' },
            })
            await expect(
                prisma.transaction.create({
                    data: {
                        ...data,
                        workspaceId: otherWorkspace.id,
                        categoryId: null,
                        paymentSourceId: source.id,
                    },
                }),
            ).rejects.toMatchObject({ code: 'P2003' })
            const identity = await prisma.integration.create({
                data: {
                    workspaceId: otherWorkspace.id,
                    name: 'Other identity',
                    creatorReference: userId,
                },
            })
            await expect(
                prisma.transaction.create({
                    data: {
                        ...data,
                        workspaceId: otherWorkspace.id,
                        integrationId: identity.id,
                        categoryId: null,
                        paymentSourceId: source.id,
                    },
                }),
            ).resolves.toMatchObject({ externalId: command.externalId })
            await expect(
                service.createIdempotently(principal, randomUUID(), {
                    ...command,
                    paymentSourceId: source.id,
                    externalId: 'invalid-source',
                }),
            ).rejects.toBeInstanceOf(BadRequestException)
        } finally {
            await prisma.transaction.deleteMany({ where: { workspaceId: otherWorkspace.id } })
            await prisma.workspace.delete({ where: { id: otherWorkspace.id } })
        }
    })

    it('denies empty scopes at the persistence boundary without creating claims', async () => {
        await expect(
            service.createIdempotently({ ...principal, scopes: [] }, randomUUID(), command),
        ).rejects.toBeInstanceOf(ForbiddenException)
        expect(
            await prisma.integrationIdempotencyRecord.count({
                where: { integrationId: principal.integrationId },
            }),
        ).toBe(0)
    })

    it('recovers expired claims but preserves live claims and exposes a retry hint', async () => {
        const key = randomUUID()
        const claim = await seedClaim(key, new Date(Date.now() + 60_000))
        const error = await service
            .createIdempotently(principal, key, command)
            .catch((error) => error)
        expect(error).toBeInstanceOf(IdempotencyInProgressException)
        expect(error.retryAfterSeconds).toBe(1)
        expect(await service.cleanupExpiredIdempotency()).toBe(0)
        await prisma.integrationIdempotencyRecord.update({
            where: { id: claim.id },
            data: { leaseExpiresAt: new Date(Date.now() - 1), expiresAt: new Date(Date.now() - 1) },
        })
        const results = await Promise.all([
            service.createIdempotently(principal, key, command),
            otherService.createIdempotently(principal, key, command),
        ])
        expect(results.filter((result) => !result.replayed)).toHaveLength(1)
        expect(await prisma.transaction.count({ where: { workspaceId } })).toBe(1)
    })

    it('fences an original worker until commit so lease expiry cannot authorize a second effect', async () => {
        const key = randomUUID()
        const lease = await seedClaim(key, new Date(Date.now() - 1))
        let release!: () => void
        let entered!: () => void
        const waiting = new Promise<void>((resolve) => {
            entered = resolve
        })
        const gate = new Promise<void>((resolve) => {
            release = resolve
        })
        jest.spyOn(currency, 'getHistoricalQuote').mockImplementation(async () => {
            entered()
            await gate
            return { rate: 1, rateDate: date, source: 'ecb-frankfurter' }
        })
        const original = service.createIdempotently(principal, key, command)
        await waiting
        const locks = await otherPrisma.$queryRaw<Array<{ locked: boolean }>>(
            Prisma.sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${`idempotency:${principal.integrationId}:${digestIdempotencyKey(key)}`}, 0)) AS locked`,
        )
        expect(locks[0]?.locked).toBe(false)
        // The recovered record is still invisible outside its transaction; its old expiry
        // cannot grant ownership to a second worker while the exclusive lock is held.
        expect(
            await otherPrisma.integrationIdempotencyRecord.findUnique({ where: { id: lease.id } }),
        ).not.toBeNull()
        const second = otherService.createIdempotently(principal, key, command)
        release()
        const [firstResult, secondResult] = await Promise.all([original, second])
        expect(secondResult).toEqual({ ...firstResult, replayed: true })
        expect(await prisma.transaction.count({ where: { workspaceId } })).toBe(1)
    }, 15_000)

    it('expires results at seven days without early replay or deleting active claims', async () => {
        const key = randomUUID()
        await service.createIdempotently(principal, key, command)
        const record = await prisma.integrationIdempotencyRecord.findFirstOrThrow({
            where: { integrationId: principal.integrationId },
        })
        const almostExpired = new Date(Date.now() + 60_000)
        await prisma.integrationIdempotencyRecord.update({
            where: { id: record.id },
            data: {
                expiresAt: almostExpired,
                completedAt: new Date(almostExpired.getTime() - IDEMPOTENCY_RETENTION_MS),
            },
        })
        expect(await service.cleanupExpiredIdempotency()).toBe(0)
        expect((await service.createIdempotently(principal, key, command)).replayed).toBe(true)
        const expired = new Date(Date.now() - 1)
        await prisma.integrationIdempotencyRecord.update({
            where: { id: record.id },
            data: {
                expiresAt: expired,
                completedAt: new Date(expired.getTime() - IDEMPOTENCY_RETENTION_MS),
            },
        })
        // Waiting for cleanup must not keep an expired response replayable.
        expect(await service.createIdempotently(principal, key, command)).toMatchObject({
            responseStatus: 200,
            replayed: false,
            alreadyExists: { status: 'already_exists' },
        })
        const live = await seedClaim(randomUUID(), new Date(Date.now() + 60_000))
        const expiredClaim = await seedClaim(randomUUID(), new Date(Date.now() - 1))
        const completed = await prisma.integrationIdempotencyRecord.findFirstOrThrow({
            where: { integrationId: principal.integrationId, status: 'completed' },
        })
        await prisma.integrationIdempotencyRecord.update({
            where: { id: completed.id },
            data: {
                expiresAt: expired,
                completedAt: new Date(expired.getTime() - IDEMPOTENCY_RETENTION_MS),
            },
        })
        expect(await service.cleanupExpiredIdempotency()).toBe(1)
        expect(
            await prisma.integrationIdempotencyRecord.count({
                where: { id: { in: [live.id, expiredClaim.id] } },
            }),
        ).toBe(2)
        expect(await prisma.transaction.count({ where: { workspaceId } })).toBe(1)
    })

    async function seedClaim(key: string, leaseExpiresAt: Date) {
        return prisma.integrationIdempotencyRecord.create({
            data: {
                workspaceId,
                integrationId: principal.integrationId,
                keyDigest: digestIdempotencyKey(key),
                operation: 'create',
                targetExternalId: command.externalId,
                requestFingerprint: fingerprintExternalTransactionCreate(command),
                status: 'in_progress',
                leaseExpiresAt,
                expiresAt: leaseExpiresAt,
            },
        })
    }
})

describe('external transaction migration upgrade', () => {
    it('preserves populated manual and external rows, and backfills replay retention', async () => {
        const client = new Client({ connectionString: databaseUrl })
        const schema = `upgrade_test_${randomUUID().replace(/-/g, '')}`
        await client.connect()
        try {
            await client.query(`CREATE SCHEMA "${schema}"`)
            await client.query(`SET search_path TO "${schema}"`)
            const directory = join(__dirname, '../prisma/migrations')
            const migrations = readdirSync(directory)
                .filter((name) => name < '0025' && /^\d/.test(name))
                .sort()
            for (const migration of migrations)
                await client.query(
                    readFileSync(join(directory, migration, 'migration.sql'), 'utf8'),
                )
            await client.query(`INSERT INTO workspaces(id,name,updated_at) VALUES ('workspace','Upgrade test',NOW());
                INSERT INTO categories(id,workspace_id,name,updated_at) VALUES ('category','workspace','Test',NOW());
                INSERT INTO payment_sources(id,workspace_id,name,type,updated_at) VALUES ('source','workspace','Test','cash',NOW());
                INSERT INTO integrations(id,workspace_id,name,creator_reference,updated_at) VALUES ('integration','workspace','Test','synthetic',NOW());
                INSERT INTO transactions(id,workspace_id,category_id,payment_source_id,amount,currency,date,description,updated_at)
                    VALUES ('manual','workspace','category','source',1234,'PLN','2026-09-04','Manual test',NOW());
                INSERT INTO transactions(id,workspace_id,category_id,payment_source_id,integration_id,external_id,amount,currency,date,description,updated_at)
                    VALUES ('external','workspace','category','source','integration','record',1234,'PLN','2026-09-04','External test',NOW());
                INSERT INTO integration_idempotency_records(id,integration_id,key_digest,operation,target_external_id,request_fingerprint,status,response_status,response_body,expires_at)
                    VALUES ('replay','integration','synthetic','create','record','synthetic','completed',201,
                    '{"id":"external","categoryId":"category","paymentSourceId":"source","version":1}',NOW()+INTERVAL '1 day');`)
            const before = (await client.query('SELECT * FROM transactions ORDER BY id')).rows
            await client.query(
                readFileSync(
                    join(directory, '0025_external_transaction_reconciliation/migration.sql'),
                    'utf8',
                ),
            )
            expect((await client.query('SELECT * FROM transactions ORDER BY id')).rows).toEqual(
                before,
            )
            const { rows } = await client.query(
                'SELECT *, expires_at - completed_at AS retention FROM integration_idempotency_records',
            )
            expect(rows[0]).toMatchObject({
                workspace_id: 'workspace',
                target_transaction_id: 'external',
                retained_category_id: 'category',
                retained_payment_source_id: 'source',
                response_etag: '"tx-v1"',
                retention: { days: 7 },
            })
            await client.query("UPDATE transactions SET notes='Manual edit' WHERE id='manual'")
            expect(
                (await client.query("SELECT version FROM transactions WHERE id='manual'")).rows[0]
                    .version,
            ).toBe(1)
            await client.query("UPDATE transactions SET notes='Browser edit' WHERE id='external'")
            expect(
                (await client.query("SELECT version FROM transactions WHERE id='external'")).rows[0]
                    .version,
            ).toBe(2)
        } finally {
            await client.query('SET search_path TO public')
            await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
            await client.end()
        }
    }, 30_000)
})
