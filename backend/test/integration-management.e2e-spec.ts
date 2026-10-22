/* eslint-disable @typescript-eslint/no-explicit-any -- Nest test guards use minimal HTTP context doubles. */
import { INestApplication, UnauthorizedException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { Reflector } from '@nestjs/core'
import request from 'supertest'
import { App } from 'supertest/types'
import { IntegrationManagementController } from '../src/modules/integrations/integration-management.controller'
import { IntegrationManagementAuditService } from '../src/modules/integrations/integration-management-audit.service'
import { IntegrationManagementGuard } from '../src/modules/integrations/integration-management.guard'
import { IntegrationManagementInterceptor } from '../src/modules/integrations/integration-management.interceptor'
import { IntegrationManagementService } from '../src/modules/integrations/integration-management.service'
import {
    IntegrationRateLimitExceededError,
    IntegrationRateLimitService,
} from '../src/modules/integrations/integration-rate-limit.service'
import { AuthRepository } from '../src/modules/auth/auth.repository'
import { SessionGuard } from '../src/shared/guards/session.guard'
import { WorkspaceGuard } from '../src/shared/guards/workspace.guard'
import { WorkspaceRoleGuard } from '../src/shared/guards/workspace-role.guard'
import { createAuditedCsrfProtectionMiddleware } from '../src/shared/security/csrf'
import { createRequestValidationPipe } from '../src/shared/validation/request-validation.pipe'
import { WorkspaceRepository } from '../src/modules/workspace/workspace.repository'

describe('Owner/admin integration management HTTP boundary (e2e)', () => {
    let app: INestApplication<App>
    let management: {
        create: jest.Mock
        list: jest.Mock
        get: jest.Mock
        rotate: jest.Mock
        revoke: jest.Mock
        remove: jest.Mock
    }
    let managementAudit: {
        denied: jest.Mock
        read: jest.Mock
        csrfDenied: jest.Mock
    }
    let managementRateLimit: { consumeManagementStepUp: jest.Mock }

    beforeEach(async () => {
        management = {
            create: jest.fn().mockResolvedValue({
                integration_id: 'integration-1',
                credential_id: 'credential-1',
                token: 'mqic_synthetic-one-time-secret',
                token_prefix: 'mqic_abcdefgh1234',
                expires_at: '2026-11-16T12:00:00.000Z',
            }),
            list: jest.fn().mockResolvedValue([]),
            get: jest.fn().mockResolvedValue({ id: 'integration-1', credentials: [] }),
            rotate: jest.fn().mockResolvedValue({
                credential_id: 'credential-2',
                token: 'mqic_synthetic-replacement-secret',
                token_prefix: 'mqic_zxyw98765432',
                expires_at: '2026-11-16T12:00:00.000Z',
            }),
            revoke: jest.fn().mockResolvedValue({ revoked: false }),
            remove: jest.fn().mockResolvedValue({ deleted: true }),
        }
        managementAudit = {
            denied: jest.fn().mockResolvedValue(undefined),
            read: jest.fn().mockResolvedValue(undefined),
            csrfDenied: jest.fn().mockResolvedValue(undefined),
        }
        managementRateLimit = {
            consumeManagementStepUp: jest.fn().mockResolvedValue(undefined),
        }
        const module = await Test.createTestingModule({
            controllers: [IntegrationManagementController],
            providers: [
                IntegrationManagementGuard,
                IntegrationManagementInterceptor,
                SessionGuard,
                WorkspaceGuard,
                {
                    provide: AuthRepository,
                    useValue: {
                        findUserById: jest.fn(async (id: string) => ({ id, sessionVersion: 1 })),
                    },
                },
                {
                    provide: WorkspaceRepository,
                    useValue: {
                        findWorkspaceAccess: jest.fn(
                            async (userId: string, workspaceId: string) => {
                                if (userId === 'outsider-1') return null
                                return {
                                    workspaceId,
                                    role: userId === 'member-1' ? 'member' : 'admin',
                                }
                            },
                        ),
                    },
                },
                {
                    provide: WorkspaceRoleGuard,
                    inject: [Reflector],
                    useFactory: (reflector: any) => new WorkspaceRoleGuard(reflector),
                },
                { provide: IntegrationManagementAuditService, useValue: managementAudit },
                {
                    provide: IntegrationRateLimitService,
                    useValue: managementRateLimit,
                },
                { provide: IntegrationManagementService, useValue: management },
            ],
        }).compile()
        app = module.createNestApplication()
        app.setGlobalPrefix('api/v1')
        app.use((req: any, _res: any, next: () => void) => {
            req.session = req.headers['x-test-no-session']
                ? {}
                : {
                      auth: {
                          userId: req.headers['x-test-outsider']
                              ? 'outsider-1'
                              : req.headers['x-test-role'] === 'member'
                                ? 'member-1'
                                : 'admin-1',
                          sessionVersion: 1,
                      },
                      csrfToken: 'session-csrf',
                  }
            next()
        })
        app.use(createAuditedCsrfProtectionMiddleware(managementAudit.csrfDenied))
        app.useGlobalPipes(createRequestValidationPipe())
        await app.init()
    })

    afterEach(async () => app.close())

    const root = '/api/v1/workspaces/workspace-1/integrations'
    const expiresAt = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const headers = { 'x-csrf-token': 'session-csrf' }
    const createBody = () => ({
        name: 'Daily importer',
        expires_at: expiresAt(),
        scopes: [],
        category_allowlist_enabled: false,
        payment_source_allowlist_enabled: false,
        current_password: 'correct-horse-battery',
    })

    it('serves list and get with safe metadata, no-store, and read audit', async () => {
        await request(app.getHttpServer()).get(root).expect(200).expect([])
        const response = await request(app.getHttpServer()).get(`${root}/integration-1`).expect(200)
        expect(response.headers['cache-control']).toBe('no-store')
        expect(response.headers.pragma).toBe('no-cache')
        expect(management.list).toHaveBeenCalledWith('workspace-1')
        expect(management.get).toHaveBeenCalledWith('workspace-1', 'integration-1')
        expect(managementAudit.read).toHaveBeenCalledTimes(2)
        expect(managementRateLimit.consumeManagementStepUp).not.toHaveBeenCalled()
    })

    it('creates a credential once and rotates, revokes, and safely deletes through their scoped routes', async () => {
        const created = await request(app.getHttpServer())
            .post(root)
            .set(headers)
            .send(createBody())
            .expect(201)
        expect(created.headers['cache-control']).toBe('no-store')
        expect(created.body.token).toBe('mqic_synthetic-one-time-secret')
        expect(management.create).toHaveBeenCalledWith(
            'workspace-1',
            'admin-1',
            expect.objectContaining({ scopes: [], current_password: 'correct-horse-battery' }),
        )

        const target = `${root}/integration-1/credentials/credential-1`
        const stepUp = { current_password: 'correct-horse-battery' }
        const rotated = await request(app.getHttpServer())
            .post(`${target}/rotate`)
            .set(headers)
            .send({ expires_at: expiresAt(), ...stepUp, scopes: [] })
            .expect(200)
        expect(rotated.headers.pragma).toBe('no-cache')
        expect(rotated.body.token).toBe('mqic_synthetic-replacement-secret')
        await request(app.getHttpServer())
            .post(`${target}/revoke`)
            .set(headers)
            .send(stepUp)
            .expect(200)
            .expect({ revoked: false })
        await request(app.getHttpServer())
            .delete(target)
            .set(headers)
            .expect(200)
            .expect({ deleted: true })
        expect(management.rotate).toHaveBeenCalledWith(
            'workspace-1',
            'admin-1',
            'integration-1',
            'credential-1',
            expect.objectContaining({ scopes: [], current_password: 'correct-horse-battery' }),
        )
        expect(management.revoke).toHaveBeenCalledWith(
            'workspace-1',
            'admin-1',
            'integration-1',
            'credential-1',
            stepUp,
        )
        expect(management.remove).toHaveBeenCalledWith(
            'workspace-1',
            'integration-1',
            'credential-1',
            'admin-1',
        )
        expect(managementRateLimit.consumeManagementStepUp).toHaveBeenCalledWith(
            'admin-1',
            expect.any(String),
        )
    })

    it('rejects unknown properties before mutation and audits only a bounded denial', async () => {
        await request(app.getHttpServer())
            .post(root)
            .set(headers)
            .send({ ...createBody(), token: 'mqic_client-supplied-secret' })
            .expect(400)
        expect(management.create).not.toHaveBeenCalled()
        expect(managementAudit.denied).toHaveBeenCalledWith(
            expect.anything(),
            'create',
            { userId: 'admin-1', workspaceId: 'workspace-1' },
            400,
            'REQUEST',
            true,
        )
        expect(managementAudit.denied.mock.calls[0]?.slice(1)).toEqual([
            'create',
            { userId: 'admin-1', workspaceId: 'workspace-1' },
            400,
            'REQUEST',
            true,
        ])
    })

    it('denies a missing session, ordinary member, and outsider without calling management services', async () => {
        await request(app.getHttpServer()).get(root).set('x-test-no-session', '1').expect(401)
        await request(app.getHttpServer())
            .get(`${root}/integration-1`)
            .set('x-test-role', 'member')
            .expect(403)
        await request(app.getHttpServer()).get(root).set('x-test-outsider', '1').expect(404)
        expect(management.get).not.toHaveBeenCalled()
        expect(management.list).not.toHaveBeenCalled()
        expect(managementAudit.denied).toHaveBeenCalledTimes(3)
    })

    it('audits failed high-risk step-up without retaining password or second-factor data', async () => {
        management.rotate.mockRejectedValueOnce(
            new UnauthorizedException('Current password is incorrect'),
        )
        const response = await request(app.getHttpServer())
            .post(`${root}/integration-1/credentials/credential-1/rotate`)
            .set(headers)
            .send({
                expires_at: expiresAt(),
                current_password: 'submitted-secret',
                two_factor_token: '123456',
            })
            .expect(401)
        expect(response.body.message).toBe('Current password is incorrect')
        expect(managementAudit.denied).toHaveBeenCalledWith(
            expect.anything(),
            'rotate',
            { userId: 'admin-1', workspaceId: 'workspace-1' },
            401,
            'REQUEST',
            true,
        )
        expect(managementAudit.denied.mock.calls[0]?.slice(1)).toEqual([
            'rotate',
            { userId: 'admin-1', workspaceId: 'workspace-1' },
            401,
            'REQUEST',
            true,
        ])
    })

    it('audits CSRF failures before the handler and returns no-store headers', async () => {
        const response = await request(app.getHttpServer())
            .post(`${root}/integration-1/credentials/credential-1/revoke`)
            .send({ current_password: 'submitted-secret' })
            .expect(403)
        expect(response.headers['cache-control']).toBe('no-store')
        expect(response.headers.pragma).toBe('no-cache')
        expect(managementAudit.csrfDenied).toHaveBeenCalledTimes(1)
        expect(management.revoke).not.toHaveBeenCalled()
    })

    it('rate-limits step-up operations before handlers and audits with Retry-After', async () => {
        managementRateLimit.consumeManagementStepUp.mockRejectedValueOnce(
            new IntegrationRateLimitExceededError(120),
        )

        const response = await request(app.getHttpServer())
            .post(root)
            .set(headers)
            .send(createBody())
            .expect(429)

        expect(response.headers['retry-after']).toBe('120')
        expect(response.headers['cache-control']).toBe('no-store')
        expect(management.create).not.toHaveBeenCalled()
        expect(managementAudit.denied).toHaveBeenCalledWith(
            expect.anything(),
            'create',
            { userId: 'admin-1', workspaceId: 'workspace-1' },
            429,
            'AUTHORIZATION',
            true,
        )
    })
})
