import { ConflictException, NotFoundException } from '@nestjs/common'
import { PaymentSourcesRepository } from './payment-sources.repository'
import { PaymentSourcesService } from './payment-sources.service'

describe('PaymentSourcesService', () => {
    let service: PaymentSourcesService
    let transactionClient: object
    let prisma: {
        $transaction: jest.Mock
    }
    let paymentSourcesRepository: jest.Mocked<
        Pick<
            PaymentSourcesRepository,
            | 'archivePaymentSource'
            | 'createPaymentSource'
            | 'findPaymentSourceById'
            | 'findActivePaymentSourceByName'
            | 'findSystemCashPaymentSource'
            | 'resetLastPaymentSourcePreferences'
            | 'listPaymentSourcesByWorkspace'
            | 'updatePaymentSource'
        >
    >

    beforeEach(() => {
        transactionClient = {}
        prisma = {
            $transaction: jest.fn(async (callback: (tx: object) => Promise<unknown>) =>
                callback(transactionClient),
            ),
        }
        paymentSourcesRepository = {
            archivePaymentSource: jest.fn(),
            createPaymentSource: jest.fn(),
            findPaymentSourceById: jest.fn(),
            findActivePaymentSourceByName: jest.fn(),
            findSystemCashPaymentSource: jest.fn(),
            resetLastPaymentSourcePreferences: jest.fn(),
            listPaymentSourcesByWorkspace: jest.fn(),
            updatePaymentSource: jest.fn(),
        }

        paymentSourcesRepository.findActivePaymentSourceByName.mockResolvedValue(null)
        paymentSourcesRepository.findSystemCashPaymentSource.mockResolvedValue(
            createStoredPaymentSource({
                id: 'cash-1',
                name: 'Cash',
                type: 'cash',
                systemKey: 'cash',
            }) as never,
        )

        service = new PaymentSourcesService(
            prisma as never,
            paymentSourcesRepository as unknown as PaymentSourcesRepository,
        )
    })

    it('lists active payment sources by default', async () => {
        paymentSourcesRepository.listPaymentSourcesByWorkspace.mockResolvedValue([
            createStoredPaymentSource({
                id: 'payment-source-1',
                name: 'Cash Wallet',
                type: 'cash',
            }),
        ] as never)

        await expect(service.listPaymentSources({}, ' workspace-1 ')).resolves.toEqual([
            {
                id: 'payment-source-1',
                workspace_id: 'workspace-1',
                name: 'Cash Wallet',
                type: 'cash',
                system_key: null,
                is_archived: false,
                archived_at: null,
                created_at: new Date('2026-03-24T10:00:00.000Z'),
                updated_at: new Date('2026-03-24T10:00:00.000Z'),
            },
        ])

        expect(paymentSourcesRepository.listPaymentSourcesByWorkspace).toHaveBeenCalledWith(
            'workspace-1',
            false,
            prisma as never,
        )
    })

    it('includes archived payment sources when include_archived=true', async () => {
        paymentSourcesRepository.listPaymentSourcesByWorkspace.mockResolvedValue([] as never)

        await service.listPaymentSources({ includeArchived: true }, 'workspace-1')

        expect(paymentSourcesRepository.listPaymentSourcesByWorkspace).toHaveBeenCalledWith(
            'workspace-1',
            true,
            prisma as never,
        )
    })

    it('creates a payment source with trimmed values', async () => {
        paymentSourcesRepository.createPaymentSource.mockResolvedValue(
            createStoredPaymentSource({
                id: 'payment-source-1',
                name: 'Travel Card',
                type: 'debit_card',
            }) as never,
        )

        await expect(
            service.createPaymentSource(
                {
                    name: ' Travel Card ',
                    type: 'debit_card',
                },
                ' workspace-1 ',
                ' user-1 ',
            ),
        ).resolves.toEqual({
            id: 'payment-source-1',
            workspace_id: 'workspace-1',
            name: 'Travel Card',
            type: 'debit_card',
            system_key: null,
            is_archived: false,
            archived_at: null,
            created_at: new Date('2026-03-24T10:00:00.000Z'),
            updated_at: new Date('2026-03-24T10:00:00.000Z'),
        })

        expect(paymentSourcesRepository.createPaymentSource).toHaveBeenCalledWith(
            {
                workspaceId: 'workspace-1',
                userId: 'user-1',
                name: 'Travel Card',
                type: 'debit_card',
            },
            prisma as never,
        )
    })

    it('rejects a duplicate active payment source name case-insensitively', async () => {
        paymentSourcesRepository.findActivePaymentSourceByName.mockResolvedValue(
            createStoredPaymentSource({ id: 'existing-1', name: 'Revolut', type: 'bank' }) as never,
        )

        await expect(
            service.createPaymentSource({ name: 'revolut', type: 'bank' }, 'workspace-1', 'user-1'),
        ).rejects.toBeInstanceOf(ConflictException)

        expect(paymentSourcesRepository.createPaymentSource).not.toHaveBeenCalled()
    })
    it('updates an active payment source', async () => {
        const existingPaymentSource = createStoredPaymentSource({
            id: 'payment-source-1',
            name: 'Cash Wallet',
            type: 'cash',
        })
        const updatedPaymentSource = createStoredPaymentSource({
            id: 'payment-source-1',
            name: 'Main Bank',
            type: 'bank',
        })

        paymentSourcesRepository.findPaymentSourceById.mockResolvedValue(
            existingPaymentSource as never,
        )
        paymentSourcesRepository.updatePaymentSource.mockResolvedValue(
            updatedPaymentSource as never,
        )

        await expect(
            service.updatePaymentSource(
                {
                    name: ' Main Bank ',
                    type: 'bank',
                },
                ' payment-source-1 ',
                ' workspace-1 ',
                ' user-1 ',
            ),
        ).resolves.toEqual({
            id: 'payment-source-1',
            workspace_id: 'workspace-1',
            name: 'Main Bank',
            type: 'bank',
            system_key: null,
            is_archived: false,
            archived_at: null,
            created_at: new Date('2026-03-24T10:00:00.000Z'),
            updated_at: new Date('2026-03-24T10:00:00.000Z'),
        })

        expect(paymentSourcesRepository.findPaymentSourceById).toHaveBeenCalledWith(
            'workspace-1',
            'payment-source-1',
            false,
            transactionClient as never,
        )
        expect(paymentSourcesRepository.updatePaymentSource).toHaveBeenCalledWith(
            {
                workspaceId: 'workspace-1',
                paymentSourceId: 'payment-source-1',
                userId: 'user-1',
                name: 'Main Bank',
                type: 'bank',
                previousPaymentSource: existingPaymentSource,
            },
            transactionClient as never,
        )
    })

    it('protects the system cash payment source from updates', async () => {
        paymentSourcesRepository.findPaymentSourceById.mockResolvedValue(
            createStoredPaymentSource({
                id: 'cash-1',
                name: 'Cash',
                type: 'cash',
                systemKey: 'cash',
            }) as never,
        )

        await expect(
            service.updatePaymentSource(
                { name: 'Wallet', type: 'cash' },
                'cash-1',
                'workspace-1',
                'user-1',
            ),
        ).rejects.toBeInstanceOf(ConflictException)

        expect(paymentSourcesRepository.updatePaymentSource).not.toHaveBeenCalled()
    })
    it('returns not found when updating a missing payment source', async () => {
        paymentSourcesRepository.findPaymentSourceById.mockResolvedValue(null)

        await expect(
            service.updatePaymentSource(
                {
                    name: 'Main Bank',
                    type: 'bank',
                },
                'payment-source-404',
                'workspace-1',
                'user-1',
            ),
        ).rejects.toBeInstanceOf(NotFoundException)
    })

    it('archives an active payment source', async () => {
        const existingPaymentSource = createStoredPaymentSource({
            id: 'payment-source-1',
            name: 'Old Card',
            type: 'credit_card',
        })

        paymentSourcesRepository.findPaymentSourceById.mockResolvedValue(
            existingPaymentSource as never,
        )
        paymentSourcesRepository.archivePaymentSource.mockResolvedValue(true)

        const result = await service.archivePaymentSource(
            ' payment-source-1 ',
            ' workspace-1 ',
            ' user-1 ',
        )

        expect(result).toEqual(
            expect.objectContaining({
                id: 'payment-source-1',
                workspace_id: 'workspace-1',
                name: 'Old Card',
                type: 'credit_card',
                is_archived: true,
            }),
        )
        expect(result.archived_at).toBeInstanceOf(Date)
        expect(paymentSourcesRepository.resetLastPaymentSourcePreferences).toHaveBeenCalledWith(
            'workspace-1',
            'payment-source-1',
            'cash-1',
            transactionClient,
        )
        expect(paymentSourcesRepository.archivePaymentSource).toHaveBeenCalledWith(
            expect.objectContaining({
                workspaceId: 'workspace-1',
                paymentSourceId: 'payment-source-1',
                userId: 'user-1',
                paymentSource: existingPaymentSource,
                archivedAt: expect.any(Date),
            }),
            transactionClient as never,
        )
    })
})

function createStoredPaymentSource(input: {
    id: string
    name: string
    type: string
    systemKey?: string
}) {
    return {
        id: input.id,
        workspaceId: 'workspace-1',
        name: input.name,
        type: input.type,
        systemKey: input.systemKey ?? null,
        createdAt: new Date('2026-03-24T10:00:00.000Z'),
        updatedAt: new Date('2026-03-24T10:00:00.000Z'),
        deletedAt: null,
    }
}
