import { UnauthorizedException } from '@nestjs/common'
import { AuditService } from '../../shared/audit/audit.service'
import { PrismaService } from '../../shared/database/prisma.service'
import {
    createIntegrationCredentialToken,
    digestIntegrationToken,
    IntegrationCredentialService,
} from './integration-credential.service'

describe('IntegrationCredentialService', () => {
    const now = new Date('2026-09-04T10:00:00.000Z')
    const token = 'mqic_abcdefghijkl.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12'
    let prisma: {
        integrationCredential: { findUnique: jest.Mock; updateMany: jest.Mock }
    }
    let service: IntegrationCredentialService

    beforeEach(() => {
        prisma = {
            integrationCredential: {
                findUnique: jest.fn(),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
        }
        service = new IntegrationCredentialService(
            prisma as never as PrismaService,
            { record: jest.fn() } as never as AuditService,
        )
    })

    it('creates an opaque 256-bit bearer token with an independent prefix', () => {
        const material = createIntegrationCredentialToken()

        expect(material.token).toMatch(/^mqic_[A-Za-z0-9_-]{12}\.[A-Za-z0-9_-]{43}$/)
        expect(material.tokenPrefix).toMatch(/^mqic_[A-Za-z0-9_-]{12}$/)
        expect(digestIntegrationToken(material.token)).not.toContain(material.token)
    })

    it('authenticates only an active, unexpired credential and returns no user session data', async () => {
        prisma.integrationCredential.findUnique.mockResolvedValue({
            id: 'credential-1',
            integrationId: 'integration-1',
            tokenDigest: digestIntegrationToken(token),
            status: 'active',
            revokedAt: null,
            expiresAt: new Date('2026-10-01T00:00:00.000Z'),
            lastUsedAt: null,
            scopes: ['transactions:create'],
            allowedCidrs: [],
            integration: { workspaceId: 'workspace-1', status: 'active' },
            categoryRestrictions: [{ categoryId: 'category-1' }],
            paymentSourceRestrictions: [{ paymentSourceId: 'source-1' }],
        })

        await expect(
            service.authenticateAuthorizationHeader(`Bearer ${token}`, '127.0.0.1', now),
        ).resolves.toEqual({
            integrationId: 'integration-1',
            credentialId: 'credential-1',
            workspaceId: 'workspace-1',
            scopes: ['transactions:create'],
            allowedCategoryIds: ['category-1'],
            allowedPaymentSourceIds: ['source-1'],
            allowedCidrs: [],
        })
        expect(prisma.integrationCredential.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ data: { lastUsedAt: now } }),
        )
    })

    it('returns the same generic failure for unknown, expired, and revoked credentials', async () => {
        const failures = [
            undefined,
            null,
            {
                id: 'credential-1',
                integrationId: 'integration-1',
                tokenDigest: digestIntegrationToken(token),
                status: 'active',
                revokedAt: null,
                expiresAt: new Date('2026-08-01T00:00:00.000Z'),
                lastUsedAt: null,
                scopes: [],
                allowedCidrs: [],
                integration: { workspaceId: 'workspace-1', status: 'active' },
                categoryRestrictions: [],
                paymentSourceRestrictions: [],
            },
            {
                id: 'credential-1',
                integrationId: 'integration-1',
                tokenDigest: digestIntegrationToken(token),
                status: 'revoked',
                revokedAt: now,
                expiresAt: new Date('2026-10-01T00:00:00.000Z'),
                lastUsedAt: null,
                scopes: [],
                allowedCidrs: [],
                integration: { workspaceId: 'workspace-1', status: 'active' },
                categoryRestrictions: [],
                paymentSourceRestrictions: [],
            },
        ]

        for (const credential of failures) {
            prisma.integrationCredential.findUnique.mockResolvedValueOnce(credential)
            await expect(
                service.authenticateAuthorizationHeader(`Bearer ${token}`, '127.0.0.1', now),
            ).rejects.toEqual(
                expect.objectContaining({ message: 'Integration authentication failed' }),
            )
        }

        await expect(
            service.authenticateAuthorizationHeader(undefined, '127.0.0.1', now),
        ).rejects.toBeInstanceOf(UnauthorizedException)
    })

    it('records a rotation without recording a bearer value', async () => {
        const audit = { record: jest.fn().mockResolvedValue(undefined) }
        const previous = {
            id: 'credential-1',
            integrationId: 'integration-1',
            tokenPrefix: 'mqic_previous',
            status: 'active',
            revokedAt: null,
            scopes: ['transactions:create'],
            categoryAllowlistEnabled: false,
            paymentSourceAllowlistEnabled: false,
            cidrAllowlistEnabled: false,
            allowedCidrs: [],
            categoryRestrictions: [],
            paymentSourceRestrictions: [],
            integration: { workspaceId: 'workspace-1', createdByUserId: 'user-1' },
        }
        const transaction = {
            integrationCredential: {
                findUnique: jest.fn().mockResolvedValue(previous),
                create: jest.fn().mockResolvedValue({
                    id: 'credential-2',
                    tokenPrefix: 'mqic_replacement',
                    expiresAt: new Date('2026-10-01T00:00:00.000Z'),
                }),
                update: jest.fn().mockResolvedValue({}),
            },
            auditEvent: { create: jest.fn() },
        }
        const rotatePrisma = {
            $transaction: jest.fn((callback) => callback(transaction)),
        }
        const rotatingService = new IntegrationCredentialService(
            rotatePrisma as never as PrismaService,
            audit as never as AuditService,
        )

        await rotatingService.rotateCredential(
            'credential-1',
            new Date('2026-10-01T00:00:00.000Z'),
            now,
        )

        expect(audit.record).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'INTEGRATION_CREDENTIAL_ROTATED',
                entityId: 'credential-2',
                metadata: expect.objectContaining({
                    previous_credential_id: 'credential-1',
                    previous_token_prefix: 'mqic_previous',
                    token_prefix: 'mqic_replacement',
                }),
            }),
            transaction,
        )
        expect(JSON.stringify(audit.record.mock.calls)).not.toContain('mqic_abcdefghijkl')
    })
})
