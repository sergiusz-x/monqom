import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { Prisma } from '@prisma/client'
import * as argon2 from 'argon2'
import session from 'express-session'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from './../src/app.module'
import { AllExceptionsFilter } from './../src/shared/filters/http-exception.filter'
import { PrismaService } from './../src/shared/database/prisma.service'
import { createSessionOptions } from './../src/shared/session/session.config'

interface StoredUser {
    id: string
    email: string
    name: string
    passwordHash: string
    emailVerified: boolean
    sessionVersion: number
    createdAt: Date
    updatedAt: Date
}

interface StoredWorkspace {
    id: string
    name: string
    type: string
    timezone: string
    createdAt: Date
    updatedAt: Date
}

interface StoredWorkspaceMembership {
    id: string
    userId: string
    workspaceId: string
    role: string
    createdAt: Date
    updatedAt: Date
}

interface StoredCategory {
    id: string
    workspaceId: string
    parentId: string | null
    name: string
    color: string | null
    icon: string | null
    createdAt: Date
    updatedAt: Date
}

interface StoredPaymentSource {
    id: string
    workspaceId: string
    name: string
    type: string
    createdAt: Date
    updatedAt: Date
    deletedAt: Date | null
}

interface StoredTransaction {
    id: string
    workspaceId: string
    categoryId: string
    paymentSourceId: string | null
    type: string
    amount: number
    currency: string
    date: Date
    notes: string | null
    createdAt: Date
    updatedAt: Date
    deletedAt: Date | null
}

interface StoredTransactionTag {
    id: string
    workspaceId: string
    transactionId: string
    name: string
    createdAt: Date
    updatedAt: Date
}

interface StoredAuditEvent {
    id: string
    action: string
    userId: string | null
    workspaceId: string | null
    entityType: string | null
    entityId: string | null
    metadata: Record<string, unknown> | null
    createdAt: Date
    updatedAt: Date
}

interface PrismaMock {
    users: StoredUser[]
    workspaces: StoredWorkspace[]
    workspaceMemberships: StoredWorkspaceMembership[]
    categories: StoredCategory[]
    paymentSources: StoredPaymentSource[]
    transactions: StoredTransaction[]
    transactionTags: StoredTransactionTag[]
    auditEvents: StoredAuditEvent[]
    user: {
        findUnique(args: { where: { email?: string; id?: string } }): Promise<StoredUser | null>
    }
    workspace: {
        findUnique(args: { where: { id: string } }): Promise<StoredWorkspace | null>
    }
    workspaceMembership: {
        findFirst(args: {
            where: { userId: string; workspaceId: string }
            select: { role: boolean; workspace: { select: { id: boolean } } }
        }): Promise<{ role: string; workspace: { id: string } } | null>
    }
    category: {
        findFirst(args: {
            where: { workspaceId: string; id: string }
        }): Promise<StoredCategory | null>
    }
    paymentSource: {
        findFirst(args: {
            where: { workspaceId: string; id: string; deletedAt: null }
        }): Promise<StoredPaymentSource | null>
    }
    transaction: {
        create(args: {
            data: {
                workspaceId: string
                categoryId: string
                paymentSourceId: string | null
                type: string
                amount: number
                currency: string
                date: Date
                notes: string | null
            }
        }): Promise<StoredTransaction>
    }
    transactionTag: {
        create(args: {
            data: {
                workspaceId: string
                transactionId: string
                name: string
            }
        }): Promise<StoredTransactionTag>
    }
    auditEvent: {
        create(args: {
            data: {
                action: string
                userId?: string
                workspaceId?: string | null
                entityType?: string | null
                entityId?: string | null
                metadata?: Record<string, unknown>
            }
        }): Promise<StoredAuditEvent>
    }
    $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>
    $transaction<T>(callback: (tx: PrismaMock) => Promise<T>): Promise<T>
    $connect(): Promise<void>
    $disconnect(): Promise<void>
}

