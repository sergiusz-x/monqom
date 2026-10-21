/* eslint-disable @typescript-eslint/no-explicit-any -- Request and Prisma doubles model only exercised fields. */
import { AuditService } from '../../shared/audit/audit.service'
import { PrismaService } from '../../shared/database/prisma.service'
import {
    IntegrationManagementAuditService,
    type ManagementOperation,
} from './integration-management-audit.service'

describe('IntegrationManagementAuditService', () => {
    let prisma: any
    let audit: { record: jest.Mock }
    let service: IntegrationManagementAuditService

    beforeEach(() => {
        prisma = {
            integration: { findFirst: jest.fn() },
            integrationCredential: { findFirst: jest.fn() },
            user: { findFirst: jest.fn() },
            workspaceMembership: { findFirst: jest.fn() },
        }
        audit = { record: jest.fn().mockResolvedValue(undefined) }
        service = new IntegrationManagementAuditService(
            prisma as PrismaService,
            audit as unknown as AuditService,
        )
    })

    function request(path: string, params: Record<string, string> = {}, method = 'GET') {
        return {
            path,
            params,
            method,
            session: { auth: { userId: 'admin-1', sessionVersion: 3 } },
        } as any
    }

    it('audits successful metadata reads with workspace-bound target IDs and the real actor', async () => {
        const req = request('/api/v1/workspaces/workspace-1/integrations/integration-1', {
            workspaceId: 'workspace-1',
            integrationId: 'integration-1',
        })
        prisma.integration.findFirst.mockResolvedValue({ id: 'integration-1' })
        await service.read(req, 'get', { userId: 'admin-1', workspaceId: 'workspace-1' })

        expect(prisma.integration.findFirst).toHaveBeenCalledWith({
            where: { id: 'integration-1', workspaceId: 'workspace-1' },
            select: { id: true },
        })
        expect(audit.record).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'INTEGRATION_MANAGEMENT_READ',
                userId: 'admin-1',
                workspaceId: 'workspace-1',
                entityId: 'integration-1',
                metadata: expect.objectContaining({
                    operation: 'get',
                    outcome: 'succeeded',
                    integration_id: 'integration-1',
                    credential_id: null,
                }),
            }),
        )
    })

    it.each([
        ['create', 'POST', '/api/v1/workspaces/workspace-1/integrations'],
        [
            'rotate',
            'POST',
            '/api/v1/workspaces/workspace-1/integrations/integration-1/credentials/credential-1/rotate',
        ],
        [
            'revoke',
            'POST',
            '/api/v1/workspaces/workspace-1/integrations/integration-1/credentials/credential-1/revoke',
        ],
        [
            'delete',
            'DELETE',
            '/api/v1/workspaces/workspace-1/integrations/integration-1/credentials/credential-1',
        ],
    ] as [ManagementOperation, string, string][])(
        'audits invalid CSRF for %s without trusting target IDs or request data',
        async (operation, method, path) => {
            prisma.user.findFirst.mockResolvedValue({ id: 'admin-1' })
            prisma.workspaceMembership.findFirst.mockResolvedValue({ workspaceId: 'workspace-1' })
            const req = request(
                path,
                {
                    workspaceId: 'workspace-1',
                    integrationId: 'attacker-supplied-id',
                    credentialId: 'secret-from-url',
                },
                method,
            )
            req.body = {
                current_password: 'submitted-password',
                two_factor_token: '654321',
                token: 'mqic_private-secret',
            }
            req.query = { token: 'query-secret' }
            await service.csrfDenied(req)

            expect(prisma.user.findFirst).toHaveBeenCalledWith({
                where: { id: 'admin-1', sessionVersion: 3 },
                select: { id: true },
            })
            expect(audit.record).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'INTEGRATION_MANAGEMENT_DENIED',
                    userId: 'admin-1',
                    workspaceId: 'workspace-1',
                    metadata: expect.objectContaining({
                        operation,
                        outcome: 'denied',
                        status: 403,
                        reason: 'CSRF_DENIED',
                        integration_id: null,
                        credential_id: null,
                        token_prefix: null,
                    }),
                }),
            )
            expect(JSON.stringify(audit.record.mock.calls)).not.toContain('secret-from-url')
            expect(JSON.stringify(audit.record.mock.calls)).not.toContain('submitted-password')
            expect(JSON.stringify(audit.record.mock.calls)).not.toContain('654321')
            expect(JSON.stringify(audit.record.mock.calls)).not.toContain('mqic_private-secret')
            expect(JSON.stringify(audit.record.mock.calls)).not.toContain('query-secret')
        },
    )

    it('resolves a CSRF target from the decoded route when router params are not available', async () => {
        prisma.user.findFirst.mockResolvedValue({ id: 'admin-1' })
        prisma.workspaceMembership.findFirst.mockResolvedValue({ workspaceId: 'workspace-1' })
        prisma.integration.findFirst.mockResolvedValue({ id: 'integration-1' })
        prisma.integrationCredential.findFirst.mockResolvedValue({
            id: 'credential-1',
            tokenPrefix: 'mqic_safe-prefix',
        })
        const req = request(
            '/API/v1/WORKSPACES/workspace-1/INTEGRATIONS/%69ntegration-1/CREDENTIALS/credential-1/ROTATE',
            {},
            'POST',
        )

        await service.csrfDenied(req)

        expect(prisma.workspaceMembership.findFirst).toHaveBeenCalledWith({
            where: { userId: 'admin-1', workspaceId: 'workspace-1' },
            select: { workspaceId: true },
        })
        expect(prisma.integration.findFirst).toHaveBeenCalledWith({
            where: { id: 'integration-1', workspaceId: 'workspace-1' },
            select: { id: true },
        })
        expect(prisma.integrationCredential.findFirst).toHaveBeenCalledWith({
            where: { id: 'credential-1', integrationId: 'integration-1' },
            select: { id: true, tokenPrefix: true },
        })
        expect(audit.record).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'INTEGRATION_MANAGEMENT_DENIED',
                userId: 'admin-1',
                workspaceId: 'workspace-1',
                entityId: 'credential-1',
                metadata: expect.objectContaining({
                    operation: 'rotate',
                    integration_id: 'integration-1',
                    credential_id: 'credential-1',
                    token_prefix: 'mqic_safe-prefix',
                    reason: 'CSRF_DENIED',
                }),
            }),
        )
    })

    it('audits a step-up failure with the scoped target and safe credential prefix only', async () => {
        const req = request(
            '/api/v1/workspaces/workspace-1/integrations/integration-1/credentials/credential-1/rotate',
            {
                integrationId: 'integration-1',
                credentialId: 'credential-1',
            },
            'POST',
        )
        req.body = {
            current_password: 'submitted-password',
            two_factor_token: '123456',
            token: 'mqic_private-secret',
        }
        req.query = { token: 'query-secret' }
        prisma.integration.findFirst.mockResolvedValue({ id: 'integration-1' })
        prisma.integrationCredential.findFirst.mockResolvedValue({
            id: 'credential-1',
            tokenPrefix: 'mqic_public-id',
        })
        await service.denied(
            req,
            'rotate',
            { userId: 'admin-1', workspaceId: 'workspace-1' },
            401,
            'REQUEST',
            true,
        )

        expect(audit.record).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'INTEGRATION_MANAGEMENT_DENIED',
                userId: 'admin-1',
                entityId: 'credential-1',
                metadata: expect.objectContaining({
                    operation: 'rotate',
                    status: 401,
                    reason: 'STEP_UP_DENIED',
                    token_prefix: 'mqic_public-id',
                }),
            }),
        )
        expect(JSON.stringify(audit.record.mock.calls)).not.toContain('submitted-password')
        expect(JSON.stringify(audit.record.mock.calls)).not.toContain('123456')
        expect(JSON.stringify(audit.record.mock.calls)).not.toContain('mqic_private-secret')
        expect(JSON.stringify(audit.record.mock.calls)).not.toContain('query-secret')
    })

    it('does not allow audit persistence failure to produce an unaudited success', async () => {
        audit.record.mockRejectedValue(new Error('audit storage unavailable'))
        await expect(
            service.read(request('/api/v1/workspaces/workspace-1/integrations'), 'list', {
                userId: 'admin-1',
                workspaceId: 'workspace-1',
            }),
        ).rejects.toThrow('Integration audit is unavailable')
    })
})
