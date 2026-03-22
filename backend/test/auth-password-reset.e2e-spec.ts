import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import * as argon2 from 'argon2'
import session from 'express-session'
import { AppModule } from './../src/app.module'
import { AllExceptionsFilter } from './../src/shared/filters/http-exception.filter'
import { PrismaService } from './../src/shared/database/prisma.service'
import { logger } from './../src/shared/utils/logger'
import { createSessionOptions } from './../src/shared/session/session.config'

jest.mock('./../src/shared/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    },
}))

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

interface StoredPasswordResetToken {
    id: string
    userId: string
    token: string
    expiresAt: Date
    usedAt: Date | null
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

interface FakeTransactionClient {
    user: {
        findUnique(args: { where: { email?: string; id?: string } }): Promise<StoredUser | null>
        update(args: {
            where: { id: string }
            data: {
                passwordHash?: string
                sessionVersion?: {
                    increment: number
                }
            }
        }): Promise<StoredUser>
    }
    passwordResetToken: {
        findUnique(args: {
            where: { token: string }
            include: { user: true }
        }): Promise<(StoredPasswordResetToken & { user: StoredUser }) | null>
        create(args: {
            data: Pick<StoredPasswordResetToken, 'userId' | 'token' | 'expiresAt'>
        }): Promise<StoredPasswordResetToken>
        updateMany(args: {
            where: {
                id?: string
                userId: string
                usedAt: null
                expiresAt?: {
                    gt: Date
                }
            }
            data: Pick<StoredPasswordResetToken, 'usedAt'>
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
    $executeRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<number>
}

interface PrismaMock extends FakeTransactionClient {
    users: StoredUser[]
    passwordResetTokens: StoredPasswordResetToken[]
    auditEvents: StoredAuditEvent[]
    deletedSessionUserIds: string[]
    failSessionDeletionWithMissingTable: boolean
    $transaction<T>(callback: (tx: FakeTransactionClient) => Promise<T>): Promise<T>
    $connect(): Promise<void>
    $disconnect(): Promise<void>
}

describe('Auth password reset (e2e)', () => {
    let app: INestApplication<App>
    let prismaMock: PrismaMock
    const originalNodeEnv = process.env.NODE_ENV
    const originalSessionSecret = process.env.SESSION_SECRET

    beforeEach(async () => {
        prismaMock = createPrismaMock()
        jest.clearAllMocks()
        process.env.NODE_ENV = 'test'
        process.env.SESSION_SECRET = 'test-session-secret'

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
        process.env.NODE_ENV = originalNodeEnv
        process.env.SESSION_SECRET = originalSessionSecret
    })

    it('resets the password, invalidates existing sessions, and records an audit event', async () => {
        const oldPassword = 'GraniteHarbor!1234'
        const newPassword = 'OceanStoneBridge!1234'
        const now = Date.now()

        process.env.NODE_ENV = 'development'

        prismaMock.users.push(
            await createStoredUser({
                id: 'user-1',
                email: 'reset@example.com',
                password: oldPassword,
                emailVerified: true,
            }),
        )

        const existingSessionAgent = request.agent(app.getHttpServer())

        await existingSessionAgent
            .post('/api/v1/auth/login')
            .send({
                email: 'reset@example.com',
                password: oldPassword,
            })
            .expect(200)

        const forgotPasswordResponse = await request(app.getHttpServer())
            .post('/api/v1/auth/forgot-password')
            .send({
                email: ' Reset@Example.com ',
            })
            .expect(200)

        expect(forgotPasswordResponse.body).toEqual({
            message:
                'If an account with that email exists, a password reset link has been generated',
        })
        expect(prismaMock.passwordResetTokens).toHaveLength(1)
        expect(prismaMock.passwordResetTokens[0].usedAt).toBeNull()
        expect(
            Math.abs(
                prismaMock.passwordResetTokens[0].expiresAt.getTime() - (now + 60 * 60 * 1000),
            ),
        ).toBeLessThanOrEqual(5000)

        const resetToken = getLoggedPasswordResetToken()

        const resetPasswordResponse = await request(app.getHttpServer())
            .post('/api/v1/auth/reset-password')
            .send({
                token: resetToken,
                newPassword,
            })
            .expect(200)

        expect(resetPasswordResponse.body).toEqual({
            message: 'Password reset successfully',
        })

        const storedUser = prismaMock.users[0]

        await expect(argon2.verify(storedUser.passwordHash, newPassword)).resolves.toBe(true)
        expect(storedUser.sessionVersion).toBe(1)
        expect(prismaMock.passwordResetTokens[0].usedAt).toBeInstanceOf(Date)
        expect(prismaMock.deletedSessionUserIds).toContain('user-1')
        expect(prismaMock.auditEvents).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    action: 'USER_PASSWORD_RESET',
                    userId: 'user-1',
                    entityType: 'USER',
                    entityId: 'user-1',
                    metadata: {
                        source: 'PASSWORD_RESET_TOKEN',
                    },
                }),
            ]),
        )

        await existingSessionAgent.get('/api/v1/auth/me').expect(401)

        await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                email: 'reset@example.com',
                password: oldPassword,
            })
            .expect(401)

