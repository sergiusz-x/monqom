import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as argon2 from 'argon2'
import session from 'express-session'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from './../src/app.module'
import { PrismaService } from './../src/shared/database/prisma.service'
import { AllExceptionsFilter } from './../src/shared/filters/http-exception.filter'
import { createSessionOptions } from './../src/shared/session/session.config'

interface StoredUser {
    id: string
    email: string
    name: string
    passwordHash: string
    emailVerified: boolean
    sessionVersion: number
    totpEnabled?: boolean
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
    deletedAt: Date | null
    createdAt: Date
    updatedAt: Date
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
    deletedAt: Date | null
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
    transactions: StoredTransaction[]
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
        findMany(args: {
            where: {
                workspaceId: string
                id?: {
                    in: string[]
                }
            }
            select: { id: boolean; name: boolean; color: boolean }
        }): Promise<Array<{ id: string; name: string; color: string | null }>>
    }
    transaction: {
        aggregate(args: {
            where: {
                workspaceId: string
                deletedAt: null
                type: string
                date: {
                    gte: Date
                    lt: Date
                }
            }
            _sum: {
                amount: true
            }
        }): Promise<{ _sum: { amount: number } }>
        groupBy(args: {
            by: ['categoryId']
            where: {
                workspaceId: string
                deletedAt: null
                type: string
                date: {
                    gte: Date
                    lt: Date
                }
            }
            _sum: {
                amount: true
            }
        }): Promise<Array<{ categoryId: string; _sum: { amount: number } }>>
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
    $connect(): Promise<void>
    $disconnect(): Promise<void>
}

describe('Dashboard endpoints (e2e)', () => {
    let app: INestApplication<App>
    let prismaMock: PrismaMock
    const originalSessionSecret = process.env.SESSION_SECRET

    beforeEach(async () => {
        prismaMock = createPrismaMock()
        process.env.SESSION_SECRET = 'test-session-secret'

        await seedDashboardFixture(prismaMock)

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

    it('returns monthly spending summary compared with the previous month', async () => {
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        const response = await agent
            .get('/api/v1/workspaces/workspace-1/dashboard/spending-summary?month=2026-03')
            .expect(200)

        expect(response.body).toEqual({
            month: '2026-03',
            currency: 'USD',
            current_total: 625.99,
            previous_total: 400,
            change_amount: 225.99,
            change_percentage: 56.5,
            direction: 'up',
        })
    })

    it('returns category breakdown percentages sorted by spend descending', async () => {
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        const response = await agent
            .get('/api/v1/workspaces/workspace-1/dashboard/category-breakdown?month=2026-03')
            .expect(200)

        expect(response.body).toEqual({
            month: '2026-03',
            currency: 'USD',
            total_spending: 625.99,
            categories: [
                {
                    category_id: 'category-child-groceries',
                    category_name: 'Groceries',
                    category_color: '#16a34a',
                    amount: 300,
                    percentage: 47.92,
                },
                {
                    category_id: 'category-child-rent',
                    category_name: 'Rent',
                    category_color: '#1d4ed8',
                    amount: 200,
                    percentage: 31.95,
                },
                {
                    category_id: 'category-child-dining',
                    category_name: 'Dining Out',
                    category_color: '#dc2626',
                    amount: 100.99,
                    percentage: 16.13,
                },
                {
                    category_id: 'category-archived',
                    category_name: 'Archived Category',
                    category_color: '#6b7280',
                    amount: 25,
                    percentage: 3.99,
                },
            ],
        })
    })

    it('returns an empty category breakdown for months without spending', async () => {
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        const response = await agent
            .get('/api/v1/workspaces/workspace-1/dashboard/category-breakdown?month=2026-05')
            .expect(200)

        expect(response.body).toEqual({
            month: '2026-05',
            currency: 'USD',
            total_spending: 0,
            categories: [],
        })
    })

    it('requires authentication for dashboard endpoints', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/workspaces/workspace-1/dashboard/spending-summary?month=2026-03')
            .expect(401)

        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 401,
                message: 'Authentication required',
                error: 'Unauthorized',
            }),
        )
    })

    it('forbids non-members from accessing workspace dashboard data', async () => {
        prismaMock.users.push(
            await createStoredUser({
                id: 'user-2',
                email: 'grace@example.com',
                password: 'CopperAtlas!1234',
                emailVerified: true,
                name: 'Grace Hopper',
            }),
        )

        const agent = await authenticateAs(app, 'grace@example.com', 'CopperAtlas!1234')

        const response = await agent
            .get('/api/v1/workspaces/workspace-1/dashboard/spending-summary?month=2026-03')
            .expect(403)

        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 403,
                message: 'Forbidden',
                error: 'Forbidden',
            }),
        )
    })

    it('rejects invalid month formats', async () => {
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        const response = await agent
            .get('/api/v1/workspaces/workspace-1/dashboard/spending-summary?month=2026/03')
            .expect(400)

        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 400,
                message: ['Month must use YYYY-MM format'],
                error: 'Bad Request',
            }),
        )
    })
})

