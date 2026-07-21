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
        create(args: {
            data: { workspaceId: string; name: string; type: string }
        }): Promise<StoredPaymentSource>
        findFirst(args: {
            where: { workspaceId: string; id: string; deletedAt?: null }
        }): Promise<StoredPaymentSource | null>
        findMany(args: {
            where: { workspaceId: string; deletedAt?: null }
            orderBy: Array<Record<string, 'asc' | 'desc'>>
        }): Promise<StoredPaymentSource[]>
        updateMany(args: {
            where: { workspaceId: string; id: string; deletedAt: null }
            data: { name?: string; type?: string; deletedAt?: Date }
        }): Promise<{ count: number }>
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

describe('Payment sources endpoints (e2e)', () => {
    let app: INestApplication<App>
    let prismaMock: PrismaMock
    const originalSessionSecret = process.env.SESSION_SECRET

    beforeEach(async () => {
        prismaMock = createPrismaMock()
        process.env.SESSION_SECRET = 'test-session-secret'
        jest.useFakeTimers().setSystemTime(new Date('2026-03-24T12:02:00.000Z'))

        await seedPaymentSourcesFixture(prismaMock)

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
        jest.useRealTimers()
    })

    afterAll(() => {
        process.env.SESSION_SECRET = originalSessionSecret
    })

    it('creates, updates, lists, and archives payment sources', async () => {
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        const initialList = await agent
            .get('/api/v1/workspaces/workspace-1/payment-sources')
            .expect(200)

        expect(initialList.body).toEqual([
            {
                id: 'payment-source-1',
                workspace_id: 'workspace-1',
                name: 'Cash Wallet',
                type: 'cash',
                is_archived: false,
                archived_at: null,
                created_at: '2026-03-24T10:00:00.000Z',
                updated_at: '2026-03-24T10:00:00.000Z',
            },
        ])

        const created = await agent.post('/api/v1/workspaces/workspace-1/payment-sources').send({
            name: ' Main Card ',
            type: ' credit_card ',
        })

        expect(created.status).toBe(201)
        expect(created.body).toEqual({
            id: 'payment-source-2',
            workspace_id: 'workspace-1',
            name: 'Main Card',
            type: 'credit_card',
            is_archived: false,
            archived_at: null,
            created_at: '2026-03-24T12:00:00.000Z',
            updated_at: '2026-03-24T12:00:00.000Z',
        })

        const updated = await agent
            .put('/api/v1/workspaces/workspace-1/payment-sources/payment-source-2')
            .send({
                name: 'Travel Card',
                type: 'debit_card',
            })
            .expect(200)

        expect(updated.body).toEqual({
            id: 'payment-source-2',
            workspace_id: 'workspace-1',
            name: 'Travel Card',
            type: 'debit_card',
            is_archived: false,
            archived_at: null,
            created_at: '2026-03-24T12:00:00.000Z',
            updated_at: '2026-03-24T12:01:00.000Z',
        })

        const archived = await agent
            .post('/api/v1/workspaces/workspace-1/payment-sources/payment-source-2/archive')
            .expect(200)

        expect(archived.body).toEqual({
            id: 'payment-source-2',
            workspace_id: 'workspace-1',
            name: 'Travel Card',
            type: 'debit_card',
            is_archived: true,
            archived_at: '2026-03-24T12:02:00.000Z',
            created_at: '2026-03-24T12:00:00.000Z',
            updated_at: '2026-03-24T12:02:00.000Z',
        })

        const activeList = await agent
            .get('/api/v1/workspaces/workspace-1/payment-sources')
            .expect(200)

        expect(activeList.body).toEqual([
            {
                id: 'payment-source-1',
                workspace_id: 'workspace-1',
                name: 'Cash Wallet',
                type: 'cash',
                is_archived: false,
                archived_at: null,
                created_at: '2026-03-24T10:00:00.000Z',
                updated_at: '2026-03-24T10:00:00.000Z',
            },
        ])

        const allSources = await agent
            .get('/api/v1/workspaces/workspace-1/payment-sources?include_archived=true')
            .expect(200)

        expect(allSources.body).toEqual([
            {
                id: 'payment-source-1',
                workspace_id: 'workspace-1',
                name: 'Cash Wallet',
                type: 'cash',
                is_archived: false,
                archived_at: null,
                created_at: '2026-03-24T10:00:00.000Z',
                updated_at: '2026-03-24T10:00:00.000Z',
            },
            {
                id: 'payment-source-2',
                workspace_id: 'workspace-1',
                name: 'Travel Card',
                type: 'debit_card',
                is_archived: true,
                archived_at: '2026-03-24T12:02:00.000Z',
                created_at: '2026-03-24T12:00:00.000Z',
                updated_at: '2026-03-24T12:02:00.000Z',
            },
        ])
    })

    it('returns no default payment sources for a workspace without any custom sources', async () => {
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        const response = await agent
            .get('/api/v1/workspaces/workspace-2/payment-sources')
            .expect(200)

        expect(response.body).toEqual([])
    })

    it('rejects using an archived payment source for a new transaction', async () => {
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        await agent
            .post('/api/v1/workspaces/workspace-1/payment-sources/payment-source-1/archive')
            .expect(200)

        const response = await agent.post('/api/v1/workspaces/workspace-1/transactions').send({
            amount: 12.5,
            date: '2026-03-24',
            category_id: 'category-1',
            payment_source_id: 'payment-source-1',
        })

        expect(response.status).toBe(404)
        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 404,
                message: 'Payment source not found',
                error: 'Not Found',
            }),
        )
    })
})

