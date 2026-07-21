import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import * as argon2 from 'argon2'
import session from 'express-session'
import * as speakeasy from 'speakeasy'
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
    totpEnabled: boolean
    totpSecretEncrypted: string | null
    createdAt: Date
    updatedAt: Date
}

interface StoredRecoveryCode {
    id: string
    userId: string
    codeHash: string
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
                totpEnabled?: boolean
                totpSecretEncrypted?: string | null
            }
        }): Promise<StoredUser>
    }
    twoFactorRecoveryCode: {
        deleteMany(args: { where: { userId: string } }): Promise<{ count: number }>
        createMany(args: {
            data: Array<{
                userId: string
                codeHash: string
            }>
        }): Promise<{ count: number }>
        findMany(args: {
            where: {
                userId: string
                usedAt: null
            }
        }): Promise<StoredRecoveryCode[]>
        updateMany(args: {
            where: {
                id: string
                userId: string
                usedAt: null
            }
            data: {
                usedAt: Date
            }
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
    recoveryCodes: StoredRecoveryCode[]
    auditEvents: StoredAuditEvent[]
    $transaction<T>(callback: (tx: FakeTransactionClient) => Promise<T>): Promise<T>
    $connect(): Promise<void>
    $disconnect(): Promise<void>
}

describe('Auth two-factor authentication (e2e)', () => {
    let app: INestApplication<App>
    let prismaMock: PrismaMock
    const originalNodeEnv = process.env.NODE_ENV
    const originalSessionSecret = process.env.SESSION_SECRET
    const originalTotpEncryptionKey = process.env.TOTP_ENCRYPTION_KEY

    beforeEach(async () => {
        prismaMock = createPrismaMock()
        process.env.NODE_ENV = 'test'
        process.env.SESSION_SECRET = 'test-session-secret'
        process.env.TOTP_ENCRYPTION_KEY = 'test-two-factor-encryption-key'

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
        process.env.TOTP_ENCRYPTION_KEY = originalTotpEncryptionKey
    })

    it('completes the full TOTP setup, login verification, recovery code, and disable flow', async () => {
        const password = 'GraniteHarbor!1234'

        prismaMock.users.push(
            await createStoredUser({
                id: 'user-1',
                email: 'twofactor@example.com',
                password,
                emailVerified: true,
            }),
        )

        const setupAgent = request.agent(app.getHttpServer())

        await setupAgent
            .post('/api/v1/auth/login')
            .send({
                email: 'twofactor@example.com',
                password,
            })
            .expect(200)

        const setupResponse = await setupAgent.post('/api/v1/auth/2fa/setup').expect(200)

        expect(setupResponse.body).toEqual({
            secret: expect.stringMatching(/^[A-Z2-7]+$/),
            otpauthUri: expect.stringContaining('otpauth://totp/'),
            qrCodeDataUrl: expect.stringMatching(/^data:image\/png;base64,/),
        })
        expect(prismaMock.users[0].totpEnabled).toBe(false)
        expect(prismaMock.users[0].totpSecretEncrypted).toEqual(expect.any(String))
        expect(prismaMock.users[0].totpSecretEncrypted).not.toBe(setupResponse.body.secret)

        const verifySetupToken = speakeasy.totp({
            secret: setupResponse.body.secret,
            encoding: 'base32',
        })

        const verifySetupResponse = await setupAgent
            .post('/api/v1/auth/2fa/verify-setup')
            .send({
                token: verifySetupToken,
            })
            .expect(200)

        expect(verifySetupResponse.body).toEqual({
            message: 'Two-factor authentication enabled',
            recoveryCodes: expect.arrayContaining(Array(8).fill(expect.any(String))),
        })
        expect(verifySetupResponse.body.recoveryCodes).toHaveLength(8)
        expect(prismaMock.users[0].totpEnabled).toBe(true)
        expect(prismaMock.recoveryCodes).toHaveLength(8)
        expect(prismaMock.auditEvents).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    action: 'USER_2FA_ENABLED',
                    userId: 'user-1',
                    entityType: 'USER',
                    entityId: 'user-1',
                    metadata: {
                        method: 'TOTP',
                    },
                }),
            ]),
        )

        await setupAgent.post('/api/v1/auth/logout').expect(200)

        const totpLoginAgent = request.agent(app.getHttpServer())

        const loginChallengeResponse = await totpLoginAgent
            .post('/api/v1/auth/login')
            .send({
                email: 'twofactor@example.com',
                password,
            })
            .expect(200)

        expect(loginChallengeResponse.body).toEqual({
            requiresTwoFactor: true,
            message: 'Two-factor authentication required',
        })

        await totpLoginAgent.get('/api/v1/auth/me').expect(401)

        const verifyLoginToken = speakeasy.totp({
            secret: setupResponse.body.secret,
            encoding: 'base32',
        })

        const totpVerifyResponse = await totpLoginAgent
            .post('/api/v1/auth/2fa/verify')
            .send({
                token: verifyLoginToken,
            })
            .expect(200)

        expect(totpVerifyResponse.body).toEqual({
            id: 'user-1',
            email: 'twofactor@example.com',
            name: 'Ada Lovelace',
            emailVerified: true,
            totpEnabled: true,
            recoveryCodeUsed: false,
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
        })

        await totpLoginAgent.get('/api/v1/auth/me').expect(200)
        await totpLoginAgent.post('/api/v1/auth/logout').expect(200)

        const recoveryCodeLoginAgent = request.agent(app.getHttpServer())
        const recoveryCode = verifySetupResponse.body.recoveryCodes[0]

        await recoveryCodeLoginAgent
            .post('/api/v1/auth/login')
            .send({
                email: 'twofactor@example.com',
                password,
            })
            .expect(200)

        const recoveryCodeVerifyResponse = await recoveryCodeLoginAgent
            .post('/api/v1/auth/2fa/verify')
            .send({
                token: recoveryCode,
            })
            .expect(200)

        expect(recoveryCodeVerifyResponse.body).toEqual({
            id: 'user-1',
            email: 'twofactor@example.com',
            name: 'Ada Lovelace',
            emailVerified: true,
            totpEnabled: true,
            recoveryCodeUsed: true,
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
        })
        expect(prismaMock.recoveryCodes.filter((code) => code.usedAt !== null)).toHaveLength(1)

        await recoveryCodeLoginAgent.post('/api/v1/auth/logout').expect(200)

        await recoveryCodeLoginAgent
            .post('/api/v1/auth/login')
            .send({
                email: 'twofactor@example.com',
                password,
            })
            .expect(200)

        await recoveryCodeLoginAgent
            .post('/api/v1/auth/2fa/verify')
            .send({
                token: recoveryCode,
            })
            .expect(401)

        const secondRecoveryCode = verifySetupResponse.body.recoveryCodes[1]

        await recoveryCodeLoginAgent
            .post('/api/v1/auth/2fa/verify')
            .send({
                token: secondRecoveryCode,
            })
            .expect(200)

        const disableResponse = await recoveryCodeLoginAgent
            .post('/api/v1/auth/2fa/disable')
            .send({
                currentPassword: password,
            })
            .expect(200)

        expect(disableResponse.body).toEqual({
            message: 'Two-factor authentication disabled',
        })
        expect(prismaMock.users[0].totpEnabled).toBe(false)
        expect(prismaMock.users[0].totpSecretEncrypted).toBeNull()
        expect(prismaMock.recoveryCodes).toHaveLength(0)
        expect(prismaMock.auditEvents).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    action: 'USER_2FA_DISABLED',
                    userId: 'user-1',
                    entityType: 'USER',
                    entityId: 'user-1',
                    metadata: {
                        method: 'TOTP',
                    },
                }),
            ]),
        )

        await recoveryCodeLoginAgent.post('/api/v1/auth/logout').expect(200)

        const passwordOnlyLoginResponse = await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                email: 'twofactor@example.com',
                password,
            })
            .expect(200)

        expect(passwordOnlyLoginResponse.body).toEqual({
            id: 'user-1',
            email: 'twofactor@example.com',
            name: 'Ada Lovelace',
            emailVerified: true,
            totpEnabled: false,
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
        })
    }, 15000)

    it('rejects stale two-factor login challenges after the session version changes', async () => {
        const password = 'GraniteHarbor!1234'

        prismaMock.users.push(
            await createStoredUser({
                id: 'user-2',
                email: 'stalechallenge@example.com',
                password,
                emailVerified: true,
            }),
        )

        const setupAgent = request.agent(app.getHttpServer())
        const setupResult = await enableTwoFactorForUser({
            agent: setupAgent,
            email: 'stalechallenge@example.com',
            password,
        })

        await setupAgent.post('/api/v1/auth/logout').expect(200)

        const challengeAgent = request.agent(app.getHttpServer())

        await challengeAgent
            .post('/api/v1/auth/login')
            .send({
                email: 'stalechallenge@example.com',
                password,
            })
            .expect(200)

        prismaMock.users[0].sessionVersion = 1

        const token = speakeasy.totp({
            secret: setupResult.secret,
            encoding: 'base32',
        })

        const response = await challengeAgent
            .post('/api/v1/auth/2fa/verify')
            .send({
                token,
            })
            .expect(401)

        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 401,
                message: 'Two-factor authentication challenge is invalid',
                error: 'Unauthorized',
            }),
        )
    })

    it('rate limits repeated failed two-factor verification attempts', async () => {
        const password = 'GraniteHarbor!1234'

        prismaMock.users.push(
            await createStoredUser({
                id: 'user-3',
                email: 'ratelimit@example.com',
                password,
                emailVerified: true,
            }),
        )

        const setupAgent = request.agent(app.getHttpServer())

        await enableTwoFactorForUser({
            agent: setupAgent,
            email: 'ratelimit@example.com',
            password,
        })

        await setupAgent.post('/api/v1/auth/logout').expect(200)

        const challengeAgent = request.agent(app.getHttpServer())

        await challengeAgent
            .post('/api/v1/auth/login')
            .send({
                email: 'ratelimit@example.com',
                password,
            })
            .expect(200)

        for (let attempt = 0; attempt < 5; attempt += 1) {
            await challengeAgent
                .post('/api/v1/auth/2fa/verify')
                .send({
                    token: '000000',
                })
                .expect(401)
        }

        const response = await challengeAgent
            .post('/api/v1/auth/2fa/verify')
            .send({
                token: '000000',
            })
            .expect(429)

        expect(response.body).toEqual({
            statusCode: 429,
            message: 'Too many two-factor verification attempts. Please try again later.',
            error: 'Too Many Requests',
        })
    })
})