describe('Transactions endpoints (e2e)', () => {
    let app: INestApplication<App>
    let prismaMock: PrismaMock
    const originalSessionSecret = process.env.SESSION_SECRET

    beforeEach(async () => {
        prismaMock = createPrismaMock()
        process.env.SESSION_SECRET = 'test-session-secret'

        await seedTransactionFixture(prismaMock)

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(PrismaService)
            .useValue(prismaMock)
            .compile()

        app = moduleFixture.createNestApplication()
        app.use(
            session(
                createSessionOptions({
                    nodeEnv: 'test',
                    sessionSecret: process.env.SESSION_SECRET,
                }),
            ),
        )
        app.setGlobalPrefix('api/v1', {
            exclude: ['health', 'ready'],
        })
        app.useGlobalFilters(new AllExceptionsFilter())
        await app.init()
    })

    afterEach(async () => {
        await app.close()
    })

    afterAll(() => {
        process.env.SESSION_SECRET = originalSessionSecret
    })

    it('creates an expense transaction with tags, cents, and an audit event', async () => {
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        const response = await agent.post('/api/v1/workspaces/workspace-1/transactions').send({
            amount: 10.5,
            date: '2026-03-23',
            category_id: 'category-1',
            payment_source_id: 'payment-source-1',
            notes: 'Lunch with the team',
            tags: ['Food', 'food', 'Work'],
        })

        expect(response.status).toBe(201)
        expect(response.body).toEqual({
            id: 'transaction-1',
            workspace_id: 'workspace-1',
            category_id: 'category-1',
            payment_source_id: 'payment-source-1',
            type: 'expense',
            amount: 10.5,
            currency: 'USD',
            date: '2026-03-23T00:00:00.000Z',
            notes: 'Lunch with the team',
            tags: ['Food', 'Work'],
            created_at: '2026-03-24T12:00:00.000Z',
            updated_at: '2026-03-24T12:00:00.000Z',
        })

        expect(prismaMock.transactions).toEqual([
            {
                id: 'transaction-1',
                workspaceId: 'workspace-1',
                categoryId: 'category-1',
                paymentSourceId: 'payment-source-1',
                type: 'expense',
                amount: 1050,
                currency: 'USD',
                date: new Date('2026-03-23T00:00:00.000Z'),
                notes: 'Lunch with the team',
                createdAt: new Date('2026-03-24T12:00:00.000Z'),
                updatedAt: new Date('2026-03-24T12:00:00.000Z'),
                deletedAt: null,
            },
        ])
        expect(prismaMock.transactionTags).toEqual([
            {
                id: 'tag-1',
                workspaceId: 'workspace-1',
                transactionId: 'transaction-1',
                name: 'Food',
                createdAt: new Date('2026-03-24T12:00:01.000Z'),
                updatedAt: new Date('2026-03-24T12:00:01.000Z'),
            },
            {
                id: 'tag-2',
                workspaceId: 'workspace-1',
                transactionId: 'transaction-1',
                name: 'Work',
                createdAt: new Date('2026-03-24T12:00:02.000Z'),
                updatedAt: new Date('2026-03-24T12:00:02.000Z'),
            },
        ])
        expect(prismaMock.auditEvents).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    action: 'TRANSACTION_CREATED',
                    userId: 'user-1',
                    workspaceId: 'workspace-1',
                    entityType: 'TRANSACTION',
                    entityId: 'transaction-1',
                    metadata: {
                        type: 'expense',
                        amount: 1050,
                        currency: 'USD',
                        date: '2026-03-23T00:00:00.000Z',
                        category_id: 'category-1',
                        payment_source_id: 'payment-source-1',
                        notes: 'Lunch with the team',
                        tags: ['Food', 'Work'],
                    },
                }),
            ]),
        )
    })

    it('rejects archived payment sources', async () => {
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        const response = await agent.post('/api/v1/workspaces/workspace-1/transactions').send({
            amount: 4.25,
            date: '2026-03-23T08:30:00Z',
            category_id: 'category-1',
            payment_source_id: 'payment-source-archived',
        })

        expect(response.status).toBe(404)
        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 404,
                message: 'Payment source not found',
                error: 'Not Found',
            }),
        )
        expect(prismaMock.transactions).toHaveLength(0)
        expect(prismaMock.transactionTags).toHaveLength(0)
        expect(
            prismaMock.auditEvents.filter(
                (auditEvent) => auditEvent.action === 'TRANSACTION_CREATED',
            ),
        ).toHaveLength(0)
    })

    it('lists transactions newest first with tags, total count, pagination, and no soft-deleted rows', async () => {
        seedExistingTransactions(prismaMock)
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        const response = await agent
            .get('/api/v1/workspaces/workspace-1/transactions?limit=2&offset=1')
            .expect(200)

        expect(response.body).toEqual({
            data: [
                {
                    id: 'transaction-existing-2',
                    workspace_id: 'workspace-1',
                    category_id: 'category-1',
                    payment_source_id: 'payment-source-1',
                    type: 'expense',
                    amount: 20.5,
                    currency: 'USD',
                    date: '2026-03-24T12:00:00.000Z',
                    notes: 'Weekly groceries',
                    tags: ['Groceries'],
                    created_at: '2026-03-24T12:00:00.000Z',
                    updated_at: '2026-03-24T12:00:00.000Z',
                },
                {
                    id: 'transaction-existing-3',
                    workspace_id: 'workspace-1',
                    category_id: 'category-2',
                    payment_source_id: 'payment-source-2',
                    type: 'expense',
                    amount: 30.5,
                    currency: 'USD',
                    date: '2026-03-23T11:00:00.000Z',
                    notes: 'Train tickets',
                    tags: ['Travel'],
                    created_at: '2026-03-23T11:00:00.000Z',
                    updated_at: '2026-03-23T11:00:00.000Z',
                },
            ],
            total: 6,
            limit: 2,
            offset: 1,
        })
    })

    it('filters transactions by category, tag, payment source, and date range using case-insensitive tag matching', async () => {
        seedExistingTransactions(prismaMock)
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        const response = await agent
            .get(
                '/api/v1/workspaces/workspace-1/transactions?category_id=category-1&tag=FOOD&payment_source_id=payment-source-2&date_from=2026-03-21&date_to=2026-03-22',
            )
            .expect(200)

        expect(response.body).toEqual({
            data: [
                {
                    id: 'transaction-existing-4',
                    workspace_id: 'workspace-1',
                    category_id: 'category-1',
                    payment_source_id: 'payment-source-2',
                    type: 'expense',
                    amount: 40.5,
                    currency: 'USD',
                    date: '2026-03-22T09:30:00.000Z',
                    notes: 'Commute snacks',
                    tags: ['commute', 'food'],
                    created_at: '2026-03-22T10:00:00.000Z',
                    updated_at: '2026-03-22T10:00:00.000Z',
                },
            ],
            total: 1,
            limit: 20,
            offset: 0,
        })
    })

    it('rejects invalid list query params with a 400 response', async () => {
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        const response = await agent
            .get(
                '/api/v1/workspaces/workspace-1/transactions?tag=%20%20%20&date_from=2026-03-24&date_to=2026-03-23&limit=0&offset=-1',
            )
            .expect(400)

        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 400,
                message: expect.arrayContaining([
                    'Tag must be a non-empty string',
                    'Date from must be less than or equal to date to',
                    'Limit must be an integer between 1 and 100',
                    'Offset must be a non-negative integer',
                ]),
                error: 'Bad Request',
            }),
        )
    })

    it('returns an empty tag list for a workspace with no transaction tags', async () => {
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        const response = await agent.get('/api/v1/workspaces/workspace-1/tags').expect(200)

        expect(response.body).toEqual([])
    })

    it('lists distinct workspace tags from non-deleted transactions', async () => {
        seedExistingTransactions(prismaMock)
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        const response = await agent.get('/api/v1/workspaces/workspace-1/tags').expect(200)

        expect(response.body).toHaveLength(8)
        expect(response.body).toEqual(
            expect.arrayContaining([
                'Bills',
                'Food',
                'Groceries',
                'Home',
                'Travel',
                'Work',
                'commute',
                'food',
            ]),
        )
        expect(response.body).not.toContain('DeletedOnly')
    })
})