        await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                email: 'reset@example.com',
                password: newPassword,
            })
            .expect(200)

        await request(app.getHttpServer())
            .post('/api/v1/auth/reset-password')
            .send({
                token: resetToken,
                newPassword: 'AnotherOceanStone!1234',
            })
            .expect(400)
    })

    it('always returns 200 for unknown accounts without generating a reset token', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/v1/auth/forgot-password')
            .send({
                email: 'missing@example.com',
            })
            .expect(200)

        expect(response.body).toEqual({
            message:
                'If an account with that email exists, a password reset link has been generated',
        })
        expect(prismaMock.passwordResetTokens).toHaveLength(0)
        expect(prismaMock.auditEvents).toHaveLength(0)
    })

    it('rejects expired password reset tokens', async () => {
        prismaMock.users.push(
            await createStoredUser({
                id: 'user-1',
                email: 'reset@example.com',
                password: 'GraniteHarbor!1234',
                emailVerified: true,
            }),
        )

        await request(app.getHttpServer())
            .post('/api/v1/auth/forgot-password')
            .send({
                email: 'reset@example.com',
            })
            .expect(200)

        prismaMock.passwordResetTokens[0].expiresAt = new Date(Date.now() - 1000)

        const response = await request(app.getHttpServer())
            .post('/api/v1/auth/reset-password')
            .send({
                token: prismaMock.passwordResetTokens[0].token,
                newPassword: 'OceanStoneBridge!1234',
            })
            .expect(400)

        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 400,
                message: 'Password reset token is invalid or expired',
                error: 'Bad Request',
            }),
        )
        expect(prismaMock.passwordResetTokens[0].usedAt).toBeNull()
        expect(prismaMock.users[0].sessionVersion).toBe(0)
    })

    it('rejects unknown password reset tokens', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/v1/auth/reset-password')
            .send({
                token: 'missing-password-reset-token',
                newPassword: 'OceanStoneBridge!1234',
            })
            .expect(400)

        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 400,
                message: 'Password reset token is invalid or expired',
                error: 'Bad Request',
            }),
        )
        expect(prismaMock.passwordResetTokens).toHaveLength(0)
        expect(prismaMock.auditEvents).toHaveLength(0)
    })

    it('still resets the password when the postgres session table is unavailable', async () => {
        prismaMock.failSessionDeletionWithMissingTable = true
        prismaMock.users.push(
            await createStoredUser({
                id: 'user-1',
                email: 'reset@example.com',
                password: 'GraniteHarbor!1234',
                emailVerified: true,
            }),
        )

        await request(app.getHttpServer())
            .post('/api/v1/auth/forgot-password')
            .send({
                email: 'reset@example.com',
            })
            .expect(200)

        const response = await request(app.getHttpServer())
            .post('/api/v1/auth/reset-password')
            .send({
                token: prismaMock.passwordResetTokens[0].token,
                newPassword: 'OceanStoneBridge!1234',
            })
            .expect(200)

        expect(response.body).toEqual({
            message: 'Password reset successfully',
        })
        expect(prismaMock.passwordResetTokens[0].usedAt).toBeInstanceOf(Date)
        expect(prismaMock.users[0].sessionVersion).toBe(1)
        expect(prismaMock.auditEvents).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    action: 'USER_PASSWORD_RESET',
                    userId: 'user-1',
                }),
            ]),
        )
    })

    it('validates new passwords with the same rules as registration', async () => {
        prismaMock.users.push(
            await createStoredUser({
                id: 'user-1',
                email: 'reset@example.com',
                password: 'GraniteHarbor!1234',
                emailVerified: true,
            }),
        )

        await request(app.getHttpServer())
            .post('/api/v1/auth/forgot-password')
            .send({
                email: 'reset@example.com',
            })
            .expect(200)

        const response = await request(app.getHttpServer())
            .post('/api/v1/auth/reset-password')
            .send({
                token: prismaMock.passwordResetTokens[0].token,
                newPassword: 'weak',
            })
            .expect(400)

        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 400,
                error: 'Bad Request',
                message: [
                    'Password must be at least 16 characters long',
                    'Password must contain at least one uppercase letter',
                    'Password must contain at least one number',
                    'Password must contain at least one special character',
                ],
            }),
        )
    })
})

