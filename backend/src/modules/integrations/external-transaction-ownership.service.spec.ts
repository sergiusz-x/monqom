/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConflictException, NotFoundException, PreconditionFailedException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import {
    ExternalTransactionCreateCommand,
    ExternalTransactionOwnershipService,
    fingerprintExternalTransactionCreate,
} from './external-transaction-ownership.service'

describe('ExternalTransactionOwnershipService', () => {
    let prisma: any
    let repository: any
    let service: ExternalTransactionOwnershipService
    const principal = {
        integrationId: 'integration-1',
        credentialId: 'credential-1',
        workspaceId: 'workspace-1',
        scopes: ['transactions:create'] as const,
        categoryAllowlistEnabled: false,
        allowedCategoryIds: [],
        paymentSourceAllowlistEnabled: false,
        allowedPaymentSourceIds: [],
        allowedCidrs: [],
    }
    const command: ExternalTransactionCreateCommand = {
        externalId: 'bank-1',
        type: 'expense',
        amount: 1234,
        currency: 'pln',
        date: new Date('2026-09-04T00:00:00.000Z'),
        description: 'Coffee',
        notes: null,
        tags: ['daily'],
        categoryId: 'category-1',
        paymentSourceId: 'source-1',
    }
    const transaction = {
        id: 'transaction-1',
        workspaceId: 'workspace-1',
        integrationId: 'integration-1',
        externalId: 'bank-1',
        version: 1,
        categoryId: 'category-1',
        paymentSourceId: 'source-1',
        type: 'expense',
        amount: 1234,
        currency: 'PLN',
        baseAmount: 1234,
        fxRate: new Prisma.Decimal(1),
        fxRateDate: command.date,
        fxSource: 'legacy',
        date: command.date,
        description: 'Coffee',
        notes: null,
        createdAt: command.date,
        updatedAt: command.date,
        deletedAt: null,
        tags: [
            {
                id: 'tag-1',
                workspaceId: 'workspace-1',
                transactionId: 'transaction-1',
                name: 'daily',
                createdAt: command.date,
                updatedAt: command.date,
            },
        ],
    }

    beforeEach(() => {
        prisma = {
            $transaction: jest.fn((callback) => callback(prisma)),
            integrationIdempotencyRecord: {
                create: jest.fn(),
                update: jest.fn(),
                findUnique: jest.fn(),
                deleteMany: jest.fn(),
            },
            transaction: { findFirst: jest.fn(), updateMany: jest.fn() },
        }
        repository = {
            findCategoryById: jest.fn(),
            findActivePaymentSourceById: jest.fn(),
            createTransactionWithTags: jest.fn(),
        }
        service = new ExternalTransactionOwnershipService(prisma, repository, {
            record: jest.fn(),
        } as any)
        prisma.integrationIdempotencyRecord.create.mockResolvedValue({ id: 'record-1' })
        prisma.integrationIdempotencyRecord.update.mockResolvedValue({})
        repository.findCategoryById.mockResolvedValue({ id: 'category-1', type: 'expense' })
        repository.findActivePaymentSourceById.mockResolvedValue({ id: 'source-1' })
        repository.createTransactionWithTags.mockResolvedValue(transaction)
    })

    it('creates one owned transaction with tags, audit repository path, and completed idempotency record', async () => {
        await expect(
            service.createIdempotently(principal, '0123456789abcdef', command),
        ).resolves.toEqual({ transaction, replayed: false })
        expect(repository.createTransactionWithTags).toHaveBeenCalledWith(
            expect.objectContaining({
                integrationId: 'integration-1',
                externalId: 'bank-1',
                currency: 'PLN',
            }),
            prisma,
        )
        expect(prisma.integrationIdempotencyRecord.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ status: 'completed', responseStatus: 201 }),
            }),
        )
    })

    it('replays an identical completed request without a second create', async () => {
        prisma.integrationIdempotencyRecord.create.mockRejectedValue({ code: 'P2002' })
        prisma.integrationIdempotencyRecord.findUnique.mockResolvedValue({
            operation: 'create',
            targetExternalId: 'bank-1',
            requestFingerprint: fingerprintExternalTransactionCreate(command),
            status: 'completed',
            responseBody: {
                id: 'transaction-1',
                workspaceId: 'workspace-1',
                categoryId: 'category-1',
                paymentSourceId: 'source-1',
                integrationId: 'integration-1',
                externalId: 'bank-1',
                type: 'expense',
                amount: 1234,
                currency: 'PLN',
                baseAmount: 1234,
                fxRate: '1',
                fxRateDate: command.date.toISOString(),
                fxSource: 'legacy',
                date: command.date.toISOString(),
                description: 'Coffee',
                notes: null,
                tags: ['daily'],
                createdAt: command.date.toISOString(),
                updatedAt: command.date.toISOString(),
            },
        })
        const result = await service.createIdempotently(principal, '0123456789abcdef', command)
        expect(result.replayed).toBe(true)
        expect(repository.createTransactionWithTags).not.toHaveBeenCalled()
    })

    it('rejects a key reused for a different normalized request', async () => {
        prisma.integrationIdempotencyRecord.create.mockRejectedValue({ code: 'P2002' })
        prisma.integrationIdempotencyRecord.findUnique.mockResolvedValue({
            operation: 'create',
            targetExternalId: 'bank-1',
            requestFingerprint: 'different',
            status: 'completed',
        })
        await expect(
            service.createIdempotently(principal, '0123456789abcdef', command),
        ).rejects.toBeInstanceOf(ConflictException)
    })

    it('does not leak manual or foreign transactions through ownership lookup', async () => {
        prisma.transaction.findFirst.mockResolvedValue(null)
        await expect(
            service.findOwnedTransaction('workspace-1', 'integration-1', 'manual-row'),
        ).rejects.toBeInstanceOf(NotFoundException)
        expect(prisma.transaction.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ integrationId: 'integration-1', deletedAt: null }),
            }),
        )
    })

    it('rejects an enabled credential allowlist before any financial write', async () => {
        await expect(
            service.createIdempotently(
                { ...principal, categoryAllowlistEnabled: true },
                '0123456789abcdef',
                command,
            ),
        ).rejects.toBeInstanceOf(NotFoundException)
        expect(repository.createTransactionWithTags).not.toHaveBeenCalled()
    })

    it('rejects an update with a stale strong ETag before mutation', async () => {
        prisma.transaction.findFirst.mockResolvedValue({ ...transaction, version: 2 })
        await expect(
            service.updateIdempotently(principal, '0123456789abcdef', 1, command),
        ).rejects.toBeInstanceOf(PreconditionFailedException)
        expect(repository.createTransactionWithTags).not.toHaveBeenCalled()
    })

    it('soft deletes an owned record once with its version in the database predicate', async () => {
        prisma.transaction.findFirst.mockResolvedValue(transaction)
        prisma.transaction.updateMany.mockResolvedValue({ count: 1 })
        await expect(
            service.deleteIdempotently(principal, '1234567890abcdef', 'bank-1', 1),
        ).resolves.toEqual({ replayed: false })
        expect(prisma.transaction.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    integrationId: 'integration-1',
                    version: 1,
                    deletedAt: null,
                }),
            }),
        )
    })
})
