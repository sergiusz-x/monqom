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
    sortOrder: number
    deletedAt: Date | null
    createdAt: Date
    updatedAt: Date
}

interface StoredBudget {
    id: string
    workspaceId: string
    categoryId: string | null
    amount: number
    currency: string
    year: number
    month: number
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
    budgets: StoredBudget[]
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
        findFirst(args: {
            where: { workspaceId: string; id: string; deletedAt: null }
            select?: { id: boolean; parentId: boolean }
        }): Promise<{ id: string; parentId: string | null } | StoredCategory | null>
        findMany(args: {
            where: { workspaceId: string }
            select: { id: boolean; parentId: boolean; name: boolean; sortOrder: boolean }
            orderBy: Array<Record<string, 'asc' | 'desc'>>
        }): Promise<Array<{ id: string; parentId: string | null; name: string; sortOrder: number }>>
    }
    budget: {
        findMany(args: {
            where: { workspaceId: string; year: number; month: number }
            orderBy: Array<Record<string, 'asc' | 'desc'>>
        }): Promise<StoredBudget[]>
        findFirst(args: {
            where: {
                workspaceId: string
                id?: string
                categoryId?: string
                year?: number
                month?: number
            }
        }): Promise<StoredBudget | null>
        create(args: {
            data: {
                workspaceId: string
                categoryId: string
                amount: number
                currency: string
                year: number
                month: number
            }
        }): Promise<StoredBudget>
        updateMany(args: {
            where: { workspaceId: string; id: string }
            data: {
                categoryId: string
                amount: number
                currency: string
                year: number
                month: number
            }
        }): Promise<{ count: number }>
        deleteMany(args: { where: { workspaceId: string; id: string } }): Promise<{ count: number }>
    }
    transaction: {
        groupBy(args: {
            by: ['categoryId']
            where: {
                workspaceId: string
                deletedAt: null
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
    $transaction<T>(callback: (tx: PrismaMock) => Promise<T>): Promise<T>
    $connect(): Promise<void>
    $disconnect(): Promise<void>
}

describe('Budgets endpoints (e2e)', () => {
    let app: INestApplication<App>
    let prismaMock: PrismaMock
    const originalSessionSecret = process.env.SESSION_SECRET

    beforeEach(async () => {
        prismaMock = createPrismaMock()
        process.env.SESSION_SECRET = 'test-session-secret'

        await seedBudgetFixture(prismaMock)

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

    it('supports a create-list-update-delete budget flow for monthly child category budgets', async () => {
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        const createResponse = await agent.post('/api/v1/workspaces/workspace-1/budgets').send({
            amount: 800,
            category_id: 'category-child-groceries',
            year: 2026,
            month: 3,
        })

        expect(createResponse.status).toBe(201)
        expect(createResponse.body).toEqual({
            id: 'budget-1',
            workspace_id: 'workspace-1',
            category_id: 'category-child-groceries',
            amount: 800,
            currency: 'USD',
            year: 2026,
            month: 3,
            created_at: '2026-03-24T12:00:00.000Z',
            updated_at: '2026-03-24T12:00:00.000Z',
        })

        await expect(
            agent.get('/api/v1/workspaces/workspace-1/budgets?year=2026&month=3'),
        ).resolves.toMatchObject({
            status: 200,
            body: [
                {
                    id: 'budget-1',
                    workspace_id: 'workspace-1',
                    category_id: 'category-child-groceries',
                    amount: 800,
                    currency: 'USD',
                    year: 2026,
                    month: 3,
                    created_at: '2026-03-24T12:00:00.000Z',
                    updated_at: '2026-03-24T12:00:00.000Z',
                },
            ],
        })

        const updateResponse = await agent
            .put('/api/v1/workspaces/workspace-1/budgets/budget-1')
            .send({
                amount: 755.25,
                category_id: 'category-child-transport',
                year: 2026,
                month: 4,
            })

        expect(updateResponse.status).toBe(200)
        expect(updateResponse.body).toEqual({
            id: 'budget-1',
            workspace_id: 'workspace-1',
            category_id: 'category-child-transport',
            amount: 755.25,
            currency: 'USD',
            year: 2026,
            month: 4,
            created_at: '2026-03-24T12:00:00.000Z',
            updated_at: '2026-03-24T13:00:00.000Z',
        })

        await expect(
            agent.get('/api/v1/workspaces/workspace-1/budgets?year=2026&month=3'),
        ).resolves.toMatchObject({
            status: 200,
            body: [],
        })

        await expect(
            agent.get('/api/v1/workspaces/workspace-1/budgets?year=2026&month=4'),
        ).resolves.toMatchObject({
            status: 200,
            body: [
                {
                    id: 'budget-1',
                    workspace_id: 'workspace-1',
                    category_id: 'category-child-transport',
                    amount: 755.25,
                    currency: 'USD',
                    year: 2026,
                    month: 4,
                    created_at: '2026-03-24T12:00:00.000Z',
                    updated_at: '2026-03-24T13:00:00.000Z',
                },
            ],
        })

        await agent.delete('/api/v1/workspaces/workspace-1/budgets/budget-1').expect(204)

        await expect(
            agent.get('/api/v1/workspaces/workspace-1/budgets?year=2026&month=4'),
        ).resolves.toMatchObject({
            status: 200,
            body: [],
        })

        expect(prismaMock.auditEvents.map((auditEvent) => auditEvent.action)).toEqual(
            expect.arrayContaining([
                'USER_LOGGED_IN',
                'BUDGET_CREATED',
                'BUDGET_UPDATED',
                'BUDGET_DELETED',
            ]),
        )
    })

    it('returns budget progress including child spending and no-budget categories', async () => {
        prismaMock.budgets.push({
            id: 'budget-parent-food',
            workspaceId: 'workspace-1',
            categoryId: 'category-parent-food',
            amount: 80000,
            currency: 'USD',
            year: 2026,
            month: 3,
            createdAt: new Date('2026-03-24T12:00:00.000Z'),
            updatedAt: new Date('2026-03-24T12:00:00.000Z'),
        })
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
                amount: 20000,
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
                categoryId: 'category-child-transport',
                paymentSourceId: null,
                type: 'expense',
                amount: 15000,
                currency: 'USD',
                date: new Date('2026-03-11T00:00:00.000Z'),
                notes: null,
                deletedAt: null,
                createdAt: new Date('2026-03-11T00:00:00.000Z'),
                updatedAt: new Date('2026-03-11T00:00:00.000Z'),
            },
            {
                id: 'transaction-4',
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
        )

        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        const response = await agent
            .get('/api/v1/workspaces/workspace-1/budgets/progress?month=2026-03')
            .expect(200)

        expect(response.body).toEqual([
            {
                category_id: 'category-parent-food',
                category_name: 'Food',
                budget_amount: 800,
                limit: 800,
                spent: 500,
                remaining: 300,
                percentage: 62.5,
            },
            {
                category_id: 'category-child-dining',
                category_name: 'Dining Out',
                budget_amount: null,
                limit: null,
                spent: 200,
                remaining: null,
                percentage: null,
            },
            {
                category_id: 'category-child-groceries',
                category_name: 'Groceries',
                budget_amount: null,
                limit: null,
                spent: 300,
                remaining: null,
                percentage: null,
            },
            {
                category_id: 'category-parent-transport',
                category_name: 'Transport',
                budget_amount: null,
                limit: null,
                spent: 150,
                remaining: null,
                percentage: null,
            },
            {
                category_id: 'category-child-transport',
                category_name: 'Public Transport',
                budget_amount: null,
                limit: null,
                spent: 150,
                remaining: null,
                percentage: null,
            },
        ])
    })

    it('rejects parent categories for budgets', async () => {
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        const response = await agent.post('/api/v1/workspaces/workspace-1/budgets').send({
            amount: 250,
            category_id: 'category-parent-food',
            year: 2026,
            month: 3,
        })

        expect(response.status).toBe(400)
        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 400,
                message: 'Budget category must be a child category',
                error: 'Bad Request',
            }),
        )
        expect(prismaMock.budgets).toHaveLength(0)
    })

    it('rejects archived and missing categories for budgets', async () => {
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        const archivedResponse = await agent.post('/api/v1/workspaces/workspace-1/budgets').send({
            amount: 250,
            category_id: 'category-child-archived',
            year: 2026,
            month: 3,
        })

        expect(archivedResponse.status).toBe(404)
        expect(archivedResponse.body).toEqual(
            expect.objectContaining({
                statusCode: 404,
                message: 'Category not found',
                error: 'Not Found',
            }),
        )

        const missingResponse = await agent.post('/api/v1/workspaces/workspace-1/budgets').send({
            amount: 250,
            category_id: 'category-missing',
            year: 2026,
            month: 3,
        })

        expect(missingResponse.status).toBe(404)
        expect(missingResponse.body).toEqual(
            expect.objectContaining({
                statusCode: 404,
                message: 'Category not found',
                error: 'Not Found',
            }),
        )
        expect(prismaMock.budgets).toHaveLength(0)
    })

    it('rejects duplicate budgets for the same category and month', async () => {
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        await agent.post('/api/v1/workspaces/workspace-1/budgets').send({
            amount: 250,
            category_id: 'category-child-groceries',
            year: 2026,
            month: 3,
        })

        const duplicateResponse = await agent.post('/api/v1/workspaces/workspace-1/budgets').send({
            amount: 500,
            category_id: 'category-child-groceries',
            year: 2026,
            month: 3,
        })

        expect(duplicateResponse.status).toBe(409)
        expect(duplicateResponse.body).toEqual(
            expect.objectContaining({
                statusCode: 409,
                message: 'Budget already exists for category and month',
                error: 'Conflict',
            }),
        )
        expect(prismaMock.budgets).toHaveLength(1)
    })

    it('rejects budget amounts that exceed supported integer storage', async () => {
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        const createResponse = await agent.post('/api/v1/workspaces/workspace-1/budgets').send({
            amount: 21474836.48,
            category_id: 'category-child-groceries',
            year: 2026,
            month: 3,
        })

        expect(createResponse.status).toBe(400)
        expect(createResponse.body).toEqual(
            expect.objectContaining({
                statusCode: 400,
                message: ['Amount must be less than or equal to 21474836.47'],
                error: 'Bad Request',
            }),
        )
        expect(prismaMock.budgets).toHaveLength(0)

        await agent.post('/api/v1/workspaces/workspace-1/budgets').send({
            amount: 250,
            category_id: 'category-child-groceries',
            year: 2026,
            month: 3,
        })

        const updateResponse = await agent
            .put('/api/v1/workspaces/workspace-1/budgets/budget-1')
            .send({
                amount: '21474836.48',
                category_id: 'category-child-transport',
                year: 2026,
                month: 4,
            })

        expect(updateResponse.status).toBe(400)
        expect(updateResponse.body).toEqual(
            expect.objectContaining({
                statusCode: 400,
                message: ['Amount must be less than or equal to 21474836.47'],
                error: 'Bad Request',
            }),
        )
        expect(prismaMock.budgets).toHaveLength(1)
        expect(prismaMock.budgets[0]).toEqual(
            expect.objectContaining({
                id: 'budget-1',
                categoryId: 'category-child-groceries',
                amount: 25000,
                year: 2026,
                month: 3,
            }),
        )
    })

    it('rejects updates that would duplicate another budget for the same category and month', async () => {
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        await agent.post('/api/v1/workspaces/workspace-1/budgets').send({
            amount: 250,
            category_id: 'category-child-groceries',
            year: 2026,
            month: 3,
        })

        await agent.post('/api/v1/workspaces/workspace-1/budgets').send({
            amount: 400,
            category_id: 'category-child-transport',
            year: 2026,
            month: 4,
        })

        const response = await agent.put('/api/v1/workspaces/workspace-1/budgets/budget-2').send({
            amount: 500,
            category_id: 'category-child-groceries',
            year: 2026,
            month: 3,
        })

        expect(response.status).toBe(409)
        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 409,
                message: 'Budget already exists for category and month',
                error: 'Conflict',
            }),
        )
        expect(prismaMock.budgets).toHaveLength(2)
        expect(prismaMock.budgets[1]).toEqual(
            expect.objectContaining({
                id: 'budget-2',
                categoryId: 'category-child-transport',
                amount: 40000,
                year: 2026,
                month: 4,
            }),
        )
    })

    it('returns 404 when the workspace does not exist', async () => {
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        const response = await agent
            .get('/api/v1/workspaces/workspace-missing/budgets?year=2026&month=3')
            .expect(404)

        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 404,
                message: 'Workspace not found',
                error: 'Not Found',
            }),
        )
    })

    it('returns 404 for a missing budget id', async () => {
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        const response = await agent
            .put('/api/v1/workspaces/workspace-1/budgets/budget-missing')
            .send({
                amount: 250,
                category_id: 'category-child-groceries',
                year: 2026,
                month: 3,
            })

        expect(response.status).toBe(404)
        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 404,
                message: 'Budget not found',
                error: 'Not Found',
            }),
        )
    })

    it('requires authentication for budget endpoints', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/workspaces/workspace-1/budgets?year=2026&month=3')
            .expect(401)

        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 401,
                message: 'Authentication required',
                error: 'Unauthorized',
            }),
        )
    })

    it('forbids non-members from accessing workspace budgets', async () => {
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
            .get('/api/v1/workspaces/workspace-1/budgets?year=2026&month=3')
            .expect(403)

        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 403,
                message: 'Forbidden',
                error: 'Forbidden',
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
        budgets: [],
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
            findFirst: async ({ where, select }) => {
                const category =
                    prismaMock.categories.find(
                        (entry) =>
                            entry.workspaceId === where.workspaceId &&
                            entry.id === where.id &&
                            entry.deletedAt === where.deletedAt,
                    ) ?? null

                if (!category) {
                    return null
                }

                if (select) {
                    return {
                        id: category.id,
                        parentId: category.parentId,
                    }
                }

                return category
            },
            findMany: async ({ where }) =>
                prismaMock.categories
                    .filter((entry) => entry.workspaceId === where.workspaceId)
                    .sort((left, right) => {
                        if (left.sortOrder !== right.sortOrder) {
                            return left.sortOrder - right.sortOrder
                        }

                        const nameComparison = left.name.localeCompare(right.name)

                        if (nameComparison !== 0) {
                            return nameComparison
                        }

                        return left.id.localeCompare(right.id)
                    })
                    .map((category) => ({
                        id: category.id,
                        parentId: category.parentId,
                        name: category.name,
                        sortOrder: category.sortOrder,
                    })),
        },
        budget: {
            findMany: async ({ where }) =>
                prismaMock.budgets
                    .filter(
                        (budget) =>
                            budget.workspaceId === where.workspaceId &&
                            budget.year === where.year &&
                            budget.month === where.month,
                    )
                    .sort((left, right) => {
                        const leftCategoryId = left.categoryId ?? ''
                        const rightCategoryId = right.categoryId ?? ''
                        const categoryComparison = leftCategoryId.localeCompare(rightCategoryId)

                        if (categoryComparison !== 0) {
                            return categoryComparison
                        }

                        return left.id.localeCompare(right.id)
                    }),
            findFirst: async ({ where }) =>
                prismaMock.budgets.find(
                    (budget) =>
                        budget.workspaceId === where.workspaceId &&
                        (where.id === undefined || budget.id === where.id) &&
                        (where.categoryId === undefined ||
                            budget.categoryId === where.categoryId) &&
                        (where.year === undefined || budget.year === where.year) &&
                        (where.month === undefined || budget.month === where.month),
                ) ?? null,
            create: async ({ data }) => {
                const createdAt = new Date('2026-03-24T12:00:00.000Z')
                const budget: StoredBudget = {
                    id: `budget-${prismaMock.budgets.length + 1}`,
                    workspaceId: data.workspaceId,
                    categoryId: data.categoryId,
                    amount: data.amount,
                    currency: data.currency,
                    year: data.year,
                    month: data.month,
                    createdAt,
                    updatedAt: createdAt,
                }

                prismaMock.budgets.push(budget)

                return budget
            },
            updateMany: async ({ where, data }) => {
                const budget = prismaMock.budgets.find(
                    (entry) => entry.workspaceId === where.workspaceId && entry.id === where.id,
                )

                if (!budget) {
                    return { count: 0 }
                }

                budget.categoryId = data.categoryId
                budget.amount = data.amount
                budget.currency = data.currency
                budget.year = data.year
                budget.month = data.month
                budget.updatedAt = new Date('2026-03-24T13:00:00.000Z')

                return { count: 1 }
            },
            deleteMany: async ({ where }) => {
                const index = prismaMock.budgets.findIndex(
                    (entry) => entry.workspaceId === where.workspaceId && entry.id === where.id,
                )

                if (index === -1) {
                    return { count: 0 }
                }

                prismaMock.budgets.splice(index, 1)

                return { count: 1 }
            },
        },
        transaction: {
            groupBy: async ({ where }) => {
                const totalsByCategoryId = new Map<string, number>()

                for (const transaction of prismaMock.transactions) {
                    if (
                        transaction.workspaceId !== where.workspaceId ||
                        transaction.deletedAt !== where.deletedAt ||
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
        $transaction: async <T>(callback: (tx: PrismaMock) => Promise<T>) => callback(prismaMock),
        $connect: async () => undefined,
        $disconnect: async () => undefined,
    }

    return prismaMock
}

async function seedBudgetFixture(prismaMock: PrismaMock): Promise<void> {
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
            id: 'category-parent-food',
            workspaceId: 'workspace-1',
            parentId: null,
            name: 'Food',
            sortOrder: 1,
            deletedAt: null,
            createdAt: new Date('2026-03-23T10:00:00.000Z'),
            updatedAt: new Date('2026-03-23T10:00:00.000Z'),
        },
        {
            id: 'category-child-groceries',
            workspaceId: 'workspace-1',
            parentId: 'category-parent-food',
            name: 'Groceries',
            sortOrder: 3,
            deletedAt: null,
            createdAt: new Date('2026-03-23T10:00:00.000Z'),
            updatedAt: new Date('2026-03-23T10:00:00.000Z'),
        },
        {
            id: 'category-child-dining',
            workspaceId: 'workspace-1',
            parentId: 'category-parent-food',
            name: 'Dining Out',
            sortOrder: 2,
            deletedAt: null,
            createdAt: new Date('2026-03-23T10:00:00.000Z'),
            updatedAt: new Date('2026-03-23T10:00:00.000Z'),
        },
        {
            id: 'category-parent-transport',
            workspaceId: 'workspace-1',
            parentId: null,
            name: 'Transport',
            sortOrder: 4,
            deletedAt: null,
            createdAt: new Date('2026-03-23T10:00:00.000Z'),
            updatedAt: new Date('2026-03-23T10:00:00.000Z'),
        },
        {
            id: 'category-child-transport',
            workspaceId: 'workspace-1',
            parentId: 'category-parent-transport',
            name: 'Public Transport',
            sortOrder: 5,
            deletedAt: null,
            createdAt: new Date('2026-03-23T10:00:00.000Z'),
            updatedAt: new Date('2026-03-23T10:00:00.000Z'),
        },
        {
            id: 'category-child-archived',
            workspaceId: 'workspace-1',
            parentId: 'category-parent-food',
            name: 'Archived Child',
            sortOrder: 6,
            deletedAt: new Date('2026-03-22T10:00:00.000Z'),
            createdAt: new Date('2026-03-23T10:00:00.000Z'),
            updatedAt: new Date('2026-03-23T10:00:00.000Z'),
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