function createPrismaMock(): PrismaMock {
    const users: StoredUser[] = []
    const passwordResetTokens: StoredPasswordResetToken[] = []
    const auditEvents: StoredAuditEvent[] = []
    const deletedSessionUserIds: string[] = []
    let failSessionDeletionWithMissingTable = false
    let passwordResetTokenCounter = 0
    let auditEventCounter = 0

    const transactionClient: FakeTransactionClient = {
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
            update: async ({ where, data }) => {
                const user = users.find((item) => item.id === where.id)

                if (!user) {
                    throw new Error(`User ${where.id} not found`)
                }

                if (data.passwordHash) {
                    user.passwordHash = data.passwordHash
                }

                if (data.sessionVersion?.increment) {
                    user.sessionVersion += data.sessionVersion.increment
                }

                user.updatedAt = new Date()

                return user
            },
        },
        passwordResetToken: {
            findUnique: async ({ where, include }) => {
                const token = passwordResetTokens.find((item) => item.token === where.token) ?? null

                if (!token || !include.user) {
                    return null
                }

                const user = users.find((item) => item.id === token.userId)

                if (!user) {
                    return null
                }

                return {
                    ...token,
                    user,
                }
            },
            create: async ({ data }) => {
                passwordResetTokenCounter += 1

                const token: StoredPasswordResetToken = {
                    id: `password-reset-token-${passwordResetTokenCounter}`,
                    userId: data.userId,
                    token: data.token,
                    expiresAt: data.expiresAt,
                    usedAt: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }

                passwordResetTokens.push(token)
                return token
            },
            updateMany: async ({ where, data }) => {
                let count = 0

                for (const token of passwordResetTokens) {
                    const matchesId = where.id ? token.id === where.id : true
                    const matchesUser = token.userId === where.userId
                    const matchesUsedAt = token.usedAt === where.usedAt
                    const matchesExpiry = where.expiresAt
                        ? token.expiresAt.getTime() > where.expiresAt.gt.getTime()
                        : true

                    if (matchesId && matchesUser && matchesUsedAt && matchesExpiry) {
                        token.usedAt = data.usedAt
                        token.updatedAt = new Date()
                        count += 1
                    }
                }

                return { count }
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
        $executeRaw: async (_strings, ...values) => {
            if (failSessionDeletionWithMissingTable) {
                throw {
                    code: '42P01',
                }
            }

            const userId = values[0]

            if (typeof userId === 'string') {
                deletedSessionUserIds.push(userId)
            }

            return 1
        },
    }

    return {
        users,
        passwordResetTokens,
        auditEvents,
        deletedSessionUserIds,
        get failSessionDeletionWithMissingTable() {
            return failSessionDeletionWithMissingTable
        },
        set failSessionDeletionWithMissingTable(value: boolean) {
            failSessionDeletionWithMissingTable = value
        },
        ...transactionClient,
        $transaction: async <T>(callback: (tx: FakeTransactionClient) => Promise<T>) =>
            callback(transactionClient),
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

function getLoggedPasswordResetToken(): string {
    const resetTokenLogCall = (logger.info as jest.Mock).mock.calls.find(
        ([message]) => message === 'Password reset token generated for forgot-password',
    )
    const passwordResetToken = resetTokenLogCall?.[1]?.password_reset_token

    expect(passwordResetToken).toEqual(expect.any(String))

    return passwordResetToken as string
}
