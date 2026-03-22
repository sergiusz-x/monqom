import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import * as argon2 from 'argon2'
import { createHash } from 'crypto'
import { AppModule } from './../src/app.module'
import { AllExceptionsFilter } from './../src/shared/filters/http-exception.filter'
import { PrismaService } from './../src/shared/database/prisma.service'
import { logger } from './../src/shared/utils/logger'

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
    createdAt: Date
    updatedAt: Date
}

interface StoredEmailVerificationToken {
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
        findUnique(args: { where: { email: string } }): Promise<StoredUser | null>
        create(args: {
            data: Pick<StoredUser, 'email' | 'name' | 'passwordHash' | 'emailVerified'>
        }): Promise<StoredUser>
        update(args: {
            where: { id: string }
            data: Pick<StoredUser, 'emailVerified'>
        }): Promise<StoredUser>
    }
    emailVerificationToken: {
        findUnique(args: {
            where: { token: string }
            include: { user: true }
        }): Promise<(StoredEmailVerificationToken & { user: StoredUser }) | null>
        create(args: {
            data: Pick<StoredEmailVerificationToken, 'userId' | 'token' | 'expiresAt'>
        }): Promise<StoredEmailVerificationToken>
        updateMany(args: {
            where: { userId: string; usedAt: null }
            data: Pick<StoredEmailVerificationToken, 'usedAt'>
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
}

interface PrismaMock extends FakeTransactionClient {
    users: StoredUser[]
    verificationTokens: StoredEmailVerificationToken[]
    auditEvents: StoredAuditEvent[]
    $transaction<T>(callback: (tx: FakeTransactionClient) => Promise<T>): Promise<T>
    $connect(): Promise<void>
    $disconnect(): Promise<void>
}

describe('Auth registration (e2e)', () => {
    let app: INestApplication<App>
    let prismaMock: PrismaMock
    const originalNodeEnv = process.env.NODE_ENV

    beforeEach(async () => {
        prismaMock = createPrismaMock()
        jest.clearAllMocks()
        process.env.NODE_ENV = 'test'

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(PrismaService)
            .useValue(prismaMock)
            .compile()

        app = moduleFixture.createNestApplication()
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
    })

    it('creates a user, stores a hashed password, and logs a verification token', async () => {
        const password = 'GraniteHarbor!1234'

        process.env.NODE_ENV = 'development'

        const response = await request(app.getHttpServer())
            .post('/api/v1/auth/register')
            .send({
                email: 'Ada@Example.com',
                name: 'Ada Lovelace',
                password,
            })
            .expect(201)

        expect(response.body).toEqual(
            expect.objectContaining({
                id: expect.any(String),
                email: 'ada@example.com',
                name: 'Ada Lovelace',
                emailVerified: false,
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
            }),
        )
        expect(response.body.passwordHash).toBeUndefined()
        expect(prismaMock.users).toHaveLength(1)
        expect(prismaMock.verificationTokens).toHaveLength(1)
        expect(prismaMock.auditEvents).toHaveLength(1)

        const storedUser = prismaMock.users[0]
        const storedVerificationToken = prismaMock.verificationTokens[0]

        expect(storedUser.email).toBe('ada@example.com')
        expect(storedUser.emailVerified).toBe(false)
        expect(storedUser.passwordHash).not.toBe(password)
        await expect(argon2.verify(storedUser.passwordHash, password)).resolves.toBe(true)
        expect(storedVerificationToken.userId).toBe(storedUser.id)
        expect(storedVerificationToken.token).toMatch(/^[a-f0-9]{64}$/)
        expect(storedVerificationToken.usedAt).toBeNull()
        expect(prismaMock.auditEvents[0]).toEqual(
            expect.objectContaining({
                action: 'USER_REGISTERED',
                userId: storedUser.id,
                entityType: 'USER',
                entityId: storedUser.id,
            }),
        )
        expect(logger.info).toHaveBeenCalledWith(
            'Email verification token generated for registration',
            expect.objectContaining({
                context_name: 'AuthService',
                verification_token: storedVerificationToken.token,
            }),
        )
    })

    it('logs only masked verification token metadata in production mode for the MVP flow', async () => {
        process.env.NODE_ENV = 'production'

        await request(app.getHttpServer())
            .post('/api/v1/auth/register')
            .send({
                email: 'prod@example.com',
                name: 'Ada Lovelace',
                password: 'GraniteHarbor!1234',
            })
            .expect(201)

        const storedVerificationToken = prismaMock.verificationTokens[0]

        expect(logger.info).toHaveBeenCalledWith(
            'Email verification token generated for registration',
            expect.objectContaining({
                context_name: 'AuthService',
                verification_token_last6: storedVerificationToken.token.slice(-6),
                verification_token_fingerprint: createHash('sha256')
                    .update(storedVerificationToken.token)
                    .digest('hex'),
            }),
        )

        const verificationLogCall = (logger.info as jest.Mock).mock.calls.find(
            ([message]) => message === 'Email verification token generated for registration',
        )
        expect(verificationLogCall?.[1]).toEqual(
            expect.not.objectContaining({
                verification_token: expect.any(String),
            }),
        )
    })

    it('returns a conflict for duplicate emails', async () => {
        const payload = {
            email: 'duplicate@example.com',
            name: 'Ada Lovelace',
            password: 'GraniteHarbor!1234',
        }

        await request(app.getHttpServer()).post('/api/v1/auth/register').send(payload).expect(201)

        const response = await request(app.getHttpServer())
            .post('/api/v1/auth/register')
            .send({
                ...payload,
                email: 'Duplicate@Example.com',
            })
            .expect(409)

        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 409,
                message: 'A user with this email already exists',
                error: 'Conflict',
            }),
        )
        expect(prismaMock.users).toHaveLength(1)
    })

    it('returns clear validation errors for invalid input', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/v1/auth/register')
            .send({
                email: 'invalid-email',
                name: '',
                password: 'weak',
            })
            .expect(400)

        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 400,
                error: 'Bad Request',
                message: expect.arrayContaining([
                    'Email must be a valid email address',
                    'Name is required',
                    'Password must be at least 16 characters long',
                    'Password must contain at least one uppercase letter',
                    'Password must contain at least one number',
                    'Password must contain at least one special character',
                ]),
            }),
        )
        expect(prismaMock.users).toHaveLength(0)
    })

    it('verifies a token captured from the registration log and rejects reuse', async () => {
        process.env.NODE_ENV = 'development'

        await request(app.getHttpServer())
            .post('/api/v1/auth/register')
            .send({
                email: 'verify@example.com',
                name: 'Ada Lovelace',
                password: 'GraniteHarbor!1234',
            })
            .expect(201)

        const verificationToken = getLoggedVerificationToken(
            'Email verification token generated for registration',
        )

        const verifyResponse = await request(app.getHttpServer())
            .post('/api/v1/auth/verify-email')
            .send({ token: verificationToken })
            .expect(200)

        expect(verifyResponse.body).toEqual({
            message: 'Email verified successfully',
        })
        expect(prismaMock.users[0].emailVerified).toBe(true)
        expect(prismaMock.verificationTokens[0].usedAt).toBeInstanceOf(Date)
        expect(prismaMock.auditEvents).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    action: 'USER_EMAIL_VERIFIED',
                    userId: prismaMock.users[0].id,
                    entityType: 'USER',
                    entityId: prismaMock.users[0].id,
                }),
            ]),
        )

        const secondVerifyResponse = await request(app.getHttpServer())
            .post('/api/v1/auth/verify-email')
            .send({ token: verificationToken })
            .expect(400)

        expect(secondVerifyResponse.body).toEqual(
            expect.objectContaining({
                statusCode: 400,
                message: 'Verification token is invalid or expired',
                error: 'Bad Request',
            }),
        )
    })

    it('returns 400 for expired verification tokens', async () => {
        process.env.NODE_ENV = 'development'

        await request(app.getHttpServer())
            .post('/api/v1/auth/register')
            .send({
                email: 'expired@example.com',
                name: 'Ada Lovelace',
                password: 'GraniteHarbor!1234',
            })
            .expect(201)

        prismaMock.verificationTokens[0].expiresAt = new Date(Date.now() - 1000)

        const response = await request(app.getHttpServer())
            .post('/api/v1/auth/verify-email')
            .send({ token: prismaMock.verificationTokens[0].token })
            .expect(400)

        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 400,
                message: 'Verification token is invalid or expired',
                error: 'Bad Request',
            }),
        )
        expect(prismaMock.users[0].emailVerified).toBe(false)
        expect(prismaMock.verificationTokens[0].usedAt).toBeNull()
    })

    it('returns 400 for unknown verification tokens', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/v1/auth/verify-email')
            .send({ token: 'missing-verification-token' })
            .expect(400)

        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 400,
                message: 'Verification token is invalid or expired',
                error: 'Bad Request',
            }),
        )
        expect(prismaMock.users).toHaveLength(0)
        expect(prismaMock.verificationTokens).toHaveLength(0)
        expect(prismaMock.auditEvents).toHaveLength(0)
    })

    it('resends a new verification token for unverified users', async () => {
        const now = Date.now()

        process.env.NODE_ENV = 'development'

        await request(app.getHttpServer())
            .post('/api/v1/auth/register')
            .send({
                email: 'resend@example.com',
                name: 'Ada Lovelace',
                password: 'GraniteHarbor!1234',
            })
            .expect(201)

        const originalToken = prismaMock.verificationTokens[0].token

        const response = await request(app.getHttpServer())
            .post('/api/v1/auth/resend-verification')
            .send({ email: ' Resend@Example.com ' })
            .expect(200)

        expect(response.body).toEqual({
            message: 'Verification email sent',
        })
        expect(prismaMock.verificationTokens).toHaveLength(2)

        const resentToken = prismaMock.verificationTokens[1]

        expect(resentToken.userId).toBe(prismaMock.users[0].id)
        expect(resentToken.token).not.toBe(originalToken)
        expect(resentToken.usedAt).toBeNull()
        expect(
            Math.abs(resentToken.expiresAt.getTime() - (now + 24 * 60 * 60 * 1000)),
        ).toBeLessThanOrEqual(5000)
        expect(prismaMock.auditEvents).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    action: 'USER_EMAIL_VERIFICATION_RESENT',
                    userId: prismaMock.users[0].id,
                    entityType: 'USER',
                    entityId: prismaMock.users[0].id,
                }),
            ]),
        )
        expect(logger.info).toHaveBeenCalledWith(
            'Email verification token generated for resend',
            expect.objectContaining({
                context_name: 'AuthService',
                verification_token: resentToken.token,
            }),
        )
    })

    it('returns a generic resend response after the account is already verified', async () => {
        process.env.NODE_ENV = 'development'

        await request(app.getHttpServer())
            .post('/api/v1/auth/register')
            .send({
                email: 'verified@example.com',
                name: 'Ada Lovelace',
                password: 'GraniteHarbor!1234',
            })
            .expect(201)

        const verificationToken = getLoggedVerificationToken(
            'Email verification token generated for registration',
        )

        await request(app.getHttpServer())
            .post('/api/v1/auth/verify-email')
            .send({ token: verificationToken })
            .expect(200)

        const response = await request(app.getHttpServer())
            .post('/api/v1/auth/resend-verification')
            .send({ email: 'verified@example.com' })
            .expect(200)

        expect(response.body).toEqual({
            message: 'Verification email sent',
        })
        expect(prismaMock.verificationTokens).toHaveLength(1)
    })

    it('returns a generic resend response for unknown accounts without creating tokens', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/v1/auth/resend-verification')
            .send({ email: 'missing@example.com' })
            .expect(200)

        expect(response.body).toEqual({
            message: 'Verification email sent',
        })
        expect(prismaMock.users).toHaveLength(0)
        expect(prismaMock.verificationTokens).toHaveLength(0)
        expect(prismaMock.auditEvents).toHaveLength(0)
    })

    it('rate limits repeated email verification attempts from the same IP', async () => {
        for (let attempt = 0; attempt < 5; attempt += 1) {
            await request(app.getHttpServer())
                .post('/api/v1/auth/verify-email')
                .send({ token: 'missing-verification-token' })
                .expect(400)
        }

        const response = await request(app.getHttpServer())
            .post('/api/v1/auth/verify-email')
            .send({ token: 'missing-verification-token' })
            .expect(429)

        expect(response.headers['retry-after']).toBe('900')
        expect(response.body).toEqual({
            statusCode: 429,
            message: 'Too many email verification attempts. Please try again later.',
            error: 'Too Many Requests',
        })
    })

    it('rate limits repeated resend-verification attempts from the same IP', async () => {
        for (let attempt = 0; attempt < 5; attempt += 1) {
            await request(app.getHttpServer())
                .post('/api/v1/auth/resend-verification')
                .send({ email: 'invalid-email' })
                .expect(400)
        }

        const response = await request(app.getHttpServer())
            .post('/api/v1/auth/resend-verification')
            .send({ email: 'invalid-email' })
            .expect(429)

        expect(response.headers['retry-after']).toBe('900')
        expect(response.body).toEqual({
            statusCode: 429,
            message: 'Too many verification email requests. Please try again later.',
            error: 'Too Many Requests',
        })
    })

    it('rate limits repeated registration attempts from the same IP', async () => {
        for (let attempt = 0; attempt < 5; attempt += 1) {
            await request(app.getHttpServer())
                .post('/api/v1/auth/register')
                .send({
                    email: 'invalid-email',
                    name: '',
                    password: 'weak',
                })
                .expect(400)
        }

        const response = await request(app.getHttpServer())
            .post('/api/v1/auth/register')
            .send({
                email: 'invalid-email',
                name: '',
                password: 'weak',
            })
            .expect(429)

        expect(response.headers['retry-after']).toBe('900')
        expect(response.body).toEqual({
            statusCode: 429,
            message: 'Too many registration attempts. Please try again later.',
            error: 'Too Many Requests',
        })
    })

    it('ignores spoofed forwarded-for headers when trust proxy is disabled', async () => {
        for (let attempt = 0; attempt < 5; attempt += 1) {
            await request(app.getHttpServer())
                .post('/api/v1/auth/register')
                .set('X-Forwarded-For', `198.51.100.${attempt}`)
                .send({
                    email: 'invalid-email',
                    name: '',
                    password: 'weak',
                })
                .expect(400)
        }

        await request(app.getHttpServer())
            .post('/api/v1/auth/register')
            .set('X-Forwarded-For', '203.0.113.200')
            .send({
                email: 'invalid-email',
                name: '',
                password: 'weak',
            })
            .expect(429)
    })
})