function createPrismaMock(): PrismaMock {
    const users: StoredUser[] = []
    const workspaces: StoredWorkspace[] = []
    const workspaceMemberships: StoredWorkspaceMembership[] = []
    const categories: StoredCategory[] = []
    const paymentSources: StoredPaymentSource[] = []
    const auditEvents: StoredAuditEvent[] = []
    let paymentSourceSequence = 2
    const paymentSourceTimestamps = [
        new Date('2026-03-24T12:00:00.000Z'),
        new Date('2026-03-24T12:01:00.000Z'),
        new Date('2026-03-24T12:02:00.000Z'),
    ]
    let timestampIndex = 0

    const nextTimestamp = () =>
        paymentSourceTimestamps[timestampIndex++] ?? new Date('2026-03-24T12:03:00.000Z')

    const prismaMock: PrismaMock = {
        users,
        workspaces,
        workspaceMemberships,
        categories,
        paymentSources,
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
            create: async ({ data }) => {
                const timestamp = nextTimestamp()
                const paymentSource: StoredPaymentSource = {
                    id: `payment-source-${paymentSourceSequence++}`,
                    workspaceId: data.workspaceId,
                    name: data.name,
                    type: data.type,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    deletedAt: null,
                }

                paymentSources.push(paymentSource)
                return paymentSource
            },
            findFirst: async ({ where }) =>
                paymentSources.find(
                    (paymentSource) =>
                        paymentSource.workspaceId === where.workspaceId &&
                        paymentSource.id === where.id &&
                        (where.deletedAt === undefined ||
                            paymentSource.deletedAt === where.deletedAt),
                ) ?? null,
            findMany: async ({ where }) =>
                paymentSources
                    .filter(
                        (paymentSource) =>
                            paymentSource.workspaceId === where.workspaceId &&
                            (where.deletedAt === undefined ||
                                paymentSource.deletedAt === where.deletedAt),
                    )
                    .sort((left, right) => {
                        const nameComparison = left.name.localeCompare(right.name)

                        if (nameComparison !== 0) {
                            return nameComparison
                        }

                        return left.id.localeCompare(right.id)
                    }),
            updateMany: async ({ where, data }) => {
                let count = 0

                for (const paymentSource of paymentSources) {
                    if (
                        paymentSource.workspaceId !== where.workspaceId ||
                        paymentSource.id !== where.id ||
                        paymentSource.deletedAt !== where.deletedAt
                    ) {
                        continue
                    }

                    if (data.name !== undefined) {
                        paymentSource.name = data.name
                    }

                    if (data.type !== undefined) {
                        paymentSource.type = data.type
                    }

                    const timestamp = data.deletedAt ?? nextTimestamp()
                    paymentSource.updatedAt = timestamp

                    if (data.deletedAt !== undefined) {
                        paymentSource.deletedAt = data.deletedAt
                    }

                    count += 1
                }

                return { count }
            },
        },
        auditEvent: {
            create: async ({ data }) => {
                const auditEvent: StoredAuditEvent = {
                    id: `audit-event-${auditEvents.length + 1}`,
                    action: data.action,
                    userId: data.userId ?? null,
                    workspaceId: data.workspaceId ?? null,
                    entityType: data.entityType ?? null,
                    entityId: data.entityId ?? null,
                    metadata: data.metadata ?? null,
                    createdAt: new Date('2026-03-24T12:05:00.000Z'),
                    updatedAt: new Date('2026-03-24T12:05:00.000Z'),
                }

                auditEvents.push(auditEvent)
                return auditEvent
            },
        },
        $transaction: async <T>(callback: (tx: PrismaMock) => Promise<T>) => callback(prismaMock),
        $connect: async () => undefined,
        $disconnect: async () => undefined,
    }

    return prismaMock
}