function createPrismaMock(): PrismaMock {
    const prismaMock: PrismaMock = {
        users: [],
        workspaces: [],
        workspaceMemberships: [],
        categories: [],
        transactions: [],
        auditEvents: [],
        user: {
            findUnique: async ({ where }) => {
                if (where.email) {
                    return (
                        prismaMock.users.find(
                            (user) => user.email.toLowerCase() === where.email!.toLowerCase(),
                        ) ?? null
                    )
                }

                if (where.id) {
                    return prismaMock.users.find((user) => user.id === where.id) ?? null
                }

                return null
            },
        },
        workspace: {
            findUnique: async ({ where }) =>
                prismaMock.workspaces.find((workspace) => workspace.id === where.id) ?? null,
        },
        workspaceMembership: {
            findFirst: async ({ where }) => {
                const membership = prismaMock.workspaceMemberships.find(
                    (entry) =>
                        entry.userId === where.userId && entry.workspaceId === where.workspaceId,
                )

                if (!membership) {
                    return null
                }

                return {
                    role: membership.role,
                    workspace: {
                        id: membership.workspaceId,
                    },
                }
            },
        },
        category: {
            findMany: async ({ where }) =>
                prismaMock.categories
                    .filter((category) => {
                        if (category.workspaceId !== where.workspaceId) {
                            return false
                        }

                        if (!where.id) {
                            return true
                        }

                        return where.id.in.includes(category.id)
                    })
                    .map((category) => ({
                        id: category.id,
                        name: category.name,
                        color: category.color,
                    })),
        },
        transaction: {
            aggregate: async ({ where }) => ({
                _sum: {
                    amount: prismaMock.transactions.reduce((sum, transaction) => {
                        if (
                            transaction.workspaceId !== where.workspaceId ||
                            transaction.deletedAt !== where.deletedAt ||
                            transaction.type !== where.type ||
                            transaction.date < where.date.gte ||
                            transaction.date >= where.date.lt
                        ) {
                            return sum
                        }

                        return sum + transaction.amount
                    }, 0),
                },
            }),
            groupBy: async ({ where }) => {
                const totalsByCategoryId = new Map<string, number>()

                for (const transaction of prismaMock.transactions) {
                    if (
                        transaction.workspaceId !== where.workspaceId ||
                        transaction.deletedAt !== where.deletedAt ||
                        transaction.type !== where.type ||
                        transaction.date < where.date.gte ||
                        transaction.date >= where.date.lt
                    ) {
                        continue
                    }

                    totalsByCategoryId.set(
                        transaction.categoryId,
                        (totalsByCategoryId.get(transaction.categoryId) ?? 0) + transaction.amount,
                    )
                }

                return Array.from(totalsByCategoryId.entries()).map(([categoryId, amount]) => ({
                    categoryId,
                    _sum: {
                        amount,
                    },
                }))
            },
        },
        auditEvent: {
            create: async ({ data }) => {
                const auditEvent: StoredAuditEvent = {
                    id: `audit-${prismaMock.auditEvents.length + 1}`,
                    action: data.action,
                    userId: data.userId ?? null,
                    workspaceId: data.workspaceId ?? null,
                    entityType: data.entityType ?? null,
                    entityId: data.entityId ?? null,
                    metadata: data.metadata ?? null,
                    createdAt: new Date('2026-03-24T12:00:00.000Z'),
                    updatedAt: new Date('2026-03-24T12:00:00.000Z'),
                }

                prismaMock.auditEvents.push(auditEvent)

                return auditEvent
            },
        },
        $connect: async () => undefined,
        $disconnect: async () => undefined,
    }

    return prismaMock
}

