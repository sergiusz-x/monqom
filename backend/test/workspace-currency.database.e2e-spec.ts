import { ConflictException } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { randomUUID } from 'crypto'
import { AuditService } from '../src/shared/audit/audit.service'
import * as financialLock from '../src/shared/database/workspace-financial-lock'
import { TransactionsRepository } from '../src/modules/transactions/transactions.repository'
import { TransactionsService } from '../src/modules/transactions/transactions.service'
import { BudgetsRepository } from '../src/modules/budgets/budgets.repository'
import { BudgetsService } from '../src/modules/budgets/budgets.service'
import { GoalsService } from '../src/modules/goals/goals.service'
import { WorkspaceRepository } from '../src/modules/workspace/workspace.repository'
import { WorkspaceService } from '../src/modules/workspace/workspace.service'
import { IntegrationCredentialService } from '../src/modules/integrations/integration-credential.service'
import { ExternalTransactionOwnershipService } from '../src/modules/integrations/external-transaction-ownership.service'
import { CurrencyService } from '../src/shared/currency/currency.service'

const databaseUrl = process.env.INTEGRATION_TEST_DATABASE_URL
if (!databaseUrl || !/(^|[_-])test([_-]|$)/i.test(new URL(databaseUrl).pathname.slice(1)))
    throw new Error('INTEGRATION_TEST_DATABASE_URL must point to a disposable test database')
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
const other = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
const audit = new AuditService(prisma as never)
const workspace = new WorkspaceService(
    prisma as never,
    new WorkspaceRepository(prisma as never),
    audit,
)
const settingsRepository = new WorkspaceRepository(other as never)
const settings = new WorkspaceService(
    other as never,
    settingsRepository,
    new AuditService(other as never),
)
const realLock = financialLock.lockWorkspaceCurrency

function barrier() {
    let resolve!: () => void
    const promise = new Promise<void>((done) => {
        resolve = done
    })
    return { promise, resolve }
}

async function waitForBlockedWorkspaceLock() {
    const deadline = Date.now() + 3000
    while (Date.now() < deadline) {
        const rows = await prisma.$queryRaw<Array<{ waiting: boolean }>>`
            SELECT EXISTS(SELECT 1 FROM pg_stat_activity
              WHERE datname = current_database() AND pid <> pg_backend_pid()
              AND wait_event_type = 'Lock' AND query LIKE '%FROM workspaces%FOR %') AS waiting
        `
        if (rows[0]?.waiting) return
        await new Promise((resolve) => setTimeout(resolve, 10))
    }
    throw new Error('Expected a concurrent workspace currency lock waiter')
}