function createPrismaMock(): PrismaMock {
    const users: StoredUser[] = []
    const verificationTokens: StoredEmailVerificationToken[] = []
    const auditEvents: StoredAuditEvent[] = []
    let userCounter = 0
    let verificationTokenCounter = 0
    let auditEventCounter = 0

    const transactionClient: FakeTransactionClient = {
        user: {
            findUnique: async ({ where }) =>
                users.find((user) => user.email === where.email) ?? null,
            create: async ({ data }) => {
                userCounter += 1

                const user: StoredUser = {
                    id: `user-${userCounter}`,
                    email: data.email,
                    name: data.name,
                    passwordHash: data.passwordHash,
                    emailVerified: data.emailVerified,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }

                users.push(user)
                return user
            },
            update: async ({ where, data }) => {
                const user = users.find((item) => item.id === where.id)

                if (!user) {
                    throw new Error(`User ${where.id} not found`)
                }

                user.emailVerified = data.emailVerified
                user.updatedAt = new Date()

                return user
            },
        },
        emailVerificationToken: {
            findUnique: async ({ where, include }) => {
                const verificationToken =
                    verificationTokens.find((item) => item.token === where.token) ?? null

                if (!verificationToken || !include.user) {
                    return null
                }

                const user = users.find((item) => item.id === verificationToken.userId)

                if (!user) {
                    return null
                }

                return {
                    ...verificationToken,
                    user,
                }
            },
            create: async ({ data }) => {
                verificationTokenCounter += 1

                const verificationToken: StoredEmailVerificationToken = {
                    id: `verification-token-${verificationTokenCounter}`,
                    userId: data.userId,
                    token: data.token,
                    expiresAt: data.expiresAt,
                    usedAt: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }

                verificationTokens.push(verificationToken)
                return verificationToken
            },
            updateMany: async ({ where, data }) => {
                let count = 0

                for (const verificationToken of verificationTokens) {
                    if (
                        verificationToken.userId === where.userId &&
                        verificationToken.usedAt === where.usedAt
                    ) {
                        verificationToken.usedAt = data.usedAt
                        verificationToken.updatedAt = new Date()
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
    }

    return {
        users,
        verificationTokens,
        auditEvents,
        ...transactionClient,
        $transaction: async <T>(callback: (tx: FakeTransactionClient) => Promise<T>) =>
            callback(transactionClient),
        $connect: async () => undefined,
        $disconnect: async () => undefined,
    }
}

function getLoggedVerificationToken(message: string): string {
    const verificationLogCall = (logger.info as jest.Mock).mock.calls.find(
        ([loggedMessage]) => loggedMessage === message,
    )
    const verificationToken = verificationLogCall?.[1]?.verification_token

    expect(verificationToken).toEqual(expect.any(String))

    return verificationToken as string
}
