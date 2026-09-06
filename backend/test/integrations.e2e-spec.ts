import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import { ExternalTransactionsController } from '../src/modules/integrations/external-transactions.controller'
import { ExternalTransactionsService } from '../src/modules/integrations/external-transactions.service'
import { IntegrationCredentialGuard } from '../src/modules/integrations/integration-credential.guard'
import { IntegrationCredentialService, MachinePrincipal } from '../src/modules/integrations/integration-credential.service'
import { IntegrationRateLimitService } from '../src/modules/integrations/integration-rate-limit.service'
import { createRequestValidationPipe } from '../src/shared/validation/request-validation.pipe'
import { csrfProtectionMiddleware } from '../src/shared/security/csrf'

const principal: MachinePrincipal = {
    integrationId: 'integration-1',
    credentialId: 'credential-1',
    workspaceId: 'workspace-1',
    scopes: ['transactions:create'],
    categoryAllowlistEnabled: false,
    allowedCategoryIds: [],
    paymentSourceAllowlistEnabled: false,
    allowedPaymentSourceIds: [],
    allowedCidrs: [],
}

describe('External integration HTTP boundary (e2e)', () => {
    let app: INestApplication<App>
    let authenticate: jest.Mock
    let create: jest.Mock

    beforeEach(async () => {
        authenticate = jest.fn(async (header: string | undefined) => {
            if (header !== 'Bearer valid-token') throw new Error('unexpected test token')
            return principal
        })
        create = jest.fn().mockResolvedValue({
            id: 'transaction-1',
            external_id: 'provider-1',
            version: 1,
            category_id: 'category-1',
            payment_source_id: 'source-1',
            type: 'expense',
            amount: '12.34',
            currency: 'PLN',
            date: '2026-09-06',
            description: 'Coffee',
            notes: null,
            tags: [],
            created_at: new Date(),
            updated_at: new Date(),
            replayed: false,
        })
        const module = await Test.createTestingModule({
            controllers: [ExternalTransactionsController],
            providers: [
                IntegrationCredentialGuard,
                {
                    provide: IntegrationCredentialService,
                    useValue: { authenticateAuthorizationHeader: authenticate },
                },
                {
                    provide: IntegrationRateLimitService,
                    useValue: {
                        consumeCredential: jest.fn(),
                        consumeFailedAuthentication: jest.fn(),
                    },
                },
                {
                    provide: ExternalTransactionsService,
                    useValue: {
                        create,
                        get: jest.fn(),
                        update: jest.fn(),
                        remove: jest.fn(),
                        listCategories: jest.fn(),
                        listPaymentSources: jest.fn(),
                    },
                },
            ],
        }).compile()
        app = module.createNestApplication()
        app.setGlobalPrefix('api/v1')
        app.use(csrfProtectionMiddleware)
        app.useGlobalPipes(createRequestValidationPipe())
        await app.init()
    })

    afterEach(async () => app.close())

    it('accepts a scoped bearer request without a session CSRF token and returns an ETag', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/v1/workspaces/workspace-1/external-transactions')
            .set('Authorization', 'Bearer valid-token')
            .set('Idempotency-Key', '0123456789abcdef')
            .send({
                external_id: 'provider-1',
                type: 'expense',
                amount: '12.34',
                currency: 'PLN',
                date: '2026-09-06',
                description: 'Coffee',
                category_id: 'category-1',
                payment_source_id: 'source-1',
            })
            .expect(201)

        expect(response.headers.etag).toBe('"tx-v1"')
        expect(create).toHaveBeenCalledWith(
            expect.objectContaining({ workspaceId: 'workspace-1' }),
            '0123456789abcdef',
            expect.objectContaining({ external_id: 'provider-1' }),
        )
    })

    it('does not allow a credential to address another workspace', async () => {
        await request(app.getHttpServer())
            .post('/api/v1/workspaces/workspace-2/external-transactions')
            .set('Authorization', 'Bearer valid-token')
            .set('Idempotency-Key', '0123456789abcdef')
            .send({})
            .expect(404)
        expect(create).not.toHaveBeenCalled()
    })

    it('rejects a malformed body before the service is called', async () => {
        await request(app.getHttpServer())
            .post('/api/v1/workspaces/workspace-1/external-transactions')
            .set('Authorization', 'Bearer valid-token')
            .set('Idempotency-Key', '0123456789abcdef')
            .send({ external_id: 'provider-1' })
            .expect(400)
        expect(create).not.toHaveBeenCalled()
    })
})
