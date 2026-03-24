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
    sortOrder: number
    createdAt: Date
    updatedAt: Date
    deletedAt: Date | null
}

interface PrismaMock {
    users: StoredUser[]
    workspaces: StoredWorkspace[]
    workspaceMemberships: StoredWorkspaceMembership[]
    categories: StoredCategory[]
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
            where: { workspaceId: string; deletedAt?: null }
            select: {
                id: boolean
                parentId: boolean
                name: boolean
                icon: boolean
                sortOrder: boolean
                deletedAt: boolean
            }
            orderBy: Array<Record<string, 'asc' | 'desc'>>
        }): Promise<
            Array<{
                id: string
                parentId: string | null
                name: string
                icon: string | null
                sortOrder: number
                deletedAt: Date | null
            }>
        >
        findFirst(args: {
            where: { workspaceId: string; id: string; deletedAt?: null }
            select: {
                id: boolean
                parentId: boolean
                name: boolean
                icon: boolean
                sortOrder: boolean
                deletedAt: boolean
            }
        }): Promise<{
            id: string
            parentId: string | null
            name: string
            icon: string | null
            sortOrder: number
            deletedAt: Date | null
        } | null>
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
        }): Promise<void>
    }
    $connect(): Promise<void>
    $disconnect(): Promise<void>
}

describe('Categories endpoints (e2e)', () => {
    let app: INestApplication<App>
    let prismaMock: PrismaMock
    const originalSessionSecret = process.env.SESSION_SECRET

    beforeEach(async () => {
        prismaMock = createPrismaMock()
        process.env.SESSION_SECRET = 'test-session-secret'

        await seedCategoriesFixture(prismaMock)

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

    it('lists seeded categories as parents with nested children and excludes archived ones by default', async () => {
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        const response = await agent.get('/api/v1/workspaces/workspace-1/categories').expect(200)

        expect(response.body).toEqual([
            {
                id: 'category-parent-food',
                name: 'Food',
                icon: '🍽️',
                parent_id: null,
                sort_order: 1,
                children: [
                    {
                        id: 'category-child-groceries',
                        name: 'Groceries',
                        icon: '🛒',
                        parent_id: 'category-parent-food',
                        sort_order: 1,
                        children: [],
                    },
                    {
                        id: 'category-child-restaurants',
                        name: 'Restaurants',
                        icon: '🍝',
                        parent_id: 'category-parent-food',
                        sort_order: 2,
                        children: [],
                    },
                ],
            },
            {
                id: 'category-parent-transport',
                name: 'Transport',
                icon: '🚗',
                parent_id: null,
                sort_order: 2,
                children: [
                    {
                        id: 'category-child-fuel',
                        name: 'Fuel',
                        icon: '⛽',
                        parent_id: 'category-parent-transport',
                        sort_order: 1,
                        children: [],
                    },
                ],
            },
        ])
    })

    it('includes archived categories when include_archived=true', async () => {
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        const response = await agent
            .get('/api/v1/workspaces/workspace-1/categories?include_archived=true')
            .expect(200)

        expect(response.body).toEqual(
            expect.arrayContaining([
                {
                    id: 'category-parent-entertainment',
                    name: 'Entertainment',
                    icon: '🎬',
                    parent_id: null,
                    sort_order: 3,
                    children: [
                        {
                            id: 'category-child-streaming',
                            name: 'Streaming',
                            icon: '📺',
                            parent_id: 'category-parent-entertainment',
                            sort_order: 1,
                            children: [],
                        },
                    ],
                },
            ]),
        )
    })

    it('returns a single parent category with nested children', async () => {
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        const response = await agent
            .get('/api/v1/workspaces/workspace-1/categories/category-parent-food')
            .expect(200)

        expect(response.body).toEqual({
            id: 'category-parent-food',
            name: 'Food',
            icon: '🍽️',
            parent_id: null,
            sort_order: 1,
            children: [
                {
                    id: 'category-child-groceries',
                    name: 'Groceries',
                    icon: '🛒',
                    parent_id: 'category-parent-food',
                    sort_order: 1,
                    children: [],
                },
                {
                    id: 'category-child-restaurants',
                    name: 'Restaurants',
                    icon: '🍝',
                    parent_id: 'category-parent-food',
                    sort_order: 2,
                    children: [],
                },
            ],
        })
    })

    it('hides archived categories from the single-category endpoint unless requested', async () => {
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        await agent
            .get('/api/v1/workspaces/workspace-1/categories/category-parent-entertainment')
            .expect(404)

        const response = await agent
            .get(
                '/api/v1/workspaces/workspace-1/categories/' +
                    'category-parent-entertainment?include_archived=true',
            )
            .expect(200)

        expect(response.body).toEqual({
            id: 'category-parent-entertainment',
            name: 'Entertainment',
            icon: '🎬',
            parent_id: null,
            sort_order: 3,
            children: [
                {
                    id: 'category-child-streaming',
                    name: 'Streaming',
                    icon: '📺',
                    parent_id: 'category-parent-entertainment',
                    sort_order: 1,
                    children: [],
                },
            ],
        })
    })

    it('returns a single child category with an empty children array', async () => {
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        const response = await agent
            .get('/api/v1/workspaces/workspace-1/categories/category-child-groceries')
            .expect(200)

        expect(response.body).toEqual({
            id: 'category-child-groceries',
            name: 'Groceries',
            icon: '🛒',
            parent_id: 'category-parent-food',
            sort_order: 1,
            children: [],
        })
    })

    it('rejects invalid include_archived query values', async () => {
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        const response = await agent
            .get('/api/v1/workspaces/workspace-1/categories?include_archived=maybe')
            .expect(400)

        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 400,
                message: 'include_archived must be true or false',
                error: 'Bad Request',
            }),
        )
    })
})

