import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import * as argon2 from 'argon2'
import session from 'express-session'
import { AppModule } from './../src/app.module'
import { AllExceptionsFilter } from './../src/shared/filters/http-exception.filter'
import { PrismaService } from './../src/shared/database/prisma.service'
import { createSessionOptions, SESSION_COOKIE_NAME } from './../src/shared/session/session.config'
import { createCorsOptions } from './../src/shared/http/cors.config'

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
    auditEvents: StoredAuditEvent[]
    user: {
        findUnique(args: { where: { email?: string; id?: string } }): Promise<StoredUser | null>
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

describe('Auth session management (e2e)', () => {
    let app: INestApplication<App>
    let prismaMock: PrismaMock
    const originalSessionSecret = process.env.SESSION_SECRET
    const originalCorsAllowedOrigins = process.env.CORS_ALLOWED_ORIGINS

    beforeEach(async () => {
        prismaMock = createPrismaMock()
        process.env.SESSION_SECRET = 'test-session-secret'
        process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:5173'

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
        app.enableCors(
            createCorsOptions({
                nodeEnv: 'test',
                allowedOrigins: ['http://localhost:5173'],
            }),
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
        process.env.CORS_ALLOWED_ORIGINS = originalCorsAllowedOrigins
    })

    it('creates a session cookie, returns the current user, and clears the cookie on logout', async () => {
        const password = 'GraniteHarbor!1234'
        prismaMock.users.push(
            await createStoredUser({
                id: 'user-1',
                email: 'login@example.com',
                password,
                emailVerified: true,
            }),
        )

        const agent = request.agent(app.getHttpServer())

        const loginResponse = await agent
            .post('/api/v1/auth/login')
            .send({
                email: ' Login@Example.com ',
                password,
            })
            .expect(200)

        expect(loginResponse.body).toEqual({
            id: 'user-1',
            email: 'login@example.com',
            name: 'Ada Lovelace',
            emailVerified: true,
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
        })
        expect(loginResponse.headers['set-cookie']).toEqual(
            expect.arrayContaining([
                expect.stringContaining(`${SESSION_COOKIE_NAME}=`),
                expect.stringContaining('HttpOnly'),
                expect.stringContaining('SameSite=Lax'),
            ]),
        )

        const meResponse = await agent.get('/api/v1/auth/me').expect(200)

        expect(meResponse.body).toEqual({
            id: 'user-1',
            email: 'login@example.com',
            name: 'Ada Lovelace',
            emailVerified: true,
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
        })

        const logoutResponse = await agent.post('/api/v1/auth/logout').expect(200)

        expect(logoutResponse.body).toEqual({
            message: 'Logged out successfully',
        })
        expect(logoutResponse.headers['set-cookie']).toEqual(
            expect.arrayContaining([
                expect.stringContaining(`${SESSION_COOKIE_NAME}=`),
                expect.stringContaining('Expires=Thu, 01 Jan 1970'),
            ]),
        )
        expect(prismaMock.auditEvents).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    action: 'USER_LOGGED_IN',
                    userId: 'user-1',
                    entityType: 'USER',
                    entityId: 'user-1',
                }),
                expect.objectContaining({
                    action: 'USER_LOGGED_OUT',
                    userId: 'user-1',
                    entityType: 'USER',
                    entityId: 'user-1',
                }),
            ]),
        )

        await agent.get('/api/v1/auth/me').expect(401)
    })

    it('returns 401 when the user email is not verified', async () => {
        const password = 'GraniteHarbor!1234'
        prismaMock.users.push(
            await createStoredUser({
                id: 'user-2',
                email: 'pending@example.com',
                password,
                emailVerified: false,
            }),
        )

        const response = await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                email: 'pending@example.com',
                password,
            })
            .expect(401)

        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 401,
                message: 'Email address must be verified before logging in',
                error: 'Unauthorized',
            }),
        )
    })

    it('returns 401 for invalid credentials', async () => {
        prismaMock.users.push(
            await createStoredUser({
                id: 'user-3',
                email: 'verified@example.com',
                password: 'GraniteHarbor!1234',
                emailVerified: true,
            }),
        )

        const response = await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                email: 'verified@example.com',
                password: 'WrongPassword!9999',
            })
            .expect(401)

        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 401,
                message: 'Invalid email or password',
                error: 'Unauthorized',
            }),
        )
    })

    it('protects the current-user route with the session guard', async () => {
        const response = await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401)

        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 401,
                message: 'Authentication required',
                error: 'Unauthorized',
            }),
        )
    })

    it('rate limits repeated login attempts from the same client', async () => {
        for (let attempt = 0; attempt < 5; attempt += 1) {
            await request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .send({
                    email: 'missing@example.com',
                    password: 'GraniteHarbor!1234',
                })
                .expect(401)
        }

        const response = await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                email: 'missing@example.com',
                password: 'GraniteHarbor!1234',
            })
            .expect(429)

        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 429,
                message: 'Too many login attempts. Please try again later.',
                error: 'ThrottlerException',
                stack: expect.any(String),
            }),
        )
    })

    it('returns credentialed CORS headers for allowed frontend origins', async () => {
        const response = await request(app.getHttpServer())
            .options('/api/v1/auth/login')
            .set('Origin', 'http://localhost:5173')
            .set('Access-Control-Request-Method', 'POST')
            .expect(204)

        expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173')
        expect(response.headers['access-control-allow-credentials']).toBe('true')
    })
})

function createPrismaMock(): PrismaMock {
    const users: StoredUser[] = []
    const auditEvents: StoredAuditEvent[] = []
    let auditEventCounter = 0

    return {
        users,
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

async function createStoredUser(input: {
    id: string
    email: string
    password: string
    emailVerified: boolean
}): Promise<StoredUser> {
    const now = new Date('2026-03-22T10:00:00.000Z')

    return {
        id: input.id,
        email: input.email,
        name: 'Ada Lovelace',
        passwordHash: await argon2.hash(input.password, {
            type: argon2.argon2id,
        }),
        emailVerified: input.emailVerified,
        sessionVersion: 0,
        createdAt: now,
        updatedAt: now,
    }
}
