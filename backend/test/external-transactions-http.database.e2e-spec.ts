import { INestApplication, ServiceUnavailableException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { SwaggerModule } from '@nestjs/swagger'
import { Prisma, PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { randomUUID } from 'crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as argon2 from 'argon2'
import session from 'express-session'
import request from 'supertest'
import type { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/shared/database/prisma.service'
import { AllExceptionsFilter } from '../src/shared/filters/http-exception.filter'
import { createRequestValidationPipe } from '../src/shared/validation/request-validation.pipe'
import { csrfProtectionMiddleware } from '../src/shared/security/csrf'
import { createOpenApiConfiguration } from '../src/shared/openapi/configuration'
import { CurrencyService } from '../src/shared/currency/currency.service'
import {
    IntegrationCredentialService,
    type IntegrationCredentialPolicyInput,
} from '../src/modules/integrations/integration-credential.service'
import { IntegrationRateLimitService } from '../src/modules/integrations/integration-rate-limit.service'
import {
    INTEGRATION_SCOPES,
    type IntegrationScope,
} from '../src/modules/integrations/integration-scopes'
import { externalApiBodyMiddleware } from '../src/modules/integrations/external-api-body.middleware'
import {
    digestIdempotencyKey,
    fingerprintExternalTransactionCreate,
} from '../src/modules/integrations/external-transaction-ownership.service'

const databaseUrl = process.env.INTEGRATION_TEST_DATABASE_URL
if (!databaseUrl || !/(^|[_-])test([_-]|$)/i.test(new URL(databaseUrl).pathname.slice(1)))
    throw new Error(
        'INTEGRATION_TEST_DATABASE_URL must point to a disposable PostgreSQL test database',
    )
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
const password = 'Synthetic-Http-Fixture-Password-42!'
const writeScopes: IntegrationScope[] = [
    'transactions:create',
    'transactions:update-own',
    'transactions:delete-own',
]
const endpoints = [
    {
        name: 'create',
        method: 'post',
        path: 'external-transactions',
        scope: 'transactions:create',
        success: 201,
    },
    {
        name: 'get',
        method: 'get',
        path: 'external-transactions/existing',
        scope: 'transactions:read-own',
        success: 200,
    },
    {
        name: 'update',
        method: 'put',
        path: 'external-transactions/existing',
        scope: 'transactions:update-own',
        success: 200,
    },
    {
        name: 'delete',
        method: 'delete',
        path: 'external-transactions/existing',
        scope: 'transactions:delete-own',
        success: 204,
    },
    {
        name: 'categories',
        method: 'get',
        path: 'external-categories',
        scope: 'categories:read',
        success: 200,
    },
    {
        name: 'sources',
        method: 'get',
        path: 'external-payment-sources',
        scope: 'payment-sources:read',
        success: 200,
    },
] as const
type Endpoint = (typeof endpoints)[number]
const profiles = [
    { name: 'empty', scopes: [] as IntegrationScope[] },
    ...INTEGRATION_SCOPES.map((scope) => ({ name: scope, scopes: [scope] as IntegrationScope[] })),
    { name: 'lifecycle writes', scopes: writeScopes },
    { name: 'all exact scopes', scopes: [...INTEGRATION_SCOPES] },
]

describe('external lifecycle HTTP with authoritative PostgreSQL authentication', () => {
    let app: INestApplication<App>
    let credentials: IntegrationCredentialService
    let limiter: IntegrationRateLimitService
    let currency: CurrencyService
    let passwordHash: string
    let userId: string
    let email: string
    let workspaceId: string
    let foreignWorkspaceId: string
    let categoryId: string
    let excludedCategoryId: string
    let sourceId: string
    let excludedSourceId: string
    let integrationId: string
    let transactionId: string
    let full: Awaited<ReturnType<IntegrationCredentialService['createIntegrationWithCredential']>>
    const previousDatabaseUrl = process.env.DATABASE_URL
    const previousNodeEnv = process.env.NODE_ENV
    const previousSessionSecret = process.env.SESSION_SECRET

    beforeAll(async () => {
        process.env.NODE_ENV = 'test'
        process.env.DATABASE_URL = databaseUrl
        process.env.SESSION_SECRET = 'synthetic-http-test-session-secret-0001'
        passwordHash = await argon2.hash(password)
        const module = await Test.createTestingModule({ imports: [AppModule] })
            .overrideProvider(PrismaService)
            .useValue(prisma)
            .compile()
        credentials = module.get(IntegrationCredentialService)
        limiter = module.get(IntegrationRateLimitService)
        currency = module.get(CurrencyService)
        app = module.createNestApplication()
        app.setGlobalPrefix('api/v1')
        app.use(externalApiBodyMiddleware)
        app.use(
            session({
                secret: 'synthetic-http-test-session-secret',
                resave: false,
                saveUninitialized: false,
            }),
        )
        app.use(csrfProtectionMiddleware)
        app.useGlobalPipes(createRequestValidationPipe())
        app.useGlobalFilters(new AllExceptionsFilter())
        await prisma.$connect()
        await app.init()
    })
    beforeEach(async () => {
        email = `${randomUUID()}@lifecycle-http-test.invalid`
        const user = await prisma.user.create({
            data: { email, name: 'Synthetic HTTP test', emailVerified: true, passwordHash },
        })
        userId = user.id
        const workspace = await prisma.workspace.create({
            data: { name: 'HTTP lifecycle test', baseCurrency: 'PLN' },
        })
        workspaceId = workspace.id
        foreignWorkspaceId = (
            await prisma.workspace.create({
                data: { name: 'Foreign HTTP test', baseCurrency: 'PLN' },
            })
        ).id
        sourceId = (
            await prisma.paymentSource.create({
                data: { workspaceId, name: 'Allowed source', type: 'cash' },
            })
        ).id
        excludedSourceId = (
            await prisma.paymentSource.create({
                data: { workspaceId, name: 'Excluded source', type: 'cash' },
            })
        ).id
        categoryId = (
            await prisma.category.create({
                data: { workspaceId, name: 'Allowed category', type: 'expense' },
            })
        ).id
        excludedCategoryId = (
            await prisma.category.create({
                data: { workspaceId, name: 'Excluded category', type: 'expense' },
            })
        ).id
        await prisma.workspaceMembership.create({
            data: { userId, workspaceId, role: 'admin', lastPaymentSourceId: sourceId },
        })
        full = await credentials.createIntegrationWithCredential({
            workspaceId,
            createdByUserId: userId,
            name: 'HTTP importer',
            scopes: [...INTEGRATION_SCOPES],
            expiresAt: new Date(Date.now() + 86_400_000),
            categoryAllowlistEnabled: false,
            paymentSourceAllowlistEnabled: false,
        })
        integrationId = full.integrationId
        transactionId = (
            await prisma.transaction.create({
                data: {
                    workspaceId,
                    integrationId,
                    externalId: 'existing',
                    categoryId,
                    paymentSourceId: sourceId,
                    amount: 1000,
                    baseAmount: 1000,
                    currency: 'PLN',
                    date: new Date('2026-09-04'),
                    description: 'Seeded HTTP transaction',
                },
            })
        ).id
    })
    afterEach(async () => {
        jest.restoreAllMocks()
        app.getHttpAdapter().getInstance().set('trust proxy', false)
        process.env.NODE_ENV = 'test'
        await prisma.integrationRateLimit.deleteMany()
        await prisma.authRateLimit.deleteMany()
        await prisma.transaction.deleteMany({
            where: { workspaceId: { in: [workspaceId, foreignWorkspaceId] } },
        })
        await prisma.integrationCredential.deleteMany({
            where: { integration: { workspaceId: { in: [workspaceId, foreignWorkspaceId] } } },
        })
        await prisma.workspace.deleteMany({
            where: { id: { in: [workspaceId, foreignWorkspaceId] } },
        })
        await prisma.user.deleteMany({ where: { id: userId } })
    })
    afterAll(async () => {
        await app.close()
        await prisma.$disconnect()
        if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL
        else process.env.DATABASE_URL = previousDatabaseUrl
        if (previousNodeEnv === undefined) delete process.env.NODE_ENV
        else process.env.NODE_ENV = previousNodeEnv
        if (previousSessionSecret === undefined) delete process.env.SESSION_SECRET
        else process.env.SESSION_SECRET = previousSessionSecret
    })

    it.each(profiles.flatMap((profile) => endpoints.map((endpoint) => ({ profile, endpoint }))))(
        '$profile.name authorizes only its exact capability at $endpoint.name',
        async ({ profile, endpoint }) => {
            const actor = await issue(profile.scopes)
            const allowed = profile.scopes.includes(endpoint.scope)
            const response = await perform(endpoint, actor.token).expect(
                allowed ? endpoint.success : 403,
            )
            expectNoStore(response)
            if (!allowed) {
                expect(response.body).toEqual({
                    statusCode: 403,
                    message: 'Insufficient integration permissions',
                    error: 'Forbidden',
                    code: 'ACCESS_DENIED',
                })
                expect(await prisma.transaction.count({ where: { workspaceId } })).toBe(1)
                expect(
                    await prisma.integrationIdempotencyRecord.count({ where: { integrationId } }),
                ).toBe(0)
            } else if (['create', 'get', 'update'].includes(endpoint.name)) {
                expect(response.body.amount).toBe(endpoint.name === 'get' ? '10.00' : '12.34')
                expect(response.headers.etag).toMatch(/^"tx-v[12]"$/)
            } else if (endpoint.name === 'categories')
                expectMetadataKeys(response.body, [
                    'id',
                    'name',
                    'type',
                    'system_key',
                    'parent_id',
                    'icon',
                    'color',
                    'sort_order',
                ])
            else if (endpoint.name === 'sources')
                expectMetadataKeys(response.body, ['id', 'name', 'type', 'system_key'])
        },
    )

    it('creates, replaces and deletes with write scopes alone and exact retry results', async () => {
        const actor = await issue(writeScopes)
        const key = randomUUID()
        const payload = body('account-a:record-1')
        const created = await post(actor.token, payload, key).expect(201)
        expect(created.body).toMatchObject({
            amount: '12.34',
            category_id: categoryId,
            external_id: payload.external_id,
            version: 1,
            replayed: false,
        })
        const retry = await post(actor.token, payload, key).expect(201)
        expect(retry.body).toEqual({ ...created.body, replayed: true })
        expect(retry.headers.etag).toBe(created.headers.etag)
        await request(app.getHttpServer())
            .get(item(payload.external_id))
            .set('Authorization', `Bearer ${actor.token}`)
            .expect(403)
        const replaceKey = randomUUID()
        const updated = await request(app.getHttpServer())
            .put(item(payload.external_id))
            .set('Authorization', `Bearer ${actor.token}`)
            .set('Idempotency-Key', replaceKey)
            .set('If-Match', created.headers.etag!)
            .send({ ...payload, amount: '56.78', tags: ['changed'] })
            .expect(200)
        expect(updated.body).toMatchObject({
            id: created.body.id,
            amount: '56.78',
            version: 2,
            tags: ['changed'],
        })
        const replaceRetry = await request(app.getHttpServer())
            .put(item(payload.external_id))
            .set('Authorization', `Bearer ${actor.token}`)
            .set('Idempotency-Key', replaceKey)
            .set('If-Match', created.headers.etag!)
            .send({ ...payload, amount: '56.78', tags: ['changed'] })
            .expect(200)
        expect(replaceRetry.body).toEqual({ ...updated.body, replayed: true })
        const deleteKey = randomUUID()
        for (let attempt = 0; attempt < 2; attempt++) {
            const removed = await request(app.getHttpServer())
                .delete(item(payload.external_id))
                .set('Authorization', `Bearer ${actor.token}`)
                .set('Idempotency-Key', deleteKey)
                .set('If-Match', updated.headers.etag!)
                .expect(204)
            expect(removed.text).toBe('')
        }
        const events = await prisma.auditEvent.findMany({
            where: { workspaceId, entityId: created.body.id },
            orderBy: { createdAt: 'asc' },
        })
        expect(events.map((event) => event.action)).toEqual([
            'TRANSACTION_CREATED',
            'TRANSACTION_UPDATED',
            'TRANSACTION_DELETED',
        ])
        expect(
            events.every(
                (event) =>
                    event.userId === null &&
                    (event.metadata as Prisma.JsonObject).credential_id === actor.credentialId &&
                    (event.metadata as Prisma.JsonObject).integration_id === integrationId,
            ),
        ).toBe(true)
        for (const secret of [actor.token, key, replaceKey, deleteKey])
            expect(JSON.stringify(events)).not.toContain(secret)
        expect(
            await prisma.transaction.findUniqueOrThrow({ where: { id: created.body.id } }),
        ).toMatchObject({ deletedAt: expect.any(Date), version: 3 })
    })

    it('creates one financial effect for concurrent identical HTTP requests', async () => {
        const actor = await issue(['transactions:create'])
        const key = randomUUID()
        const payload = body('concurrent')
        const results = await Promise.all(
            Array.from({ length: 6 }, () => post(actor.token, payload, key)),
        )
        expect(results.every((result) => result.status === 201)).toBe(true)
        expect(results.filter((result) => !result.body.replayed)).toHaveLength(1)
        expect(new Set(results.map((result) => result.body.id)).size).toBe(1)
        expect(
            await prisma.transaction.count({ where: { workspaceId, externalId: 'concurrent' } }),
        ).toBe(1)
        expect(
            await prisma.auditEvent.count({
                where: { workspaceId, action: 'TRANSACTION_CREATED' },
            }),
        ).toBe(1)
    })

    it('rejects conflicting key body, target, operation and precondition without another write', async () => {
        const key = randomUUID()
        const payload = body('conflict')
        await post(full.token, payload, key).expect(201)
        await post(full.token, { ...payload, amount: '99.99' }, key).expect(409)
        await post(full.token, { ...payload, external_id: 'other' }, key).expect(409)
        await request(app.getHttpServer())
            .put(item('conflict'))
            .set('Authorization', `Bearer ${full.token}`)
            .set('Idempotency-Key', key)
            .set('If-Match', '"tx-v1"')
            .send(payload)
            .expect(409)
        await request(app.getHttpServer())
            .delete(item('conflict'))
            .set('Authorization', `Bearer ${full.token}`)
            .set('Idempotency-Key', key)
            .set('If-Match', '"tx-v1"')
            .expect(409)
        expect(
            await prisma.auditEvent.count({
                where: { workspaceId, action: 'TRANSACTION_CREATED' },
            }),
        ).toBe(1)
        expect(
            await prisma.auditEvent.count({
                where: { workspaceId, action: 'TRANSACTION_UPDATED' },
            }),
        ).toBe(0)
    })

    it('acknowledges known IDs without disclosing later edits or restoring deleted records', async () => {
        const actor = await issue(['transactions:create'])
        await prisma.transaction.update({
            where: { id: transactionId },
            data: { amount: 98765, description: 'Later human edit', deletedAt: new Date() },
        })
        const response = await post(actor.token, body('existing'), undefined).expect(200)
        expect(response.body).toEqual({ status: 'already_exists', external_id: 'existing' })
        expect(response.headers.etag).not.toMatch(/^"tx-v/)
        expect(
            (await prisma.transaction.findUniqueOrThrow({ where: { id: transactionId } }))
                .deletedAt,
        ).not.toBeNull()
        const a = await post(
            actor.token,
            { ...body(), external_id: null, category_id: null },
            undefined,
        ).expect(201)
        const b = await post(
            actor.token,
            { ...body(), external_id: null, category_id: null },
            undefined,
        ).expect(201)
        expect(a.body.id).not.toBe(b.body.id)
        expect(a.body).toMatchObject({ external_id: null, category_id: null })
    })

    it('returns 409 and Retry-After for a retained live claim', async () => {
        const key = randomUUID()
        const payload = body('live-claim')
        const now = new Date()
        await prisma.integrationIdempotencyRecord.create({
            data: {
                workspaceId,
                integrationId,
                keyDigest: digestIdempotencyKey(key),
                operation: 'create',
                targetExternalId: payload.external_id,
                requestFingerprint: fingerprintExternalTransactionCreate({
                    externalId: payload.external_id,
                    categoryId,
                    paymentSourceId: sourceId,
                    type: 'expense',
                    amount: 1234,
                    currency: 'PLN',
                    date: new Date(payload.date),
                    description: payload.description,
                    notes: null,
                    tags: [],
                }),
                status: 'in_progress',
                expiresAt: new Date(now.getTime() + 60_000),
                leaseExpiresAt: new Date(now.getTime() + 60_000),
            },
        })
        const response = await post(full.token, payload, key).expect(409)
        expect(response.headers['retry-after']).toBe('1')
        expect(await prisma.transaction.count({ where: { workspaceId } })).toBe(1)
    })

    it.each(['missing', 'malformed', 'unknown', 'expired', 'revoked', 'CIDR'] as const)(
        'uses indistinguishable 401 responses for %s credentials at every endpoint',
        async (state) => {
            let token: string | undefined = full.token
            if (state === 'missing') token = undefined
            if (state === 'malformed') token = 'synthetic-invalid-format'
            if (state === 'unknown') token = full.token.slice(0, -3) + 'xyz'
            if (state === 'expired')
                token = (
                    await credentials.createCredential(
                        {
                            integrationId,
                            scopes: [...INTEGRATION_SCOPES],
                            expiresAt: new Date(Date.now() - 1000),
                            categoryAllowlistEnabled: false,
                            paymentSourceAllowlistEnabled: false,
                        },
                        new Date(Date.now() - 86_400_000),
                    )
                ).token
            if (state === 'revoked') await credentials.revokeCredential(full.credentialId)
            if (state === 'CIDR')
                token = (
                    await issue([...INTEGRATION_SCOPES], {
                        cidrAllowlistEnabled: true,
                        allowedCidrs: ['192.0.2.0/24'],
                    })
                ).token
            for (const endpoint of endpoints) {
                const response = await perform(endpoint, token).expect(401)
                expect(response.body).toEqual({
                    statusCode: 401,
                    message: 'Integration authentication failed',
                    error: 'Unauthorized',
                    code: 'AUTHENTICATION_REQUIRED',
                })
                expect(response.headers['www-authenticate']).toBe('Bearer')
                expectNoStore(response)
            }
            expect(await prisma.transaction.count({ where: { workspaceId } })).toBe(1)
        },
    )

    it('rejects another workspace before any operation or metadata disclosure', async () => {
        for (const endpoint of endpoints)
            await perform(endpoint, full.token, foreignWorkspaceId).expect(404)
        expect(await prisma.transaction.count({ where: { workspaceId } })).toBe(1)
        expect(await prisma.transaction.count({ where: { workspaceId: foreignWorkspaceId } })).toBe(
            0,
        )
    })

    it('does not distinguish missing, manual, foreign-integration and deleted transaction targets', async () => {
        const manual = await prisma.transaction.create({
            data: {
                workspaceId,
                categoryId,
                paymentSourceId: sourceId,
                amount: 100,
                currency: 'PLN',
                date: new Date('2026-09-04'),
                description: 'Manual',
            },
        })
        const foreign = await credentials.createIntegration({
            workspaceId,
            createdByUserId: userId,
            name: 'Foreign importer',
        })
        await prisma.transaction.create({
            data: {
                workspaceId,
                integrationId: foreign.id,
                externalId: 'foreign',
                categoryId,
                paymentSourceId: sourceId,
                amount: 100,
                currency: 'PLN',
                date: new Date('2026-09-04'),
                description: 'Foreign',
            },
        })
        await prisma.transaction.update({
            where: { id: transactionId },
            data: { deletedAt: new Date() },
        })
        for (const id of ['missing', manual.id, 'foreign', 'existing']) {
            const responses = [
                await request(app.getHttpServer())
                    .get(item(id))
                    .set('Authorization', `Bearer ${full.token}`)
                    .expect(404),
                await request(app.getHttpServer())
                    .put(item(id))
                    .set('Authorization', `Bearer ${full.token}`)
                    .set('Idempotency-Key', randomUUID())
                    .set('If-Match', '"tx-v999"')
                    .send(body(id))
                    .expect(404),
                await request(app.getHttpServer())
                    .delete(item(id))
                    .set('Authorization', `Bearer ${full.token}`)
                    .set('Idempotency-Key', randomUUID())
                    .set('If-Match', '"tx-v999"')
                    .expect(404),
            ]
            for (const response of responses)
                expect(response.body).toEqual({
                    statusCode: 404,
                    message: 'Transaction not found',
                    error: 'Not Found',
                    code: 'RESOURCE_NOT_FOUND',
                })
        }
        expect(await prisma.integrationIdempotencyRecord.count({ where: { integrationId } })).toBe(
            0,
        )
    })

    it('honors resource restrictions for metadata, old targets and proposed replacements', async () => {
        const child = await prisma.category.create({
            data: {
                workspaceId,
                parentId: excludedCategoryId,
                name: 'Allowed child',
                type: 'expense',
            },
        })
        const actor = await issue([...INTEGRATION_SCOPES], {
            categoryAllowlistEnabled: true,
            allowedCategoryIds: [child.id],
            paymentSourceAllowlistEnabled: true,
            allowedPaymentSourceIds: [sourceId],
        })
        const categories = await request(app.getHttpServer())
            .get(base() + '/external-categories')
            .set('Authorization', `Bearer ${actor.token}`)
            .expect(200)
        expect(categories.body).toEqual([
            {
                id: child.id,
                name: 'Allowed child',
                type: 'expense',
                system_key: null,
                parent_id: null,
                icon: null,
                color: null,
                sort_order: 0,
            },
        ])
        const sources = await request(app.getHttpServer())
            .get(base() + '/external-payment-sources')
            .set('Authorization', `Bearer ${actor.token}`)
            .expect(200)
        expect(sources.body).toEqual([
            { id: sourceId, name: 'Allowed source', type: 'cash', system_key: null },
        ])
        await post(actor.token, body('restricted'), randomUUID()).expect(400)
        await post(
            actor.token,
            {
                ...body('excluded-source'),
                category_id: child.id,
                payment_source_id: excludedSourceId,
            },
            randomUUID(),
        ).expect(400)
        await post(
            actor.token,
            { ...body('uncategorized'), category_id: null },
            randomUUID(),
        ).expect(400)
        await request(app.getHttpServer())
            .get(item('existing'))
            .set('Authorization', `Bearer ${actor.token}`)
            .expect(404)
        await request(app.getHttpServer())
            .put(item('existing'))
            .set('Authorization', `Bearer ${actor.token}`)
            .set('Idempotency-Key', randomUUID())
            .set('If-Match', '"tx-v1"')
            .send({ ...body('existing'), category_id: child.id })
            .expect(404)
        await request(app.getHttpServer())
            .delete(item('existing'))
            .set('Authorization', `Bearer ${actor.token}`)
            .set('Idempotency-Key', randomUUID())
            .set('If-Match', '"tx-v1"')
            .expect(404)
        await post(actor.token, { ...body('allowed'), category_id: child.id }, randomUUID()).expect(
            201,
        )
        await prisma.category.update({ where: { id: child.id }, data: { deletedAt: new Date() } })
        const empty = await request(app.getHttpServer())
            .get(base() + '/external-categories')
            .set('Authorization', `Bearer ${actor.token}`)
            .expect(200)
        expect(empty.body).toEqual([])
        await request(app.getHttpServer())
            .get(item('allowed'))
            .set('Authorization', `Bearer ${actor.token}`)
            .expect(404)
    })

    it.each([
        { amount: '0.00' },
        { amount: '-1.00' },
        { amount: '1.0' },
        { amount: '1' },
        { amount: '1.234' },
        { amount: 1.23 },
        { amount: '21474836.48' },
        { currency: 'XYZ' },
        { date: '2026-02-30' },
        { description: ' ' },
        { description: 'x'.repeat(201) },
        { notes: 'x'.repeat(2001) },
        { type: 'transfer' },
        { type: null },
        { tags: null },
        { tags: Array.from({ length: 11 }, () => 'tag') },
        { tags: ['x'.repeat(101)] },
        { external_id: ' ' },
        { external_id: 'ą'.repeat(101) },
        { external_id: 123 },
        { integration_id: 'caller-supplied' },
        { category_id: 'category-name' },
        { payment_source_id: 'source-name' },
    ])('rejects invalid caller input before financial persistence: %j', async (invalid) => {
        await post(full.token, { ...body(), ...invalid }, randomUUID()).expect(400)
        expect(await prisma.transaction.count({ where: { workspaceId } })).toBe(1)
        expect(await prisma.integrationIdempotencyRecord.count({ where: { integrationId } })).toBe(
            0,
        )
        expect(
            await prisma.auditEvent.count({
                where: { workspaceId, action: 'TRANSACTION_CREATED' },
            }),
        ).toBe(0)
    })

    it('distinguishes absent and malformed preconditions, and rejects missing/duplicated keys', async () => {
        const target = item('existing')
        const put = () =>
            request(app.getHttpServer()).put(target).set('Authorization', `Bearer ${full.token}`)
        await put().set('Idempotency-Key', randomUUID()).send(body('existing')).expect(428)
        for (const value of [
            '*',
            'W/"tx-v1"',
            '"tx-v0"',
            '"tx-v1", "tx-v2"',
            '"tx-v9007199254740993"',
        ])
            await put()
                .set('Idempotency-Key', randomUUID())
                .set('If-Match', value)
                .send(body('existing'))
                .expect(400)
        await put().set('If-Match', '"tx-v1"').send(body('existing')).expect(400)
        await put()
            .set('Idempotency-Key', 'short')
            .set('If-Match', '"tx-v1"')
            .send(body('existing'))
            .expect(400)
        await put()
            .set({ 'Idempotency-Key': [randomUUID(), randomUUID()] })
            .set('If-Match', '"tx-v1"')
            .send(body('existing'))
            .expect(400)
        await put()
            .set('Idempotency-Key', randomUUID())
            .set({ 'If-Match': ['"tx-v1"', '"tx-v1"'] })
            .send(body('existing'))
            .expect(400)
        await put()
            .set('Idempotency-Key', randomUUID())
            .set('If-Match', '"tx-v999"')
            .send(body('existing'))
            .expect(412)
        await request(app.getHttpServer())
            .delete(target)
            .set('Authorization', `Bearer ${full.token}`)
            .set('Idempotency-Key', randomUUID())
            .set('If-Match', '"tx-v1"')
            .send({ amount: '1.00' })
            .expect(400)
        await request(app.getHttpServer())
            .get(target + '?limit=5')
            .set('Authorization', `Bearer ${full.token}`)
            .expect(400)
    })

    it('enforces JSON and the 64 KiB limit without reflecting parser payloads', async () => {
        const target = base() + '/external-transactions'
        const invalid = await request(app.getHttpServer())
            .post(target)
            .set('Authorization', `Bearer ${full.token}`)
            .set('Content-Type', 'application/json')
            .send('{"synthetic_private_payload":')
            .expect(400)
        expect(JSON.stringify(invalid.body)).not.toContain('synthetic_private_payload')
        const large = await request(app.getHttpServer())
            .post(target)
            .set('Authorization', `Bearer ${full.token}`)
            .send({ ...body(), notes: 'x'.repeat(65_536) })
            .expect(413)
        expectNoStore(large)
        await request(app.getHttpServer())
            .post(target)
            .set('Authorization', `Bearer ${full.token}`)
            .type('form')
            .send(body())
            .expect(415)
        const limits = await prisma.integrationRateLimit.findMany()
        expect(limits).toHaveLength(1)
        expect(limits[0]?.requestTimes).toHaveLength(3)
        expect(limits[0]?.mutationTimes).toHaveLength(3)
        expect(await prisma.transaction.count({ where: { workspaceId } })).toBe(1)
    })

    it('rechecks real credential rotation and narrowed permissions before replay', async () => {
        const key = randomUUID()
        const payload = body('rotated')
        const original = await post(full.token, payload, key).expect(201)
        const rotated = await credentials.rotateCredential(
            full.credentialId,
            new Date(Date.now() + 86_400_000),
        )
        await post(full.token, payload, key).expect(401)
        const replay = await post(rotated.token, payload, key).expect(201)
        expect(replay.body).toEqual({ ...original.body, replayed: true })
        const narrow = await credentials.rotateCredential(
            rotated.credentialId,
            new Date(Date.now() + 86_400_000),
            new Date(),
            undefined,
            undefined,
            {
                categoryAllowlistEnabled: true,
                allowedCategoryIds: [],
                paymentSourceAllowlistEnabled: false,
            },
        )
        await post(narrow.token, payload, key).expect(404)
        await request(app.getHttpServer())
            .get(item('rotated'))
            .set('Authorization', `Bearer ${narrow.token}`)
            .expect(404)
    })

    it('replays completed results through an FX outage and after a later edit', async () => {
        const key = randomUUID()
        const payload = body('lost-response')
        const created = await post(full.token, payload, key).expect(201)
        await prisma.transaction.update({
            where: { id: created.body.id },
            data: { description: 'Later human edit' },
        })
        jest.spyOn(currency, 'getHistoricalQuote').mockRejectedValue(
            new Error('Synthetic FX outage'),
        )
        const replay = await post(full.token, payload, key).expect(201)
        expect(replay.body).toEqual({ ...created.body, replayed: true })
        expect(replay.headers.etag).toBe(created.headers.etag)
    })

    it('shares mutation budgets with retries and returns Retry-After on 429', async () => {
        for (let count = 0; count < 59; count++)
            await limiter.consumeCredential(full.credentialId, undefined, true, workspaceId)
        const key = randomUUID()
        const payload = body('last-allowed')
        await post(full.token, payload, key).expect(201)
        const response = await post(full.token, payload, key).expect(429)
        expect(Number(response.headers['retry-after'])).toBeGreaterThanOrEqual(1)
        expectNoStore(response)
        expect(
            await prisma.transaction.count({
                where: { workspaceId, externalId: payload.external_id },
            }),
        ).toBe(1)
        await request(app.getHttpServer())
            .get(item('existing'))
            .set('Authorization', `Bearer ${full.token}`)
            .expect(200)
    })

    it('enforces the total GET budget and fails closed when authoritative limits are unavailable', async () => {
        for (let count = 0; count < 119; count++)
            await limiter.consumeCredential(full.credentialId, undefined, false, workspaceId)
        await request(app.getHttpServer())
            .get(item('existing'))
            .set('Authorization', `Bearer ${full.token}`)
            .expect(200)
        const limited = await request(app.getHttpServer())
            .get(item('existing'))
            .set('Authorization', `Bearer ${full.token}`)
            .expect(429)
        expect(Number(limited.headers['retry-after'])).toBeGreaterThanOrEqual(1)
        jest.spyOn(limiter, 'consumeCredential').mockRejectedValue(
            new ServiceUnavailableException('Integration rate limit storage is unavailable'),
        )
        await post(full.token, body(), randomUUID()).expect(503)
        expect(await prisma.transaction.count({ where: { workspaceId } })).toBe(1)
    })

    it('requires deployed HTTPS and does not trust arbitrary forwarded headers', async () => {
        process.env.NODE_ENV = 'production'
        await request(app.getHttpServer())
            .get(item('existing'))
            .set('Authorization', `Bearer ${full.token}`)
            .set('X-Forwarded-Proto', 'https')
            .expect(401)
        app.getHttpAdapter().getInstance().set('trust proxy', 1)
        await request(app.getHttpServer())
            .get(item('existing'))
            .set('Authorization', `Bearer ${full.token}`)
            .set('X-Forwarded-Proto', 'https')
            .expect(200)
    })

    it('keeps bearer-only callers out of financial collections and session administration', async () => {
        for (const suffix of [
            'transactions',
            'export',
            'dashboard',
            'budgets',
            'goals',
            'categories',
            'payment-sources',
            'integrations',
        ])
            await request(app.getHttpServer())
                .get(base() + '/' + suffix)
                .set('Authorization', `Bearer ${full.token}`)
                .expect(401)
        await request(app.getHttpServer())
            .get('/api/v1/auth/me')
            .set('Authorization', `Bearer ${full.token}`)
            .expect(401)
        await request(app.getHttpServer())
            .post(base() + '/categories')
            .set('Authorization', `Bearer ${full.token}`)
            .send({ name: 'Forbidden creation' })
            .expect(403)
        await request(app.getHttpServer())
            .get(base() + '/external-transactions?search=anything')
            .set('Authorization', `Bearer ${full.token}`)
            .expect(404)
    })

    it('preserves real session CRUD, CSRF and the machine version after a human edit', async () => {
        const browser = request.agent(app.getHttpServer())
        const csrf = await browser.get('/api/v1/auth/csrf-token').expect(200)
        await browser
            .post('/api/v1/auth/login')
            .set('x-csrf-token', csrf.body.csrfToken)
            .send({ email, password })
            .expect(200)
        const token = (await browser.get('/api/v1/auth/csrf-token').expect(200)).body.csrfToken
        await browser.get(base() + '/transactions').expect(200)
        await browser
            .put(base() + '/transactions/' + transactionId)
            .send(body())
            .expect(403)
        const { external_id: _externalId, ...sessionBody } = body()
        void _externalId
        const manualBody = { ...sessionBody, amount: 12.34 }
        const edited = await browser
            .put(base() + '/transactions/' + transactionId)
            .set('x-csrf-token', token)
            .send({ ...manualBody, description: 'Human replacement' })
            .expect(200)
        expect(edited.body.id).toBe(transactionId)
        const current = await request(app.getHttpServer())
            .get(item('existing'))
            .set('Authorization', `Bearer ${full.token}`)
            .expect(200)
        expect(current.headers.etag).toBe('"tx-v2"')
        await request(app.getHttpServer())
            .delete(item('existing'))
            .set('Authorization', `Bearer ${full.token}`)
            .set('Idempotency-Key', randomUUID())
            .set('If-Match', '"tx-v1"')
            .expect(412)
        const manual = await browser
            .post(base() + '/transactions')
            .set('x-csrf-token', token)
            .send(manualBody)
            .expect(201)
        await browser
            .delete(base() + '/transactions/' + manual.body.id)
            .set('x-csrf-token', token)
            .expect(204)
        await browser.get(item('existing')).expect(401)
    })

    it('documents every route, exact scope, response schema, header and resolvable reference', async () => {
        const document = SwaggerModule.createDocument(app, createOpenApiConfiguration(), {
            ignoreGlobalPrefix: true,
        })
        expect(document.servers).toEqual([{ url: '/api/v1' }])
        expect(document.components?.securitySchemes?.integrationCredential).toMatchObject({
            type: 'http',
            scheme: 'bearer',
        })
        for (const endpoint of endpoints) {
            const path =
                '/workspaces/{workspaceId}/' + endpoint.path.replace('existing', '{externalId}')
            const operation = document.paths[path]?.[endpoint.method]
            expect(operation?.security).toEqual([{ integrationCredential: [] }])
            expect(operation).toMatchObject({ 'x-required-scope': endpoint.scope })
            for (const status of [400, 401, 403, 404, 429, 503, endpoint.success])
                expect(operation?.responses?.[String(status)]).toBeDefined()
            const response = operation!.responses[String(endpoint.success)]!
            if ('$ref' in response) throw new Error('Expected an inline response')
            expect(response.headers?.['Cache-Control']).toBeDefined()
            if (endpoint.name === 'delete') expect(response.content).toBeUndefined()
            else expect(response.content?.['application/json']?.schema).toBeDefined()
        }
        const refs: string[] = []
        function visit(value: unknown): void {
            if (Array.isArray(value)) value.forEach(visit)
            else if (value && typeof value === 'object')
                for (const [key, child] of Object.entries(value)) {
                    if (key === '$ref' && typeof child === 'string') refs.push(child)
                    else visit(child)
                }
        }
        visit(document)
        for (const ref of refs) {
            expect(ref).toMatch(/^#\//)
            let target: unknown = document
            for (const part of ref.slice(2).split('/'))
                target = (target as Record<string, unknown>)[part]
            expect(target).toBeDefined()
        }
    })

    it('executes the published client guide lifecycle, retries, scope and restriction denials', async () => {
        const guide = readFileSync(
            join(__dirname, '../../docs/integration-client-guide.md'),
            'utf8',
        )
        const examples = [...guide.matchAll(/```http\r?\n([\s\S]*?)```/g)].map((match) =>
            match[1]!.trim(),
        )
        expect(examples).toHaveLength(6)
        const actor = await issue(INTEGRATION_SCOPES)
        function example(index: number, token = actor.token) {
            const [header, payload] = examples[index]!.replace(/\r/g, '')
                .replaceAll('ws_example', workspaceId)
                .replaceAll('source_example', sourceId)
                .replaceAll('<credential>', token)
                .split('\n\n')
            const [line, ...headers] = header!.split('\n')
            const match = /^(POST|GET|PUT|DELETE) (\S+) HTTP\/1.1$/.exec(line!)!
            const method = match[1]!.toLowerCase() as Endpoint['method']
            const operation = request(app.getHttpServer())[method](match[2]!)
            for (const entry of headers) {
                const colon = entry.indexOf(':')
                operation.set(entry.slice(0, colon), entry.slice(colon + 1).trim())
            }
            if (payload) operation.send(JSON.parse(payload) as object)
            return operation
        }
        const created = await example(0).expect(201)
        expect(created.body).toMatchObject({
            amount: '12.34',
            category_id: null,
            payment_source_id: sourceId,
        })
        expect(created.headers.etag).toBe('"tx-v1"')
        await example(0).expect(200, {
            status: 'already_exists',
            external_id: 'account-a:external-expense-123',
        })
        const read = await example(1).expect(200)
        expect(read.body.id).toBe(created.body.id)
        const updated = await example(2).expect(200)
        expect(updated.body).toMatchObject({ id: created.body.id, amount: '12.00', version: 2 })
        const replay = await example(2).expect(200)
        expect(replay.body).toEqual({ ...updated.body, replayed: true })
        await example(3).expect(204)
        await example(3).expect(204)
        await example(1).expect(404)
        await example(4).expect(200)
        await example(5).expect(200)
        const createOnly = await issue(['transactions:create'])
        for (const index of [1, 2, 3, 4, 5]) await example(index, createOnly.token).expect(403)
        const restricted = await issue(['transactions:create'], {
            paymentSourceAllowlistEnabled: true,
            allowedPaymentSourceIds: [sourceId],
        })
        await post(
            restricted.token,
            { ...body('restricted-guide-example'), payment_source_id: excludedSourceId },
            randomUUID(),
        ).expect(400)
        expect(await prisma.transaction.count({ where: { workspaceId } })).toBe(2)
    })

    function base(id = workspaceId) {
        return `/api/v1/workspaces/${id}`
    }
    function item(externalId: string) {
        return base() + '/external-transactions/' + encodeURIComponent(externalId)
    }
    function body(externalId = 'new-source-record') {
        return {
            external_id: externalId,
            amount: '12.34',
            currency: 'PLN',
            date: '2026-09-04',
            description: 'HTTP import',
            category_id: categoryId,
            payment_source_id: sourceId,
        }
    }
    function post(token: string, payload: object, key: string | undefined) {
        const operation = request(app.getHttpServer())
            .post(base() + '/external-transactions')
            .set('Authorization', `Bearer ${token}`)
        if (key !== undefined) operation.set('Idempotency-Key', key)
        return operation.send(payload)
    }
    function perform(endpoint: Endpoint, token?: string, id = workspaceId) {
        const operation = request(app.getHttpServer())[endpoint.method](
            base(id) + '/' + endpoint.path,
        )
        if (token !== undefined) operation.set('Authorization', `Bearer ${token}`)
        if (endpoint.method !== 'get') operation.set('Idempotency-Key', randomUUID())
        if (endpoint.method === 'put' || endpoint.method === 'delete')
            operation.set('If-Match', '"tx-v1"')
        if (endpoint.method === 'post' || endpoint.method === 'put')
            operation.send(body(endpoint.method === 'put' ? 'existing' : 'new-source-record'))
        return operation
    }
    function issue(
        scopes: readonly IntegrationScope[],
        policy: Partial<IntegrationCredentialPolicyInput> = {},
    ) {
        return credentials.createCredential({
            integrationId,
            scopes,
            expiresAt: new Date(Date.now() + 86_400_000),
            categoryAllowlistEnabled: false,
            paymentSourceAllowlistEnabled: false,
            ...policy,
        })
    }
    function expectNoStore(response: request.Response) {
        expect(response.headers['cache-control']).toBe('no-store')
        expect(response.headers.pragma).toBe('no-cache')
    }
    function expectMetadataKeys(rows: Array<Record<string, unknown>>, keys: string[]) {
        expect(rows.length).toBeGreaterThan(0)
        for (const row of rows) expect(Object.keys(row).sort()).toEqual([...keys].sort())
    }
})