async function seedPaymentSourcesFixture(prismaMock: PrismaMock): Promise<void> {
    prismaMock.users.push(
        await createStoredUser({
            id: 'user-1',
            email: 'ada@example.com',
            password: 'GraniteHarbor!1234',
            emailVerified: true,
        }),
    )

    prismaMock.workspaces.push(
        {
            id: 'workspace-1',
            name: "Ada Lovelace's Finances",
            type: 'personal',
            timezone: 'UTC',
            createdAt: new Date('2026-03-24T09:00:00.000Z'),
            updatedAt: new Date('2026-03-24T09:00:00.000Z'),
        },
        {
            id: 'workspace-2',
            name: 'Project Workspace',
            type: 'personal',
            timezone: 'UTC',
            createdAt: new Date('2026-03-24T09:30:00.000Z'),
            updatedAt: new Date('2026-03-24T09:30:00.000Z'),
        },
    )

    prismaMock.workspaceMemberships.push(
        {
            id: 'membership-1',
            userId: 'user-1',
            workspaceId: 'workspace-1',
            role: 'owner',
            createdAt: new Date('2026-03-24T09:00:00.000Z'),
            updatedAt: new Date('2026-03-24T09:00:00.000Z'),
        },
        {
            id: 'membership-2',
            userId: 'user-1',
            workspaceId: 'workspace-2',
            role: 'owner',
            createdAt: new Date('2026-03-24T09:30:00.000Z'),
            updatedAt: new Date('2026-03-24T09:30:00.000Z'),
        },
    )

    prismaMock.categories.push({
        id: 'category-1',
        workspaceId: 'workspace-1',
        parentId: null,
        name: 'Food',
        color: null,
        icon: null,
        createdAt: new Date('2026-03-24T09:00:00.000Z'),
        updatedAt: new Date('2026-03-24T09:00:00.000Z'),
    })

    prismaMock.paymentSources.push({
        id: 'payment-source-1',
        workspaceId: 'workspace-1',
        name: 'Cash Wallet',
        type: 'cash',
        createdAt: new Date('2026-03-24T10:00:00.000Z'),
        updatedAt: new Date('2026-03-24T10:00:00.000Z'),
        deletedAt: null,
    })
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
        createdAt: new Date('2026-03-24T08:00:00.000Z'),
        updatedAt: new Date('2026-03-24T08:00:00.000Z'),
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