function createPrismaMock(): PrismaMock {
    const users: StoredUser[] = []
    const workspaces: StoredWorkspace[] = []
    const workspaceMemberships: StoredWorkspaceMembership[] = []
    const categories: StoredCategory[] = []

    return {
        users,
        workspaces,
        workspaceMemberships,
        categories,
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
            findMany: async ({ where }) =>
                categories
                    .filter(
                        (category) =>
                            category.workspaceId === where.workspaceId &&
                            (where.deletedAt === undefined ||
                                category.deletedAt === where.deletedAt),
                    )
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
                        icon: category.icon,
                        sortOrder: category.sortOrder,
                        deletedAt: category.deletedAt,
                    })),
            findFirst: async ({ where }) => {
                const category = categories.find(
                    (entry) =>
                        entry.workspaceId === where.workspaceId &&
                        entry.id === where.id &&
                        (where.deletedAt === undefined || entry.deletedAt === where.deletedAt),
                )

                if (!category) {
                    return null
                }

                return {
                    id: category.id,
                    parentId: category.parentId,
                    name: category.name,
                    icon: category.icon,
                    sortOrder: category.sortOrder,
                    deletedAt: category.deletedAt,
                }
            },
        },
        auditEvent: {
            create: async () => undefined,
        },
        $connect: async () => undefined,
        $disconnect: async () => undefined,
    }
}

async function seedCategoriesFixture(prismaMock: PrismaMock): Promise<void> {
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
        createStoredCategory({
            id: 'category-parent-food',
            parentId: null,
            name: 'Food',
            icon: '🍽️',
            sortOrder: 1,
        }),
        createStoredCategory({
            id: 'category-child-groceries',
            parentId: 'category-parent-food',
            name: 'Groceries',
            icon: '🛒',
            sortOrder: 1,
        }),
        createStoredCategory({
            id: 'category-child-restaurants',
            parentId: 'category-parent-food',
            name: 'Restaurants',
            icon: '🍝',
            sortOrder: 2,
        }),
        createStoredCategory({
            id: 'category-parent-transport',
            parentId: null,
            name: 'Transport',
            icon: '🚗',
            sortOrder: 2,
        }),
        createStoredCategory({
            id: 'category-child-fuel',
            parentId: 'category-parent-transport',
            name: 'Fuel',
            icon: '⛽',
            sortOrder: 1,
        }),
        createStoredCategory({
            id: 'category-parent-entertainment',
            parentId: null,
            name: 'Entertainment',
            icon: '🎬',
            sortOrder: 3,
            deletedAt: new Date('2026-03-24T12:00:00.000Z'),
        }),
        createStoredCategory({
            id: 'category-child-streaming',
            parentId: 'category-parent-entertainment',
            name: 'Streaming',
            icon: '📺',
            sortOrder: 1,
            deletedAt: new Date('2026-03-24T12:00:00.000Z'),
        }),
    )
}

function createStoredCategory(input: {
    id: string
    parentId: string | null
    name: string
    icon: string
    sortOrder: number
    deletedAt?: Date | null
}): StoredCategory {
    return {
        id: input.id,
        workspaceId: 'workspace-1',
        parentId: input.parentId,
        name: input.name,
        color: null,
        icon: input.icon,
        sortOrder: input.sortOrder,
        createdAt: new Date('2026-03-23T10:00:00.000Z'),
        updatedAt: new Date('2026-03-23T10:00:00.000Z'),
        deletedAt: input.deletedAt ?? null,
    }
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