describe('workspace base currency and first financial write', () => {
    let workspaceId: string
    let userId: string
    let sourceId: string
    let categoryId: string
    let integrationId: string
    const quote = jest.fn(async (_from: string, _to: string, date: Date) => ({
        rate: 1,
        rateDate: date,
        source: 'ecb-frankfurter' as const,
    }))
    const currency = { getHistoricalQuote: quote } as unknown as CurrencyService

    beforeEach(async () => {
        quote.mockClear()
        const user = await prisma.user.create({
            data: {
                email: `${randomUUID()}@currency-test.invalid`,
                name: 'Synthetic test',
                passwordHash: 'synthetic-only',
            },
        })
        userId = user.id
        workspaceId = (
            await prisma.workspace.create({ data: { name: 'Currency test', baseCurrency: 'PLN' } })
        ).id
        sourceId = (
            await prisma.paymentSource.create({
                data: { workspaceId, name: 'Test source', type: 'cash' },
            })
        ).id
        const parent = await prisma.category.create({
            data: { workspaceId, name: 'Test parent', type: 'expense' },
        })
        categoryId = (
            await prisma.category.create({
                data: { workspaceId, parentId: parent.id, name: 'Test category', type: 'expense' },
            })
        ).id
        await prisma.workspaceMembership.create({
            data: { workspaceId, userId, role: 'owner', lastPaymentSourceId: sourceId },
        })
        const issued = await new IntegrationCredentialService(
            prisma as never,
            audit,
        ).createIntegrationWithCredential({
            workspaceId,
            createdByUserId: userId,
            name: 'Test importer',
            scopes: ['transactions:create'],
            expiresAt: new Date(Date.now() + 86400000),
            categoryAllowlistEnabled: false,
            paymentSourceAllowlistEnabled: false,
        })
        integrationId = issued.integrationId
    })
    afterEach(async () => {
        jest.restoreAllMocks()
        await prisma.workspace.delete({ where: { id: workspaceId } })
        await prisma.user.delete({ where: { id: userId } })
    })
    afterAll(async () => {
        await Promise.all([prisma.$disconnect(), other.$disconnect()])
    })

    async function write(kind: string) {
        const transactionRepository = new TransactionsRepository(prisma as never, audit)
        if (kind === 'integration') {
            await new ExternalTransactionOwnershipService(
                prisma as never,
                transactionRepository,
                audit,
                currency,
            ).createIdempotently(
                {
                    integrationId,
                    workspaceId,
                    credentialId: 'synthetic',
                    scopes: ['transactions:create'],
                    categoryAllowlistEnabled: false,
                    allowedCategoryIds: [],
                    paymentSourceAllowlistEnabled: false,
                    allowedPaymentSourceIds: [],
                    allowedCidrs: [],
                },
                undefined,
                {
                    type: 'expense',
                    amount: 1000,
                    currency: 'PLN',
                    date: new Date('2026-09-04'),
                    description: 'Test',
                    notes: null,
                    tags: [],
                    categoryId,
                    paymentSourceId: sourceId,
                },
            )
        } else if (kind === 'transaction') {
            await new TransactionsService(
                prisma as never,
                transactionRepository,
                currency,
                workspace,
            ).createTransaction(
                {
                    amount: 10,
                    currency: 'PLN',
                    date: '2026-09-04',
                    description: 'Test',
                    categoryId,
                    paymentSourceId: sourceId,
                },
                workspaceId,
                userId,
            )
        } else if (kind === 'budget') {
            await new BudgetsService(
                prisma as never,
                new BudgetsRepository(prisma as never, audit),
                currency,
                workspace,
            ).createBudget(
                { amount: 10, currency: 'PLN', year: 2026, month: 9, categoryId },
                workspaceId,
                userId,
            )
        } else {
            const date = new Date()
            date.setUTCMonth(date.getUTCMonth() + 6)
            await new GoalsService(prisma as never, workspace, audit).create(workspaceId, userId, {
                name: 'Test goal',
                target_amount: 10,
                include_current_month: false,
                target_date: date.toISOString().slice(0, 10),
            })
        }
    }

    it.each(['integration', 'transaction', 'budget', 'goal'])(
        'locks the currency while the first %s commits',
        async (kind) => {
            const reached = barrier(),
                release = barrier()
            jest.spyOn(financialLock, 'lockWorkspaceCurrency').mockImplementationOnce(
                async (...args) => {
                    const snapshot = await realLock(...args)
                    reached.resolve()
                    await release.promise
                    return snapshot
                },
            )
            const creating = write(kind)
            await reached.promise
            const changing = settings
                .updateWorkspaceSettings(
                    workspaceId,
                    { timezone: 'UTC', baseCurrency: 'EUR' },
                    userId,
                )
                .then(
                    () => null,
                    (error: unknown) => error,
                )
            try {
                await waitForBlockedWorkspaceLock()
            } finally {
                release.resolve()
            }
            await creating
            expect(await changing).toBeInstanceOf(ConflictException)
            expect(
                (await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } }))
                    .baseCurrency,
            ).toBe('PLN')
        },
    )

    it.each(['integration', 'transaction', 'budget', 'goal'])(
        'uses the committed currency when settings precede the first %s',
        async (kind) => {
            const reached = barrier(),
                release = barrier()
            const original = settingsRepository.findWorkspaceById.bind(settingsRepository)
            jest.spyOn(settingsRepository, 'findWorkspaceById').mockImplementationOnce(
                async (...args) => {
                    const snapshot = await original(...args)
                    reached.resolve()
                    await release.promise
                    return snapshot
                },
            )
            const changing = settings.updateWorkspaceSettings(
                workspaceId,
                { timezone: 'UTC', baseCurrency: 'EUR' },
                userId,
            )
            await reached.promise
            const creating = write(kind)
            try {
                await waitForBlockedWorkspaceLock()
            } finally {
                release.resolve()
            }
            await Promise.all([changing, creating])
            if (kind === 'goal')
                expect(
                    (await prisma.goal.findFirstOrThrow({ where: { workspaceId } })).currency,
                ).toBe('EUR')
            else expect(quote.mock.calls[0]?.[1]).toBe('EUR')
        },
    )
})
