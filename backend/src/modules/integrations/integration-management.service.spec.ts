/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { getRequiredArrayItem } from '../../test-utils/prisma-fixtures'
import { IntegrationManagementService } from './integration-management.service'
import { IntegrationCredentialService } from './integration-credential.service'

describe('IntegrationManagementService', () => {
    const credential = {
        id: 'credential-1',
        tokenPrefix: 'mqic_safe-prefix',
        tokenDigest: 'never-return',
        status: 'active',
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
        expiresAt: new Date(),
        revokedAt: null,
        lastUsedAt: null,
        scopes: ['transactions:create'],
        allowedCidrs: [],
        categoryAllowlistEnabled: true,
        paymentSourceAllowlistEnabled: true,
        cidrAllowlistEnabled: false,
        categoryRestrictions: [{ categoryId: 'category-1' }],
        paymentSourceRestrictions: [{ paymentSourceId: 'source-1' }],
        integrationId: 'integration-1',
    }
    let prisma: any
    let service: IntegrationManagementService

    beforeEach(() => {
        prisma = {
            integration: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
            integrationCredential: { findFirst: jest.fn(), delete: jest.fn(), count: jest.fn() },
            category: { count: jest.fn().mockResolvedValue(1) },
            paymentSource: { count: jest.fn().mockResolvedValue(1) },
        }
        service = new IntegrationManagementService(
            { verifyCurrentPassword: jest.fn() } as any,
            { verifyStepUp: jest.fn() } as any,
            {
                validateCredentialPolicy:
                    IntegrationCredentialService.prototype.validateCredentialPolicy,
                createIntegrationWithCredential: jest.fn(),
                revokeCredential: jest.fn(),
                rotateCredential: jest.fn(),
                deleteCredential: jest.fn(),
            } as any,
            prisma,
        )
    })

    it('never returns the credential digest from listings', async () => {
        prisma.integration.findMany.mockResolvedValue([
            {
                id: 'integration-1',
                creatorReference: 'user-1',
                name: 'Importer',
                status: 'active',
                createdAt: new Date('2026-09-01T00:00:00.000Z'),
                createdBy: { id: 'user-1', name: 'Ada' },
                credentials: [credential],
            },
        ])
        const result = await service.list('workspace-1')
        expect(JSON.stringify(result)).not.toContain('never-return')
        const integration = getRequiredArrayItem(result, 0)
        expect(getRequiredArrayItem(integration.credentials, 0)).toEqual(
            expect.objectContaining({ token_prefix: 'mqic_safe-prefix' }),
        )
        expect(getRequiredArrayItem(integration.credentials, 0)).toEqual(
            expect.objectContaining({
                category_ids: ['category-1'],
                payment_source_ids: ['source-1'],
            }),
        )
    })

    it('does not disclose a foreign integration', async () => {
        prisma.integration.findFirst.mockResolvedValue(null)
        await expect(service.get('workspace-1', 'foreign')).rejects.toBeInstanceOf(
            NotFoundException,
        )
    })

    it('requires an explicit resource policy for a transaction creator', async () => {
        await expect(
            service.create('workspace-1', 'user-1', {
                name: 'Importer',
                expires_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
                scopes: ['transactions:create'],
                current_password: 'password',
            }),
        ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('rejects an expiry outside the permitted credential lifetime', async () => {
        await expect(
            service.create('workspace-1', 'user-1', {
                name: 'Importer',
                expires_at: '2099-01-01T00:00:00.000Z',
                scopes: [],
                current_password: 'password',
            }),
        ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('propagates a rejected safe deletion without returning success', async () => {
        const credentialService = (service as any).credentialService
        credentialService.deleteCredential.mockRejectedValue(
            new ConflictException('Credential must be revoked before deletion'),
        )
        await expect(
            service.remove('workspace-1', 'integration-1', 'credential-1', 'admin-2'),
        ).rejects.toBeInstanceOf(ConflictException)
        expect(prisma.integrationCredential.delete).not.toHaveBeenCalled()
    })

    it('uses safe deletion with the actual administrator and workspace-bound target', async () => {
        const credentialService = (service as any).credentialService
        credentialService.deleteCredential.mockResolvedValue(undefined)

        await expect(
            service.remove('workspace-1', 'integration-1', 'credential-1', 'admin-2'),
        ).resolves.toEqual({
            deleted: true,
        })

        expect(credentialService.deleteCredential).toHaveBeenCalledWith('credential-1', 'admin-2', {
            workspaceId: 'workspace-1',
            integrationId: 'integration-1',
        })
        expect(prisma.integrationCredential.delete).not.toHaveBeenCalled()
    })

    it('uses the atomic credential rotation operation', async () => {
        prisma.integrationCredential.findFirst.mockResolvedValue(credential)
        const credentialService = (service as any).credentialService
        credentialService.rotateCredential.mockResolvedValue({
            credentialId: 'credential-2',
            token: 'mqic_new.secret',
            tokenPrefix: 'mqic_new',
            expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        })
        const result = await service.rotate(
            'workspace-1',
            'user-1',
            'integration-1',
            'credential-1',
            {
                expires_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
                current_password: 'password',
            },
        )
        expect(credentialService.rotateCredential).toHaveBeenCalledWith(
            'credential-1',
            expect.any(Date),
            expect.any(Date),
            'user-1',
            { workspaceId: 'workspace-1', integrationId: 'integration-1' },
            expect.objectContaining({
                scopes: credential.scopes,
                allowedCategoryIds: ['category-1'],
                allowedPaymentSourceIds: ['source-1'],
            }),
        )
        expect(credentialService.revokeCredential).not.toHaveBeenCalled()
        expect(result.token).toBe('mqic_new.secret')
    })

    it('requires password and two-factor step-up before revocation', async () => {
        prisma.integrationCredential.findFirst.mockResolvedValue(credential)
        const authService = (service as any).authService
        const twoFactorService = (service as any).twoFactorService
        const credentialService = (service as any).credentialService
        credentialService.revokeCredential.mockResolvedValue(true)
        await service.revoke('workspace-1', 'user-1', 'integration-1', 'credential-1', {
            current_password: 'password',
            two_factor_token: '123456',
        })
        expect(authService.verifyCurrentPassword).toHaveBeenCalledWith('user-1', 'password')
        expect(twoFactorService.verifyStepUp).toHaveBeenCalledWith('user-1', '123456')
        expect(credentialService.revokeCredential).toHaveBeenCalledWith(
            'credential-1',
            expect.any(Date),
            'user-1',
            { workspaceId: 'workspace-1', integrationId: 'integration-1' },
        )
    })
})
