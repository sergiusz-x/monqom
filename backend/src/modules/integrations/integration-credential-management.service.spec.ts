/* eslint-disable @typescript-eslint/no-explicit-any -- Narrow transaction doubles model only exercised Prisma calls. */
import { BadRequestException, ConflictException } from '@nestjs/common'
import { AuditService } from '../../shared/audit/audit.service'
import { PrismaService } from '../../shared/database/prisma.service'
import {
    IntegrationCredentialService,
    digestIntegrationToken,
} from './integration-credential.service'

describe('IntegrationCredentialService management lifecycle', () => {
    const now = new Date('2026-10-17T12:00:00.000Z')
    const policy = {
        expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        scopes: [] as string[],
        categoryAllowlistEnabled: true,
        allowedCategoryIds: [] as string[],
        paymentSourceAllowlistEnabled: false,
        allowedPaymentSourceIds: [] as string[],
        cidrAllowlistEnabled: false,
        allowedCidrs: [] as string[],
    }
    const integration = {
        id: 'integration-1',
        workspaceId: 'workspace-1',
        createdByUserId: 'admin-1',
        creatorReference: 'admin-1',
        status: 'active',
    }
    const credential = {
        id: 'credential-1',
        integrationId: integration.id,
        tokenPrefix: 'mqic_abcdefghijkl',
        tokenDigest: digestIntegrationToken(
            'mqic_abcdefghijkl.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO123',
        ),
        expiresAt: policy.expiresAt,
        scopes: [],
        categoryAllowlistEnabled: true,
        paymentSourceAllowlistEnabled: false,
        cidrAllowlistEnabled: false,
        allowedCidrs: [],
        status: 'revoked',
        revokedAt: new Date(now.getTime() - 1000),
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        lastUsedAt: null,
        lastUsedIp: null,
        categoryRestrictions: [],
        paymentSourceRestrictions: [],
        integration,
    }
    let audit: { record: jest.Mock }

    beforeEach(() => {
        audit = { record: jest.fn().mockResolvedValue(undefined) }
    })

    it('creates the integration, first credential, and audit records in one transaction', async () => {
        const issued = {
            ...credential,
            id: 'credential-issued',
            status: 'active',
            revokedAt: null,
            createdAt: now,
            integration,
        }
        const tx: any = {
            integration: { create: jest.fn().mockResolvedValue(integration) },
            integrationCredential: { create: jest.fn().mockResolvedValue(issued) },
            workspaceMembership: { findUnique: jest.fn().mockResolvedValue({ role: 'admin' }) },
            $queryRaw: jest.fn().mockResolvedValue([]),
        }
        const db: any = {
            $transaction: jest.fn((callback: (client: unknown) => unknown) => callback(tx)),
        }
        const service = new IntegrationCredentialService(
            db as PrismaService,
            audit as unknown as AuditService,
        )

        const result = await service.createIntegrationWithCredential(
            {
                workspaceId: integration.workspaceId,
                createdByUserId: integration.createdByUserId,
                name: 'Bookkeeping importer',
                ...policy,
            },
            now,
        )

        expect(db.$transaction).toHaveBeenCalledTimes(1)
        expect(tx.integration.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                workspaceId: integration.workspaceId,
                createdByUserId: integration.createdByUserId,
                creatorReference: integration.createdByUserId,
                name: 'Bookkeeping importer',
            }),
        })
        expect(tx.integrationCredential.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    integrationId: integration.id,
                    scopes: [],
                    tokenDigest: digestIntegrationToken(result.token),
                }),
            }),
        )
        expect(result).toMatchObject({ integrationId: integration.id, credentialId: issued.id })
        expect(audit.record).toHaveBeenCalledTimes(2)
        expect(JSON.stringify(audit.record.mock.calls)).not.toContain(result.token)
        expect(audit.record.mock.calls.every(([, transaction]) => transaction === tx)).toBe(true)
    })

    it.each([
        ['unknown scope', { ...policy, scopes: ['transactions:all'] }],
        ['wildcard scope', { ...policy, scopes: ['*'] }],
        [
            'disabled resource allowlist with IDs',
            {
                ...policy,
                categoryAllowlistEnabled: false,
                allowedCategoryIds: ['foreign-category'],
            },
        ],
        [
            'malformed CIDR',
            { ...policy, cidrAllowlistEnabled: true, allowedCidrs: ['999.1.2.3/24'] },
        ],
        ['empty required policy', { ...policy, categoryAllowlistEnabled: undefined }],
        [
            'expiry outside maximum',
            {
                ...policy,
                expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000 + 1),
            },
        ],
    ])('rejects %s before opening an issuance transaction', async (_label, invalidPolicy) => {
        const db: any = { $transaction: jest.fn() }
        const service = new IntegrationCredentialService(
            db as PrismaService,
            audit as unknown as AuditService,
        )
        await expect(
            service.createIntegrationWithCredential(
                {
                    workspaceId: integration.workspaceId,
                    createdByUserId: integration.createdByUserId,
                    name: 'Importer',
                    ...invalidPolicy,
                } as any,
                now,
            ),
        ).rejects.toBeInstanceOf(BadRequestException)
        expect(db.$transaction).not.toHaveBeenCalled()
        expect(audit.record).not.toHaveBeenCalled()
    })

    it('records an idempotent repeated revocation with the actual actor and safe policy evidence', async () => {
        const tx: any = {
            integrationCredential: {
                findUnique: jest
                    .fn()
                    .mockResolvedValueOnce(credential)
                    .mockResolvedValueOnce(credential),
            },
            workspaceMembership: { findUnique: jest.fn().mockResolvedValue({ role: 'owner' }) },
            $queryRaw: jest.fn().mockResolvedValue([]),
        }
        const db: any = {
            $transaction: jest.fn((callback: (client: unknown) => unknown) => callback(tx)),
        }
        const service = new IntegrationCredentialService(
            db as PrismaService,
            audit as unknown as AuditService,
        )

        await expect(
            service.revokeCredential(credential.id, now, 'owner-2', {
                workspaceId: integration.workspaceId,
                integrationId: integration.id,
            }),
        ).resolves.toBe(false)

        expect(audit.record).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'owner-2',
                action: 'INTEGRATION_CREDENTIAL_REVOKED',
                metadata: expect.objectContaining({
                    reason: 'ALREADY_REVOKED',
                    previous_status: 'revoked',
                    new_status: 'revoked',
                }),
            }),
            tx,
        )
    })

    it('retains a revoked credential and ownership evidence when safely deleting it', async () => {
        const tx: any = {
            integrationCredential: {
                findUnique: jest
                    .fn()
                    .mockResolvedValueOnce(credential)
                    .mockResolvedValueOnce(credential),
                update: jest.fn(),
                count: jest.fn().mockResolvedValue(0),
            },
            integration: { update: jest.fn() },
            workspaceMembership: { findUnique: jest.fn().mockResolvedValue({ role: 'owner' }) },
            $queryRaw: jest.fn().mockResolvedValue([]),
        }
        const db: any = {
            $transaction: jest.fn((callback: (client: unknown) => unknown) => callback(tx)),
        }
        const service = new IntegrationCredentialService(
            db as PrismaService,
            audit as unknown as AuditService,
        )

        await service.deleteCredential(
            credential.id,
            'owner-2',
            { workspaceId: integration.workspaceId, integrationId: integration.id },
            now,
        )

        expect(tx.integrationCredential.update).toHaveBeenCalledWith({
            where: { id: credential.id },
            data: { deletedAt: now },
        })
        expect(tx.integrationCredential.count).toHaveBeenCalledWith({
            where: { integrationId: integration.id, deletedAt: null },
        })
        expect(tx.integration.update).toHaveBeenCalledWith({
            where: { id: integration.id },
            data: { status: 'deleted' },
        })
        expect(audit.record).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'owner-2',
                action: 'INTEGRATION_CREDENTIAL_DELETED',
                metadata: expect.objectContaining({
                    new_status: 'revoked',
                    deleted_at: now.toISOString(),
                    scopes: [],
                    previous_policy: expect.objectContaining({ category_allowlist_enabled: true }),
                }),
            }),
            tx,
        )
    })

    it('does not reveal a foreign workspace credential or delete an active version', async () => {
        const foreignTx: any = {
            integrationCredential: { findUnique: jest.fn().mockResolvedValue(null) },
            $queryRaw: jest.fn(),
        }
        const foreignDb: any = {
            $transaction: jest.fn((callback: (client: unknown) => unknown) => callback(foreignTx)),
        }
        const foreignService = new IntegrationCredentialService(
            foreignDb,
            audit as unknown as AuditService,
        )
        await expect(
            foreignService.deleteCredential(
                credential.id,
                'owner-2',
                { workspaceId: 'other-workspace', integrationId: integration.id },
                now,
            ),
        ).rejects.toThrow('Integration credential not found')
        expect(foreignTx.$queryRaw).not.toHaveBeenCalled()

        const active = { ...credential, status: 'active', revokedAt: null }
        const activeTx: any = {
            integrationCredential: {
                findUnique: jest.fn().mockResolvedValueOnce(active).mockResolvedValueOnce(active),
                update: jest.fn(),
            },
            workspaceMembership: { findUnique: jest.fn().mockResolvedValue({ role: 'owner' }) },
            $queryRaw: jest.fn().mockResolvedValue([]),
        }
        const activeDb: any = {
            $transaction: jest.fn((callback: (client: unknown) => unknown) => callback(activeTx)),
        }
        const activeService = new IntegrationCredentialService(
            activeDb,
            audit as unknown as AuditService,
        )
        await expect(
            activeService.deleteCredential(
                credential.id,
                'owner-2',
                { workspaceId: integration.workspaceId, integrationId: integration.id },
                now,
            ),
        ).rejects.toBeInstanceOf(ConflictException)
        expect(activeTx.integrationCredential.update).not.toHaveBeenCalled()
    })
})