function createPrismaMock(): PrismaMock {
    const users: StoredUser[] = []
    const workspaces: StoredWorkspace[] = []
    const workspaceMemberships: StoredWorkspaceMembership[] = []
    const categories: StoredCategory[] = []
    const paymentSources: StoredPaymentSource[] = []
    const transactions: StoredTransaction[] = []
    const transactionTags: StoredTransactionTag[] = []
    const auditEvents: StoredAuditEvent[] = []
    let transactionCounter = 0
    let tagCounter = 0
    let auditEventCounter = 0

    const prismaMock: PrismaMock = {
        users,
        workspaces,
        workspaceMemberships,
        categories,
        paymentSources,
        transactions,
        transactionTags,
        auditEvents,
        user: {
            findUnique: async ({ where }) => {
                if (where.email) {
                    return users.find((user) => user.email === where.email) ?? null
                }

                if (where.id) {
                    return users.find((user) => user.id === where.id) ?? null
                }

                return null
            },
        },
        workspace: {
            findUnique: async ({ where }) =>
                workspaces.find((workspace) => workspace.id === where.id) ?? null,
        },
        workspaceMembership: {
            findFirst: async ({ where }) =>
                workspaceMemberships
                    .filter(
                        (membership) =>
                            membership.userId === where.userId &&
                            membership.workspaceId === where.workspaceId,
                    )
                    .map((membership) => ({
                        role: membership.role,
                        workspace: {
                            id: membership.workspaceId,
                        },
                    }))[0] ?? null,
        },
        category: {
            findFirst: async ({ where }) =>
                categories.find(
                    (category) =>
                        category.workspaceId === where.workspaceId && category.id === where.id,
                ) ?? null,
        },
        paymentSource: {
            findFirst: async ({ where }) =>
                paymentSources.find(
                    (paymentSource) =>
                        paymentSource.workspaceId === where.workspaceId &&
                        paymentSource.id === where.id &&
                        paymentSource.deletedAt === where.deletedAt,
                ) ?? null,
        },
        transaction: {
            create: async ({ data }) => {
                transactionCounter += 1

                const transaction: StoredTransaction = {
                    id: `transaction-${transactionCounter}`,
                    workspaceId: data.workspaceId,
                    categoryId: data.categoryId,
                    paymentSourceId: data.paymentSourceId,
                    type: data.type,
                    amount: data.amount,
                    currency: data.currency,
                    date: data.date,
                    notes: data.notes,
                    createdAt: new Date('2026-03-24T12:00:00.000Z'),
                    updatedAt: new Date('2026-03-24T12:00:00.000Z'),
                    deletedAt: null,
                }

                transactions.push(transaction)
                return transaction
            },
        },
        transactionTag: {
            create: async ({ data }) => {
                tagCounter += 1

                const createdAt = new Date(Date.parse(`2026-03-24T12:00:0${tagCounter}.000Z`))
                const tag: StoredTransactionTag = {
                    id: `tag-${tagCounter}`,
                    workspaceId: data.workspaceId,
                    transactionId: data.transactionId,
                    name: data.name,
                    createdAt,
                    updatedAt: createdAt,
                }

                transactionTags.push(tag)
                return tag
            },
        },
        auditEvent: {
            create: async ({ data }) => {
                auditEventCounter += 1

                const createdAt = new Date('2026-03-24T12:00:01.000Z')
                const auditEvent: StoredAuditEvent = {
                    id: `audit-event-${auditEventCounter}`,
                    action: data.action,
                    userId: data.userId ?? null,
                    workspaceId: data.workspaceId ?? null,
                    entityType: data.entityType ?? null,
                    entityId: data.entityId ?? null,
                    metadata: data.metadata ?? null,
                    createdAt,
                    updatedAt: createdAt,
                }

                auditEvents.push(auditEvent)
                return auditEvent
            },
        },
        $queryRaw: async <T>(query: Prisma.Sql) => {
            const renderedQuery = query.strings.join(' ')

            if (renderedQuery.includes('WITH input_tags')) {
                return normalizeInputTags(query) as T
            }

            if (renderedQuery.includes('SELECT COUNT(*)::INT AS "total"')) {
                return [{ total: filterTransactionsFromQuery(query, prismaMock).length }] as T
            }

            if (renderedQuery.includes('SELECT DISTINCT BTRIM(tt."name") AS "name"')) {
                return listWorkspaceTagsFromQuery(query, prismaMock) as T
            }

            if (renderedQuery.includes('ARRAY_AGG(DISTINCT tt."name" ORDER BY tt."name")')) {
                return listTransactionsFromQuery(query, prismaMock) as T
            }

            return [] as T
        },
        $transaction: async <T>(callback: (tx: PrismaMock) => Promise<T>) => callback(prismaMock),
        $connect: async () => undefined,
        $disconnect: async () => undefined,
    }

    return prismaMock
}

