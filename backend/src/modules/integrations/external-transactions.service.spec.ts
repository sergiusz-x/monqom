/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException } from '@nestjs/common'
import { ExternalTransactionsService } from './external-transactions.service'

describe('ExternalTransactionsService', () => {
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
    let ownership: any
    let workspace: any
    let currency: any
    let prisma: any
    let service: ExternalTransactionsService

    beforeEach(() => {
        ownership = {
            createIdempotently: jest.fn(),
            findOwnedTransaction: jest.fn(),
            updateIdempotently: jest.fn(),
            deleteIdempotently: jest.fn(),
        }
        workspace = { getWorkspaceById: jest.fn().mockResolvedValue({ baseCurrency: 'PLN' }) }
        currency = {
            getHistoricalQuote: jest.fn().mockResolvedValue({
                rate: 1,
                rateDate: new Date('2026-09-04T00:00:00.000Z'),
                source: 'ecb-frankfurter',
            }),
        }
        prisma = { category: { findMany: jest.fn() }, paymentSource: { findMany: jest.fn() } }
        service = new ExternalTransactionsService(ownership, workspace, currency, prisma)
    })

    it('converts an exact decimal string into integer minor units before creating', async () => {
        ownership.createIdempotently.mockResolvedValue({
            replayed: false,
            transaction: {
                id: 'tx-1',
                externalId: 'bank-1',
                version: 1,
                categoryId: 'category-1',
                paymentSourceId: 'source-1',
                type: 'expense',
                amount: 1234,
                currency: 'PLN',
                date: new Date('2026-09-04'),
                description: 'Coffee',
                notes: null,
                tags: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        })
        await service.create(principal, '0123456789abcdef', {
            external_id: 'bank-1',
            amount: '12.34',
            currency: 'PLN',
            date: '2026-09-04',
            description: 'Coffee',
            category_id: 'category-1',
            payment_source_id: 'source-1',
        })
        expect(ownership.createIdempotently).toHaveBeenCalledWith(
            principal,
            '0123456789abcdef',
            expect.objectContaining({ amount: 1234, baseAmount: 1234, currency: 'PLN' }),
        )
    })

    it('queries minimal category metadata only inside the credential allowlist', async () => {
        prisma.category.findMany.mockResolvedValue([])
        await service.listCategories({
            ...principal,
            categoryAllowlistEnabled: true,
            allowedCategoryIds: ['category-1'],
        })
        expect(prisma.category.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    workspaceId: 'workspace-1',
                    deletedAt: null,
                    id: { in: ['category-1'] },
                }),
            }),
        )
    })

    it('rejects an attempt to change the external identity during replacement', async () => {
        await expect(
            service.update(principal, '0123456789abcdef', 'bank-1', 1, {
                external_id: 'bank-2',
                amount: '12.34',
                currency: 'PLN',
                date: '2026-09-04',
                description: 'Coffee',
                category_id: 'category-1',
                payment_source_id: 'source-1',
            }),
        ).rejects.toBeInstanceOf(BadRequestException)
    })
})