async function enableTwoFactorForUser(input: {
    agent: ReturnType<typeof request.agent>
    email: string
    password: string
}): Promise<{ secret: string }> {
    await input.agent
        .post('/api/v1/auth/login')
        .send({
            email: input.email,
            password: input.password,
        })
        .expect(200)

    const setupResponse = await input.agent.post('/api/v1/auth/2fa/setup').expect(200)

    const verifySetupToken = speakeasy.totp({
        secret: setupResponse.body.secret,
        encoding: 'base32',
    })

    await input.agent
        .post('/api/v1/auth/2fa/verify-setup')
        .send({
            token: verifySetupToken,
        })
        .expect(200)

    return {
        secret: setupResponse.body.secret,
    }
}

function createPrismaMock(): PrismaMock {
    const users: StoredUser[] = []
    const recoveryCodes: StoredRecoveryCode[] = []
    const auditEvents: StoredAuditEvent[] = []
    let recoveryCodeCounter = 0
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
                const user = users.find((entry) => entry.id === where.id)

                if (!user) {
                    throw new Error(`User ${where.id} not found`)
                }

                if (typeof data.totpEnabled === 'boolean') {
                    user.totpEnabled = data.totpEnabled
                }

                if ('totpSecretEncrypted' in data) {
                    user.totpSecretEncrypted = data.totpSecretEncrypted ?? null
                }

                user.updatedAt = new Date()
                return user
            },
        },
        twoFactorRecoveryCode: {
            deleteMany: async ({ where }) => {
                const remainingCodes = recoveryCodes.filter((code) => code.userId !== where.userId)
                const deletedCount = recoveryCodes.length - remainingCodes.length

                recoveryCodes.splice(0, recoveryCodes.length, ...remainingCodes)

                return {
                    count: deletedCount,
                }
            },
            createMany: async ({ data }) => {
                const now = new Date()

                for (const record of data) {
                    recoveryCodeCounter += 1
                    recoveryCodes.push({
                        id: `recovery-code-${recoveryCodeCounter}`,
                        userId: record.userId,
                        codeHash: record.codeHash,
                        usedAt: null,
                        createdAt: now,
                        updatedAt: now,
                    })
                }

                return {
                    count: data.length,
                }
            },
            findMany: async ({ where }) => {
                return recoveryCodes.filter(
                    (code) => code.userId === where.userId && code.usedAt === where.usedAt,
                )
            },
            updateMany: async ({ where, data }) => {
                const matchingCodes = recoveryCodes.filter(
                    (code) =>
                        code.id === where.id &&
                        code.userId === where.userId &&
                        code.usedAt === where.usedAt,
                )

                for (const recoveryCode of matchingCodes) {
                    recoveryCode.usedAt = data.usedAt
                    recoveryCode.updatedAt = new Date()
                }

                return {
                    count: matchingCodes.length,
                }
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
        recoveryCodes,
        auditEvents,
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
        totpEnabled: false,
        totpSecretEncrypted: null,
        createdAt: now,
        updatedAt: now,
    }
}
