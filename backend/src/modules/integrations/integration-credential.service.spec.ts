/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, UnauthorizedException } from '@nestjs/common'
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
    const membership = { workspaceId: 'workspace-1', role: 'admin' }
    const activeCredential = (overrides: Record<string, unknown> = {}) => ({
        id: 'credential-1',
        integrationId: 'integration-1',
        tokenDigest: digestIntegrationToken(token),
        status: 'active',
        revokedAt: null,
        createdAt: new Date('2026-09-04T09:00:00.000Z'),
        expiresAt: new Date('2026-10-01T00:00:00.000Z'),
        lastUsedAt: null,
        scopes: ['transactions:create'],
        allowedCidrs: [],
        cidrAllowlistEnabled: false,
        categoryAllowlistEnabled: true,
        paymentSourceAllowlistEnabled: true,
        integration: {
            id: 'integration-1',
            workspaceId: 'workspace-1',
            status: 'active',
            createdByUserId: 'user-1',
            creatorReference: 'user-1',
            createdBy: { memberships: [membership] },
        },
        categoryRestrictions: [{ categoryId: 'category-1' }],
        paymentSourceRestrictions: [{ paymentSourceId: 'source-1' }],
        ...overrides,
    })
    let prisma: any
    let audit: { record: jest.Mock }
    let service: IntegrationCredentialService

    beforeEach(() => {
        prisma = {
            integrationCredential: {
                findUnique: jest.fn(),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
        }
        audit = { record: jest.fn().mockResolvedValue(undefined) }
        service = new IntegrationCredentialService(
            prisma as PrismaService,
            audit as unknown as AuditService,
        )
    })

    it('creates 256-bit bearer secrets with a separate random public prefix', () => {
        const a = createIntegrationCredentialToken()
        const b = createIntegrationCredentialToken()
        expect(a.token).toMatch(/^mqic_[A-Za-z0-9_-]{12}\.[A-Za-z0-9_-]{43}$/)
        expect(a.tokenPrefix).toMatch(/^mqic_[A-Za-z0-9_-]{12}$/)
        expect(a.tokenPrefix).not.toContain('.')
        expect(a.tokenPrefix).not.toBe(b.tokenPrefix)
        expect(digestIntegrationToken(a.token)).not.toContain(a.token)
    })

    it('authenticates a scoped key and attaches no session, user, or role fields', async () => {
        prisma.integrationCredential.findUnique.mockResolvedValue(activeCredential())
        await expect(
            service.authenticateAuthorizationHeader(`Bearer ${token}`, '127.0.0.1', now),
        ).resolves.toEqual({
            integrationId: 'integration-1',
            credentialId: 'credential-1',
            workspaceId: 'workspace-1',
            scopes: ['transactions:create'],
            categoryAllowlistEnabled: true,
            allowedCategoryIds: ['category-1'],
            paymentSourceAllowlistEnabled: true,
            allowedPaymentSourceIds: ['source-1'],
            cidrAllowlistEnabled: false,
            allowedCidrs: [],
        })
        expect(prisma.integrationCredential.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { lastUsedAt: now, lastUsedIp: '127.0.0.1' },
            }),
        )
    })

    it.each([
        ['unknown prefix', null],
        ['wrong digest', activeCredential({ tokenDigest: '0'.repeat(64) })],
        ['expired at the boundary', activeCredential({ expiresAt: now })],
        ['revoked', activeCredential({ status: 'revoked', revokedAt: now })],
        [
            'creator lost admin role',
            activeCredential({
                integration: {
                    ...activeCredential().integration,
                    createdBy: { memberships: [{ workspaceId: 'workspace-1', role: 'member' }] },
                },
            }),
        ],
        [
            'integration disabled',
            activeCredential({
                integration: { ...activeCredential().integration, status: 'deleted' },
            }),
        ],
        ['invalid legacy scope', activeCredential({ scopes: ['transactions:all'] })],
        [
            'IP outside CIDR',
            activeCredential({ allowedCidrs: ['192.0.2.0/24'], cidrAllowlistEnabled: true }),
        ],
    ])('uses the same authentication error for %s', async (_name, credential) => {
        prisma.integrationCredential.findUnique.mockResolvedValue(credential)
        await expect(
            service.authenticateAuthorizationHeader(`Bearer ${token}`, '127.0.0.1', now),
        ).rejects.toThrow('Integration authentication failed')
    })

    it('uses a dummy comparison for malformed and unknown credentials', async () => {
        await expect(
            service.authenticateAuthorizationHeader(undefined, '127.0.0.1', now),
        ).rejects.toBeInstanceOf(UnauthorizedException)
        prisma.integrationCredential.findUnique.mockResolvedValue(null)
        await expect(
            service.authenticateAuthorizationHeader(`Bearer ${token}`, '127.0.0.1', now),
        ).rejects.toBeInstanceOf(UnauthorizedException)
        expect(prisma.integrationCredential.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({ where: { tokenPrefix: 'mqic_abcdefghijkl' } }),
        )
    })

    it('observes a revocation on the next authentication without cached state', async () => {
        let current = activeCredential()
        prisma.integrationCredential.findUnique.mockImplementation(async () => current)
        await expect(
            service.authenticateAuthorizationHeader(`Bearer ${token}`, '127.0.0.1', now),
        ).resolves.toMatchObject({ credentialId: 'credential-1' })

        current = activeCredential({ status: 'revoked', revokedAt: now })
        await expect(
            service.authenticateAuthorizationHeader(`Bearer ${token}`, '127.0.0.1', now),
        ).rejects.toThrow('Integration authentication failed')
        expect(prisma.integrationCredential.findUnique).toHaveBeenCalledTimes(2)
    })

    it('rejects malformed digests without a variable-length timingSafeEqual call', async () => {
        prisma.integrationCredential.findUnique.mockResolvedValue(
            activeCredential({ tokenDigest: 'x' }),
        )
        await expect(
            service.authenticateAuthorizationHeader(`Bearer ${token}`, '127.0.0.1', now),
        ).rejects.toBeInstanceOf(UnauthorizedException)
    })

    it('does not fail authentication when operational last-use metadata cannot be saved', async () => {
        prisma.integrationCredential.findUnique.mockResolvedValue(activeCredential())
        prisma.integrationCredential.updateMany.mockRejectedValue(new Error('database failure'))
        await expect(
            service.authenticateAuthorizationHeader(`Bearer ${token}`, '127.0.0.1', now),
        ).resolves.toMatchObject({
            credentialId: 'credential-1',
            workspaceId: 'workspace-1',
        })
    })

    it('updates last-use metadata no more than once per five minutes', async () => {
        prisma.integrationCredential.findUnique.mockResolvedValue(
            activeCredential({ lastUsedAt: new Date(now.getTime() - 4 * 60_000) }),
        )
        await expect(
            service.authenticateAuthorizationHeader(`Bearer ${token}`, '127.0.0.1', now),
        ).resolves.toMatchObject({ credentialId: 'credential-1' })
        expect(prisma.integrationCredential.updateMany).not.toHaveBeenCalled()
    })

    it('enforces future expiry and the approved 365-day maximum', async () => {
        const create = (expiresAt: Date) =>
            service.createCredential(
                {
                    integrationId: 'integration-1',
                    expiresAt,
                    scopes: [],
                    categoryAllowlistEnabled: false,
                    paymentSourceAllowlistEnabled: false,
                },
                now,
            )
        await expect(create(now)).rejects.toBeInstanceOf(BadRequestException)
        await expect(
            create(new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000 + 1)),
        ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('serializes rotation and audits the actual actor without disclosing the secret', async () => {
        const previous = activeCredential({
            tokenPrefix: 'mqic_previous',
            integration: { ...activeCredential().integration, id: 'integration-1' },
            categoryRestrictions: [],
            paymentSourceRestrictions: [],
        })
        const replacement = activeCredential({
            id: 'credential-2',
            tokenPrefix: 'mqic_replacement',
            expiresAt: new Date(now.getTime() + 86_400_000),
            categoryRestrictions: [],
            paymentSourceRestrictions: [],
        })
        const tx: any = {
            integrationCredential: {
                findUnique: jest.fn().mockResolvedValue(previous),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                create: jest.fn().mockResolvedValue(replacement),
            },
            integration: { findUnique: jest.fn().mockResolvedValue(previous.integration) },
            workspaceMembership: { findUnique: jest.fn().mockResolvedValue(membership) },
            category: { count: jest.fn().mockResolvedValue(0) },
            paymentSource: { count: jest.fn().mockResolvedValue(0) },
            $queryRaw: jest.fn().mockResolvedValue([]),
        }
        const db: any = {
            $transaction: jest.fn((callback: (client: unknown) => unknown) => callback(tx)),
        }
        const rotating = new IntegrationCredentialService(db, audit as unknown as AuditService)
        const result = await rotating.rotateCredential(
            'credential-1',
            replacement.expiresAt,
            now,
            'admin-2',
        )
        expect(result.credentialId).toBe('credential-2')
        expect(tx.integrationCredential.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ integrationId: 'integration-1' }),
            }),
        )
        expect(tx.integrationCredential.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ status: 'active' }) }),
        )
        expect(audit.record).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'admin-2',
                action: 'INTEGRATION_CREDENTIAL_ROTATED',
            }),
            tx,
        )
        expect(JSON.stringify(audit.record.mock.calls)).not.toContain(result.token)
    })
})
