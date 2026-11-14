import { ConfigService } from '@nestjs/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { randomUUID } from 'crypto'
import { AuthRepository } from '../src/modules/auth/auth.repository'
import { AuditService } from '../src/shared/audit/audit.service'
import { EmailOutboxService } from '../src/shared/email/email-outbox.service'
import { TransactionsRepository } from '../src/modules/transactions/transactions.repository'
import { ExportService } from '../src/modules/export/export.service'
import { emailRecipientHash } from '../src/shared/email/email-recipient'
import { Test } from '@nestjs/testing'
import * as argon2 from 'argon2'
import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/shared/database/prisma.service'
import { csrfProtectionMiddleware } from '../src/shared/security/csrf'
import { createRequestValidationPipe } from '../src/shared/validation/request-validation.pipe'
import { AllExceptionsFilter } from '../src/shared/filters/http-exception.filter'

const url = process.env.INTEGRATION_TEST_DATABASE_URL
if (!url || !/(^|[_-])test([_-]|$)/i.test(new URL(url).pathname.slice(1))) {
    throw new Error('A disposable test database is required')
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
const config = { get: () => ({ nodeEnv: 'test' }) } as unknown as ConfigService
const auth = new AuthRepository(prisma as never, new AuditService(prisma as never), config)

describe('privacy operations in PostgreSQL', () => {
    const users: string[] = []
    const workspaces: string[] = []
    const outboxRows: string[] = []
    afterEach(async () => {
        await prisma.emailOutbox.deleteMany({ where: { id: { in: outboxRows.splice(0) } } })
        await prisma.workspace.deleteMany({ where: { id: { in: workspaces.splice(0) } } })
        await prisma.auditEvent.deleteMany({
            where: { OR: [{ userId: { in: users } }, { entityId: { in: users } }] },
        })
        for (const userId of users) {
            await prisma.$executeRaw`DELETE FROM user_sessions WHERE sess -> 'auth' ->> 'userId' = ${userId}`
        }
        await prisma.user.deleteMany({ where: { id: { in: users.splice(0) } } })
    })
    afterAll(async () => prisma.$disconnect())

    it('deletes the authenticated account through HTTP only with CSRF and invalidates other sessions', async () => {
        const previousNodeEnv = process.env.NODE_ENV
        const previousDatabaseUrl = process.env.DATABASE_URL
        const previousSessionSecret = process.env.SESSION_SECRET
        process.env.NODE_ENV = 'test'
        process.env.DATABASE_URL = url
        process.env.SESSION_SECRET = 'synthetic-privacy-test-session-secret'
        const password = 'Synthetic-Privacy-Password-42!'
        const user = await prisma.user.create({
            data: {
                email: `${randomUUID()}@example.test`,
                name: 'Synthetic user',
                emailVerified: true,
                passwordHash: await argon2.hash(password),
            },
        })
        users.push(user.id)
        const queued = await prisma.emailOutbox.create({
            data: {
                kind: 'verification',
                recipient: emailRecipientHash(user.email),
                encryptedPayload: 'queued-secret',
            },
        })
        outboxRows.push(queued.id)
        const module = await Test.createTestingModule({ imports: [AppModule] })
            .overrideProvider(PrismaService)
            .useValue(prisma)
            .compile()
        const app = module.createNestApplication()
        const PgStore = connectPgSimple(session)
        const store = new PgStore({
            conString: url,
            tableName: 'user_sessions',
            createTableIfMissing: false,
        }) as session.Store & { close(): Promise<void> }
        app.setGlobalPrefix('api/v1')
        app.use(
            session({
                name: 'monqom.sid',
                secret: 'synthetic-privacy-test-session-secret',
                resave: false,
                saveUninitialized: false,
                store,
            }),
        )
        app.use(csrfProtectionMiddleware)
        app.useGlobalPipes(createRequestValidationPipe())
        app.useGlobalFilters(new AllExceptionsFilter())
        await app.init()
        try {
            const first = request.agent(app.getHttpServer())
            const second = request.agent(app.getHttpServer())
            for (const browser of [first, second]) {
                const csrf = await browser.get('/api/v1/auth/csrf-token').expect(200)
                await browser
                    .post('/api/v1/auth/login')
                    .set('x-csrf-token', csrf.body.csrfToken)
                    .send({ email: user.email, password })
                    .expect(200)
            }
            const sessionsBefore = await prisma.$queryRaw<Array<{ count: bigint }>>`
                SELECT COUNT(*)::bigint AS count FROM user_sessions
                WHERE sess -> 'auth' ->> 'userId' = ${user.id}
            `
            expect(sessionsBefore[0]?.count).toBe(2n)
            await first.delete('/api/v1/users/me').expect(403)
            expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull()
            const csrf = await first.get('/api/v1/auth/csrf-token').expect(200)
            const deletion = await first
                .delete('/api/v1/users/me')
                .set('x-csrf-token', csrf.body.csrfToken)
                .expect(200)
            expect(deletion.headers['set-cookie']).toEqual(
                expect.arrayContaining([expect.stringContaining('monqom.sid=')]),
            )
            await first.get('/api/v1/auth/me').expect(401)
            await second.get('/api/v1/auth/me').expect(401)
            const sessionsAfter = await prisma.$queryRaw<Array<{ count: bigint }>>`
                SELECT COUNT(*)::bigint AS count FROM user_sessions
                WHERE sess -> 'auth' ->> 'userId' = ${user.id}
            `
            expect(sessionsAfter[0]?.count).toBe(0n)
            expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull()
            expect(
                await prisma.emailOutbox.findUniqueOrThrow({ where: { id: queued.id } }),
            ).toMatchObject({ status: 'failed', encryptedPayload: '' })
        } finally {
            await app.close()
            await store.close()
            if (previousNodeEnv === undefined) delete process.env.NODE_ENV
            else process.env.NODE_ENV = previousNodeEnv
            if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL
            else process.env.DATABASE_URL = previousDatabaseUrl
            if (previousSessionSecret === undefined) delete process.env.SESSION_SECRET
            else process.env.SESSION_SECRET = previousSessionSecret
        }
    }, 30_000)

    it('deletes a personal workspace and sessions but preserves a shared workspace', async () => {
        const user = await prisma.user.create({
            data: { email: `${randomUUID()}@example.test`, name: 'Test', passwordHash: 'test' },
        })
        users.push(user.id)
        const other = await prisma.user.create({
            data: { email: `${randomUUID()}@example.test`, name: 'Other', passwordHash: 'test' },
        })
        users.push(other.id)
        const personal = await prisma.workspace.create({ data: { name: 'Personal' } })
        workspaces.push(personal.id)
        const shared = await prisma.workspace.create({ data: { name: 'Shared' } })
        workspaces.push(shared.id)
        for (const workspace of [personal, shared]) {
            const source = await prisma.paymentSource.create({
                data: { workspaceId: workspace.id, name: 'Cash', type: 'cash' },
            })
            await prisma.workspaceMembership.create({
                data: {
                    userId: user.id,
                    workspaceId: workspace.id,
                    role: 'owner',
                    lastPaymentSourceId: source.id,
                },
            })
            await prisma.transaction.create({
                data: {
                    workspaceId: workspace.id,
                    paymentSourceId: source.id,
                    amount: 1200,
                    currency: 'PLN',
                    date: new Date('2026-01-01'),
                    description: 'Synthetic transaction',
                },
            })
            if (workspace.id === shared.id) {
                await prisma.workspaceMembership.create({
                    data: {
                        userId: other.id,
                        workspaceId: shared.id,
                        role: 'admin',
                        lastPaymentSourceId: source.id,
                    },
                })
            }
        }
        const sessionId = randomUUID()
        await prisma.$executeRaw`INSERT INTO user_sessions (sid, sess, expire) VALUES (${sessionId}, ${JSON.stringify({ auth: { userId: user.id } })}::json, NOW() + INTERVAL '1 day')`
        const mail = await Promise.all([
            prisma.emailOutbox.create({
                data: {
                    kind: 'verification',
                    recipient: emailRecipientHash(user.email),
                    encryptedPayload: 'pending-secret',
                    status: 'pending',
                },
            }),
            prisma.emailOutbox.create({
                data: {
                    kind: 'verification',
                    recipient: emailRecipientHash(user.email),
                    encryptedPayload: 'failed-secret',
                    status: 'failed',
                    lastError: 'synthetic error',
                },
            }),
            prisma.emailOutbox.create({
                data: {
                    kind: 'verification',
                    recipient: emailRecipientHash(user.email),
                    encryptedPayload: 'in-flight-secret',
                    status: 'processing',
                    lockedAt: new Date(),
                },
            }),
            prisma.emailOutbox.create({
                data: {
                    kind: 'verification',
                    recipient: emailRecipientHash(other.email),
                    encryptedPayload: 'other-secret',
                    status: 'pending',
                },
            }),
        ])
        outboxRows.push(...mail.map((row) => row.id))

        const transactions = new TransactionsRepository(
            prisma as never,
            new AuditService(prisma as never),
        )
        const exportService = new ExportService(transactions)
        const file = await exportService.exportTransactions({ format: 'json' }, personal.id)
        let exported = ''
        for await (const chunk of file.chunks) exported += chunk
        expect(JSON.parse(exported)).toEqual([
            expect.objectContaining({ description: 'Synthetic transaction' }),
        ])
        expect(exported).not.toContain(user.email)

        await auth.deleteUserAccount(user.id)

        expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull()
        expect(await prisma.workspace.findUnique({ where: { id: personal.id } })).toBeNull()
        expect(await prisma.workspace.findUnique({ where: { id: shared.id } })).not.toBeNull()
        expect(await prisma.transaction.count({ where: { workspaceId: shared.id } })).toBe(1)
        expect(
            await prisma.workspaceMembership.findUniqueOrThrow({
                where: { userId_workspaceId: { userId: other.id, workspaceId: shared.id } },
            }),
        ).toMatchObject({ role: 'owner' })
        expect(
            await prisma.$queryRaw`SELECT sid FROM user_sessions WHERE sid = ${sessionId}`,
        ).toEqual([])
        const remainingMail = await Promise.all(
            mail.map((row) => prisma.emailOutbox.findUniqueOrThrow({ where: { id: row.id } })),
        )
        expect(remainingMail[1]?.lastError).toBeNull()
        expect(remainingMail.map((row) => [row.status, row.encryptedPayload])).toEqual([
            ['failed', ''],
            ['failed', ''],
            ['processing', 'in-flight-secret'],
            ['pending', 'other-secret'],
        ])
    })

    it('rolls back queued-message cancellation if account deletion fails', async () => {
        const user = await prisma.user.create({
            data: { email: `${randomUUID()}@example.test`, name: 'Test', passwordHash: 'test' },
        })
        users.push(user.id)
        const message = await prisma.emailOutbox.create({
            data: {
                kind: 'verification',
                recipient: emailRecipientHash(user.email),
                encryptedPayload: 'pending-secret',
                status: 'pending',
            },
        })
        outboxRows.push(message.id)
        const failingAuth = new AuthRepository(
            prisma as never,
            { record: jest.fn().mockRejectedValue(new Error('audit failure')) } as never,
            config,
        )

        await expect(failingAuth.deleteUserAccount(user.id)).rejects.toThrow('audit failure')
        expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull()
        expect(
            await prisma.emailOutbox.findUniqueOrThrow({ where: { id: message.id } }),
        ).toMatchObject({
            status: 'pending',
            encryptedPayload: 'pending-secret',
        })
    })

    it('clears expired messages without clearing a live worker lease or a retryable message', async () => {
        const now = Date.now()
        const old = new Date(now - 25 * 60 * 60_000)
        const rows = await Promise.all([
            prisma.emailOutbox.create({
                data: {
                    kind: 'verification',
                    recipient: randomUUID(),
                    encryptedPayload: 'expired-pending',
                    status: 'pending',
                    createdAt: old,
                },
            }),
            prisma.emailOutbox.create({
                data: {
                    kind: 'verification',
                    recipient: randomUUID(),
                    encryptedPayload: 'expired-processing',
                    status: 'processing',
                    createdAt: old,
                    lockedAt: new Date(now - 10 * 60_000),
                },
            }),
            prisma.emailOutbox.create({
                data: {
                    kind: 'verification',
                    recipient: randomUUID(),
                    encryptedPayload: 'live-processing',
                    status: 'processing',
                    createdAt: old,
                    lockedAt: new Date(),
                },
            }),
            prisma.emailOutbox.create({
                data: {
                    kind: 'verification',
                    recipient: randomUUID(),
                    encryptedPayload: 'orphaned-processing',
                    status: 'processing',
                    createdAt: old,
                    lockedAt: null,
                },
            }),
            prisma.emailOutbox.create({
                data: {
                    kind: 'verification',
                    recipient: randomUUID(),
                    encryptedPayload: 'retryable',
                    status: 'pending',
                    availableAt: new Date(now + 60_000),
                },
            }),
            prisma.emailOutbox.create({
                data: {
                    kind: 'verification',
                    recipient: randomUUID(),
                    encryptedPayload: 'failed',
                    status: 'failed',
                },
            }),
        ])
        outboxRows.push(...rows.map((row) => row.id))
        const service = new EmailOutboxService(prisma as never, {} as never, config)
        await service.processBatch()
        const result = await Promise.all(
            rows.map((row) => prisma.emailOutbox.findUniqueOrThrow({ where: { id: row.id } })),
        )
        expect(result.map((row) => [row.status, row.encryptedPayload])).toEqual([
            ['failed', ''],
            ['failed', ''],
            ['processing', 'live-processing'],
            ['failed', ''],
            ['pending', 'retryable'],
            ['failed', ''],
        ])
    })
})
