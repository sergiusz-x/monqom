import { Controller, Get, INestApplication, Req, UseGuards } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as argon2 from 'argon2'
import session from 'express-session'
import type { Request } from 'express'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from './../src/app.module'
import { AuthRepository } from './../src/modules/auth/auth.repository'
import { WorkspaceRepository } from './../src/modules/workspace/workspace.repository'
import { PrismaService } from './../src/shared/database/prisma.service'
import { AllExceptionsFilter } from './../src/shared/filters/http-exception.filter'
import { SessionGuard } from './../src/shared/guards/session.guard'
import { WorkspaceGuard } from './../src/shared/guards/workspace.guard'
import { createSessionOptions } from './../src/shared/session/session.config'

@Controller('workspace-guard-test')
class WorkspaceGuardTestController {
    @Get('active')
    @UseGuards(SessionGuard, WorkspaceGuard)
    getActiveWorkspace(@Req() req: Request) {
        return req.workspace
    }
}

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
    auditEvents: StoredAuditEvent[]
    user: {
        findUnique(args: { where: { email?: string; id?: string } }): Promise<StoredUser | null>
    }
    workspace: {
        findMany(args: {
            where: {
                memberships: {
                    some: {
                        userId: string
                    }
                }
            }
        }): Promise<StoredWorkspace[]>
        findUnique(args: { where: { id: string } }): Promise<StoredWorkspace | null>
    }
    workspaceMembership: {
        findFirst(args: {
            where: { userId: string; workspaceId: string }
            select: { role: boolean; workspace: { select: { id: boolean } } }
        }): Promise<{ role: string; workspace: { id: string } } | null>
        count(args: { where: { userId: string; workspaceId: string } }): Promise<number>
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

describe('Workspace membership endpoints (e2e)', () => {
    let app: INestApplication<App>
    let prismaMock: PrismaMock
    const originalSessionSecret = process.env.SESSION_SECRET

    beforeEach(async () => {
        prismaMock = createPrismaMock()
        process.env.SESSION_SECRET = 'test-session-secret'

        await seedWorkspaceFixture(prismaMock)

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
            controllers: [WorkspaceGuardTestController],
            providers: [AuthRepository, WorkspaceRepository, SessionGuard, WorkspaceGuard],
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

    it('lists the workspaces the authenticated user belongs to', async () => {
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        const response = await agent.get('/api/v1/workspaces').expect(200)

        expect(response.body).toEqual([
            {
                id: 'workspace-1',
                name: "Ada Lovelace's Finances",
                type: 'personal',
                timezone: 'UTC',
                createdAt: '2026-03-23T10:00:00.000Z',
                updatedAt: '2026-03-23T10:00:00.000Z',
            },
        ])
    })

    it('returns workspace details for members and forbids access for non-members', async () => {
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        const workspaceResponse = await agent.get('/api/v1/workspaces/workspace-1').expect(200)

        expect(workspaceResponse.body).toEqual({
            id: 'workspace-1',
            name: "Ada Lovelace's Finances",
            type: 'personal',
            timezone: 'UTC',
            createdAt: '2026-03-23T10:00:00.000Z',
            updatedAt: '2026-03-23T10:00:00.000Z',
        })

        const forbiddenResponse = await agent.get('/api/v1/workspaces/workspace-2').expect(403)

        expect(forbiddenResponse.body).toEqual(
            expect.objectContaining({
                statusCode: 403,
                message: 'Forbidden',
                error: 'Forbidden',
            }),
        )

        const missingWorkspaceResponse = await agent
            .get('/api/v1/workspaces/workspace-9')
            .expect(404)

        expect(missingWorkspaceResponse.body).toEqual(
            expect.objectContaining({
                statusCode: 404,
                message: 'Workspace not found',
                error: 'Not Found',
            }),
        )
    })

    it('accepts workspace id from the x-workspace-id header when route params are absent', async () => {
        const agent = await authenticateAs(app, 'ada@example.com', 'GraniteHarbor!1234')

        const response = await agent
            .get('/api/v1/workspace-guard-test/active')
            .set('x-workspace-id', ' workspace-1 ')
            .expect(200)

        expect(response.body).toEqual({
            workspaceId: 'workspace-1',
            role: 'owner',
        })
    })
})

function createPrismaMock(): PrismaMock {
    const users: StoredUser[] = []
    const workspaces: StoredWorkspace[] = []
    const workspaceMemberships: StoredWorkspaceMembership[] = []
    const auditEvents: StoredAuditEvent[] = []
    let auditEventCounter = 0

    return {
        users,
        workspaces,
        workspaceMemberships,
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
            findMany: async ({ where }) => {
                const accessibleWorkspaceIds = new Set(
                    workspaceMemberships
                        .filter((membership) => membership.userId === where.memberships.some.userId)
                        .map((membership) => membership.workspaceId),
                )

                return workspaces
                    .filter((workspace) => accessibleWorkspaceIds.has(workspace.id))
                    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
            },
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
            count: async ({ where }) =>
                workspaceMemberships.filter(
                    (membership) =>
                        membership.userId === where.userId &&
                        membership.workspaceId === where.workspaceId,
                ).length,
        },
        auditEvent: {
            create: async ({ data }) => {
                auditEventCounter += 1

                const auditEvent: StoredAuditEvent = {
                    id: `audit-event-${auditEventCounter}`,
                    action: data.action,
                    userId: data.userId ?? null,
                    workspaceId: data.workspaceId ?? null,
                    entityType: data.entityType ?? null,
                    entityId: data.entityId ?? null,
                    metadata: data.metadata ?? null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }

                auditEvents.push(auditEvent)
                return auditEvent
            },
        },
        $connect: async () => undefined,
        $disconnect: async () => undefined,
    }
}

async function seedWorkspaceFixture(prismaMock: PrismaMock): Promise<void> {
    prismaMock.users.push(
        await createStoredUser({
            id: 'user-1',
            email: 'ada@example.com',
            password: 'GraniteHarbor!1234',
            emailVerified: true,
        }),
        await createStoredUser({
            id: 'user-2',
            email: 'grace@example.com',
            password: 'GraniteHarbor!1234',
            emailVerified: true,
            name: 'Grace Hopper',
        }),
    )

    prismaMock.workspaces.push(
        {
            id: 'workspace-1',
            name: "Ada Lovelace's Finances",
            type: 'personal',
            timezone: 'UTC',
            createdAt: new Date('2026-03-23T10:00:00.000Z'),
            updatedAt: new Date('2026-03-23T10:00:00.000Z'),
        },
        {
            id: 'workspace-2',
            name: "Grace Hopper's Finances",
            type: 'personal',
            timezone: 'Europe/Warsaw',
            createdAt: new Date('2026-03-23T11:00:00.000Z'),
            updatedAt: new Date('2026-03-23T11:00:00.000Z'),
        },
    )

    prismaMock.workspaceMemberships.push(
        {
            id: 'membership-1',
            userId: 'user-1',
            workspaceId: 'workspace-1',
            role: 'owner',
            createdAt: new Date('2026-03-23T10:00:00.000Z'),
            updatedAt: new Date('2026-03-23T10:00:00.000Z'),
        },
        {
            id: 'membership-2',
            userId: 'user-2',
            workspaceId: 'workspace-2',
            role: 'owner',
            createdAt: new Date('2026-03-23T11:00:00.000Z'),
            updatedAt: new Date('2026-03-23T11:00:00.000Z'),
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