function normalizeInputTags(query: Prisma.Sql): Array<{ name: string }> {
    const names: string[] = []

    for (let index = 1; index < query.values.length; index += 2) {
        const tagValue = query.values[index]

        if (typeof tagValue === 'string') {
            names.push(tagValue)
        }
    }

    const seenTags = new Set<string>()

    return names.flatMap((name) => {
        const trimmedName = name.trim()

        if (trimmedName.length === 0) {
            return []
        }

        const loweredName = trimmedName.toLowerCase()

        if (seenTags.has(loweredName)) {
            return []
        }

        seenTags.add(loweredName)

        return [{ name: trimmedName }]
    })
}

function listTransactionsFromQuery(query: Prisma.Sql, prismaMock: PrismaMock) {
    const filteredTransactions = filterTransactionsFromQuery(query, prismaMock)
    const { limit, offset } = extractPaginationFromQuery(query)

    return filteredTransactions.slice(offset, offset + limit).map((transaction) => ({
        id: transaction.id,
        workspace_id: transaction.workspaceId,
        category_id: transaction.categoryId,
        payment_source_id: transaction.paymentSourceId,
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency,
        date: transaction.date,
        notes: transaction.notes,
        created_at: transaction.createdAt,
        updated_at: transaction.updatedAt,
        tags: prismaMock.transactionTags
            .filter(
                (tag) =>
                    tag.workspaceId === transaction.workspaceId &&
                    tag.transactionId === transaction.id,
            )
            .map((tag) => tag.name)
            .sort((left, right) => left.localeCompare(right)),
    }))
}