async function seedDashboardFixture(prismaMock: PrismaMock): Promise<void> {
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
            id: 'category-child-groceries',
            workspaceId: 'workspace-1',
            parentId: 'category-parent-food',
            name: 'Groceries',
            color: '#16a34a',
            deletedAt: null,
            createdAt: new Date('2026-03-23T10:00:00.000Z'),
            updatedAt: new Date('2026-03-23T10:00:00.000Z'),
        },
        {
            id: 'category-child-dining',
            workspaceId: 'workspace-1',
            parentId: 'category-parent-food',
            name: 'Dining Out',
            color: '#dc2626',
            deletedAt: null,
            createdAt: new Date('2026-03-23T10:00:00.000Z'),
            updatedAt: new Date('2026-03-23T10:00:00.000Z'),
        },
        {
            id: 'category-child-rent',
            workspaceId: 'workspace-1',
            parentId: 'category-parent-housing',
            name: 'Rent',
            color: '#1d4ed8',
            deletedAt: null,
            createdAt: new Date('2026-03-23T10:00:00.000Z'),
            updatedAt: new Date('2026-03-23T10:00:00.000Z'),
        },
        {
            id: 'category-archived',
            workspaceId: 'workspace-1',
            parentId: 'category-parent-legacy',
            name: 'Archived Category',
            color: '#6b7280',
            deletedAt: new Date('2026-03-10T00:00:00.000Z'),
            createdAt: new Date('2026-03-23T10:00:00.000Z'),
            updatedAt: new Date('2026-03-23T10:00:00.000Z'),
        },
    )

    prismaMock.transactions.push(
        {
            id: 'transaction-1',
            workspaceId: 'workspace-1',
            categoryId: 'category-child-groceries',
            paymentSourceId: null,
            type: 'expense',
            amount: 30000,
            currency: 'USD',
            date: new Date('2026-03-03T00:00:00.000Z'),
            notes: null,
            deletedAt: null,
            createdAt: new Date('2026-03-03T00:00:00.000Z'),
            updatedAt: new Date('2026-03-03T00:00:00.000Z'),
        },
        {
            id: 'transaction-2',
            workspaceId: 'workspace-1',
            categoryId: 'category-child-dining',
            paymentSourceId: null,
            type: 'expense',
            amount: 10099,
            currency: 'USD',
            date: new Date('2026-03-08T00:00:00.000Z'),
            notes: null,
            deletedAt: null,
            createdAt: new Date('2026-03-08T00:00:00.000Z'),
            updatedAt: new Date('2026-03-08T00:00:00.000Z'),
        },
        {
            id: 'transaction-3',
            workspaceId: 'workspace-1',
            categoryId: 'category-child-rent',
            paymentSourceId: null,
            type: 'expense',
            amount: 20000,
            currency: 'USD',
            date: new Date('2026-03-01T00:00:00.000Z'),
            notes: null,
            deletedAt: null,
            createdAt: new Date('2026-03-01T00:00:00.000Z'),
            updatedAt: new Date('2026-03-01T00:00:00.000Z'),
        },
        {
            id: 'transaction-4',
            workspaceId: 'workspace-1',
            categoryId: 'category-archived',
            paymentSourceId: null,
            type: 'expense',
            amount: 2500,
            currency: 'USD',
            date: new Date('2026-03-14T00:00:00.000Z'),
            notes: null,
            deletedAt: null,
            createdAt: new Date('2026-03-14T00:00:00.000Z'),
            updatedAt: new Date('2026-03-14T00:00:00.000Z'),
        },
        {
            id: 'transaction-5',
            workspaceId: 'workspace-1',
            categoryId: 'category-child-groceries',
            paymentSourceId: null,
            type: 'expense',
            amount: 40000,
            currency: 'USD',
            date: new Date('2026-02-12T00:00:00.000Z'),
            notes: null,
            deletedAt: null,
            createdAt: new Date('2026-02-12T00:00:00.000Z'),
            updatedAt: new Date('2026-02-12T00:00:00.000Z'),
        },
        {
            id: 'transaction-6',
            workspaceId: 'workspace-1',
            categoryId: 'category-child-groceries',
            paymentSourceId: null,
            type: 'expense',
            amount: 9999,
            currency: 'USD',
            date: new Date('2026-04-01T00:00:00.000Z'),
            notes: null,
            deletedAt: null,
            createdAt: new Date('2026-04-01T00:00:00.000Z'),
            updatedAt: new Date('2026-04-01T00:00:00.000Z'),
        },
        {
            id: 'transaction-7',
            workspaceId: 'workspace-1',
            categoryId: 'category-child-groceries',
            paymentSourceId: null,
            type: 'income',
            amount: 77777,
            currency: 'USD',
            date: new Date('2026-03-15T00:00:00.000Z'),
            notes: null,
            deletedAt: null,
            createdAt: new Date('2026-03-15T00:00:00.000Z'),
            updatedAt: new Date('2026-03-15T00:00:00.000Z'),
        },
        {
            id: 'transaction-8',
            workspaceId: 'workspace-1',
            categoryId: 'category-child-dining',
            paymentSourceId: null,
            type: 'expense',
            amount: 5000,
            currency: 'USD',
            date: new Date('2026-03-18T00:00:00.000Z'),
            notes: null,
            deletedAt: new Date('2026-03-20T00:00:00.000Z'),
            createdAt: new Date('2026-03-18T00:00:00.000Z'),
            updatedAt: new Date('2026-03-20T00:00:00.000Z'),
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
        totpEnabled: false,
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