function listWorkspaceTagsFromQuery(query: Prisma.Sql, prismaMock: PrismaMock) {
    const workspaceId = query.values[0]

    if (typeof workspaceId !== 'string') {
        return []
    }

    const names = prismaMock.transactionTags
        .filter((tag) => {
            const transaction = prismaMock.transactions.find(
                (entry) => entry.workspaceId === tag.workspaceId && entry.id === tag.transactionId,
            )

            return (
                tag.workspaceId === workspaceId &&
                tag.name.trim().length > 0 &&
                transaction?.deletedAt === null
            )
        })
        .map((tag) => tag.name.trim())

    return Array.from(new Set(names))
        .sort((left, right) => left.localeCompare(right))
        .map((name) => ({ name }))
}

function filterTransactionsFromQuery(
    query: Prisma.Sql,
    prismaMock: PrismaMock,
): StoredTransaction[] {
    const renderedQuery = query.strings.join(' ')
    let valueIndex = 0

    const workspaceId = query.values[valueIndex]
    valueIndex += 1

    if (typeof workspaceId !== 'string') {
        return []
    }

    let filteredTransactions = prismaMock.transactions.filter(
        (transaction) => transaction.workspaceId === workspaceId && transaction.deletedAt === null,
    )

    if (renderedQuery.includes('t."category_id" =')) {
        const categoryId = query.values[valueIndex]
        valueIndex += 1

        if (typeof categoryId === 'string') {
            filteredTransactions = filteredTransactions.filter(
                (transaction) => transaction.categoryId === categoryId,
            )
        }
    }

    if (renderedQuery.includes('t."payment_source_id" =')) {
        const paymentSourceId = query.values[valueIndex]
        valueIndex += 1

        if (typeof paymentSourceId === 'string') {
            filteredTransactions = filteredTransactions.filter(
                (transaction) => transaction.paymentSourceId === paymentSourceId,
            )
        }
    }

    if (renderedQuery.includes('LOWER(BTRIM(tt_filter."name")) = LOWER(BTRIM(')) {
        const tagFilter = query.values[valueIndex]
        valueIndex += 1

        if (typeof tagFilter === 'string') {
            const normalizedTagFilter = tagFilter.trim().toLowerCase()

            filteredTransactions = filteredTransactions.filter((transaction) =>
                prismaMock.transactionTags.some(
                    (tag) =>
                        tag.workspaceId === transaction.workspaceId &&
                        tag.transactionId === transaction.id &&
                        tag.name.trim().toLowerCase() === normalizedTagFilter,
                ),
            )
        }
    }

    if (renderedQuery.includes('t."date" >=')) {
        const dateFrom = query.values[valueIndex]
        valueIndex += 1

        if (dateFrom instanceof Date) {
            filteredTransactions = filteredTransactions.filter(
                (transaction) => transaction.date.getTime() >= dateFrom.getTime(),
            )
        }
    }

    if (renderedQuery.includes('t."date" <=')) {
        const dateTo = query.values[valueIndex]
        valueIndex += 1

        if (dateTo instanceof Date) {
            filteredTransactions = filteredTransactions.filter(
                (transaction) => transaction.date.getTime() <= dateTo.getTime(),
            )
        }
    }

    return filteredTransactions.sort((left, right) => {
        const dateDifference = right.date.getTime() - left.date.getTime()

        if (dateDifference !== 0) {
            return dateDifference
        }

        return right.createdAt.getTime() - left.createdAt.getTime()
    })
}

function extractPaginationFromQuery(query: Prisma.Sql): { limit: number; offset: number } {
    const renderedQuery = query.strings.join(' ')

    if (!renderedQuery.includes('LIMIT') || !renderedQuery.includes('OFFSET')) {
        return {
            limit: 0,
            offset: 0,
        }
    }

    const limitValue = query.values[query.values.length - 2]
    const offsetValue = query.values[query.values.length - 1]

    return {
        limit: typeof limitValue === 'number' ? limitValue : 0,
        offset: typeof offsetValue === 'number' ? offsetValue : 0,
    }
}

function seedExistingTransactions(prismaMock: PrismaMock): void {
    prismaMock.transactions.push(
        {
            id: 'transaction-existing-1',
            workspaceId: 'workspace-1',
            categoryId: 'category-1',
            paymentSourceId: 'payment-source-1',
            type: 'expense',
            amount: 1050,
            currency: 'USD',
            date: new Date('2026-03-25T10:00:00.000Z'),
            notes: 'Team lunch',
            createdAt: new Date('2026-03-25T10:00:00.000Z'),
            updatedAt: new Date('2026-03-25T10:00:00.000Z'),
            deletedAt: null,
        },
        {
            id: 'transaction-existing-2',
            workspaceId: 'workspace-1',
            categoryId: 'category-1',
            paymentSourceId: 'payment-source-1',
            type: 'expense',
            amount: 2050,
            currency: 'USD',
            date: new Date('2026-03-24T12:00:00.000Z'),
            notes: 'Weekly groceries',
            createdAt: new Date('2026-03-24T12:00:00.000Z'),
            updatedAt: new Date('2026-03-24T12:00:00.000Z'),
            deletedAt: null,
        },
        {
            id: 'transaction-existing-3',
            workspaceId: 'workspace-1',
            categoryId: 'category-2',
            paymentSourceId: 'payment-source-2',
            type: 'expense',
            amount: 3050,
            currency: 'USD',
            date: new Date('2026-03-23T11:00:00.000Z'),
            notes: 'Train tickets',
            createdAt: new Date('2026-03-23T11:00:00.000Z'),
            updatedAt: new Date('2026-03-23T11:00:00.000Z'),
            deletedAt: null,
        },
        {
            id: 'transaction-existing-4',
            workspaceId: 'workspace-1',
            categoryId: 'category-1',
            paymentSourceId: 'payment-source-2',
            type: 'expense',
            amount: 4050,
            currency: 'USD',
            date: new Date('2026-03-22T09:30:00.000Z'),
            notes: 'Commute snacks',
            createdAt: new Date('2026-03-22T10:00:00.000Z'),
            updatedAt: new Date('2026-03-22T10:00:00.000Z'),
            deletedAt: null,
        },
        {
            id: 'transaction-existing-5',
            workspaceId: 'workspace-1',
            categoryId: 'category-2',
            paymentSourceId: 'payment-source-1',
            type: 'expense',
            amount: 5050,
            currency: 'USD',
            date: new Date('2026-03-21T08:00:00.000Z'),
            notes: 'Utility bill',
            createdAt: new Date('2026-03-21T09:00:00.000Z'),
            updatedAt: new Date('2026-03-21T09:00:00.000Z'),
            deletedAt: null,
        },
        {
            id: 'transaction-existing-6',
            workspaceId: 'workspace-1',
            categoryId: 'category-1',
            paymentSourceId: null,
            type: 'expense',
            amount: 6050,
            currency: 'USD',
            date: new Date('2026-03-20T07:30:00.000Z'),
            notes: 'Cash coffee',
            createdAt: new Date('2026-03-20T08:00:00.000Z'),
            updatedAt: new Date('2026-03-20T08:00:00.000Z'),
            deletedAt: null,
        },
        {
            id: 'transaction-deleted-1',
            workspaceId: 'workspace-1',
            categoryId: 'category-1',
            paymentSourceId: 'payment-source-1',
            type: 'expense',
            amount: 7050,
            currency: 'USD',
            date: new Date('2026-03-26T10:00:00.000Z'),
            notes: 'Should stay hidden',
            createdAt: new Date('2026-03-26T10:00:00.000Z'),
            updatedAt: new Date('2026-03-26T10:00:00.000Z'),
            deletedAt: new Date('2026-03-27T10:00:00.000Z'),
        },
    )

    prismaMock.transactionTags.push(
        createStoredTransactionTag(
            'tag-existing-1',
            'workspace-1',
            'transaction-existing-1',
            'Food',
        ),
        createStoredTransactionTag(
            'tag-existing-2',
            'workspace-1',
            'transaction-existing-1',
            'Work',
        ),
        createStoredTransactionTag(
            'tag-existing-3',
            'workspace-1',
            'transaction-existing-2',
            'Groceries',
        ),
        createStoredTransactionTag(
            'tag-existing-4',
            'workspace-1',
            'transaction-existing-3',
            'Travel',
        ),
        createStoredTransactionTag(
            'tag-existing-5',
            'workspace-1',
            'transaction-existing-4',
            'food',
        ),
        createStoredTransactionTag(
            'tag-existing-6',
            'workspace-1',
            'transaction-existing-4',
            'commute',
        ),
        createStoredTransactionTag(
            'tag-existing-7',
            'workspace-1',
            'transaction-existing-5',
            'Bills',
        ),
        createStoredTransactionTag(
            'tag-existing-8',
            'workspace-1',
            'transaction-existing-5',
            'Home',
        ),
        createStoredTransactionTag(
            'tag-existing-9',
            'workspace-1',
            'transaction-deleted-1',
            'DeletedOnly',
        ),
    )
}

function createStoredTransactionTag(
    id: string,
    workspaceId: string,
    transactionId: string,
    name: string,
): StoredTransactionTag {
    const createdAt = new Date('2026-03-24T12:30:00.000Z')

    return {
        id,
        workspaceId,
        transactionId,
        name,
        createdAt,
        updatedAt: createdAt,
    }
}

async function seedTransactionFixture(prismaMock: PrismaMock): Promise<void> {
    prismaMock.users.push(
        await createStoredUser({
            id: 'user-1',
            email: 'ada@example.com',
            password: 'GraniteHarbor!1234',
            emailVerified: true,
        }),
    )

    prismaMock.workspaces.push({
        id: 'workspace-1',
        name: "Ada Lovelace's Finances",
        type: 'personal',
        timezone: 'UTC',
        createdAt: new Date('2026-03-23T10:00:00.000Z'),
        updatedAt: new Date('2026-03-23T10:00:00.000Z'),
    })

    prismaMock.workspaceMemberships.push({
        id: 'membership-1',
        userId: 'user-1',
        workspaceId: 'workspace-1',
        role: 'owner',
        createdAt: new Date('2026-03-23T10:00:00.000Z'),
        updatedAt: new Date('2026-03-23T10:00:00.000Z'),
    })

    prismaMock.categories.push(
        {
            id: 'category-1',
            workspaceId: 'workspace-1',
            parentId: null,
            name: 'Food',
            color: null,
            icon: null,
            createdAt: new Date('2026-03-23T10:00:00.000Z'),
            updatedAt: new Date('2026-03-23T10:00:00.000Z'),
        },
        {
            id: 'category-2',
            workspaceId: 'workspace-1',
            parentId: null,
            name: 'Transport',
            color: null,
            icon: null,
            createdAt: new Date('2026-03-23T10:00:00.000Z'),
            updatedAt: new Date('2026-03-23T10:00:00.000Z'),
        },
    )

    prismaMock.paymentSources.push(
        {
            id: 'payment-source-1',
            workspaceId: 'workspace-1',
            name: 'Main Card',
            type: 'credit_card',
            createdAt: new Date('2026-03-23T10:00:00.000Z'),
            updatedAt: new Date('2026-03-23T10:00:00.000Z'),
            deletedAt: null,
        },
        {
            id: 'payment-source-2',
            workspaceId: 'workspace-1',
            name: 'Transit Card',
            type: 'debit_card',
            createdAt: new Date('2026-03-23T10:00:00.000Z'),
            updatedAt: new Date('2026-03-23T10:00:00.000Z'),
            deletedAt: null,
        },
        {
            id: 'payment-source-archived',
            workspaceId: 'workspace-1',
            name: 'Old Card',
            type: 'debit_card',
            createdAt: new Date('2026-03-23T10:00:00.000Z'),
            updatedAt: new Date('2026-03-23T10:00:00.000Z'),
            deletedAt: new Date('2026-03-20T08:00:00.000Z'),
        },
    )
}

async function createStoredUser(input: {
    id: string
    email: string
    password: string
    emailVerified: boolean
    name?: string
}): Promise<StoredUser> {
    const passwordHash = await argon2.hash(input.password, {
        type: argon2.argon2id,
    })

    return {
        id: input.id,
        email: input.email,
        name: input.name ?? 'Ada Lovelace',
        passwordHash,
        emailVerified: input.emailVerified,
        sessionVersion: 0,
        createdAt: new Date('2026-03-23T09:00:00.000Z'),
        updatedAt: new Date('2026-03-23T09:00:00.000Z'),
    }
}

async function authenticateAs(app: INestApplication<App>, email: string, password: string) {
    const agent = request.agent(app.getHttpServer())

    await agent
        .post('/api/v1/auth/login')
        .send({
            email,
            password,
        })
        .expect(200)

    return agent
}
