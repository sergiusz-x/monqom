import { BadRequestException, NotFoundException } from '@nestjs/common'
import { TransactionsRepository } from './transactions.repository'
import { TransactionsService } from './transactions.service'

describe('TransactionsService', () => {
    let service: TransactionsService
    let transactionClient: object
    let prisma: {
        $transaction: jest.Mock
    }
    let transactionsRepository: jest.Mocked<
        Pick<
            TransactionsRepository,
            | 'countTransactions'
            | 'createTransactionWithTags'
            | 'findActivePaymentSourceById'
            | 'findCategoryById'
            | 'findTransactionById'
            | 'listTransactions'
            | 'listWorkspaceTags'
            | 'softDeleteTransaction'
            | 'updateTransactionWithTags'
        >
    >

    beforeEach(() => {
        transactionClient = {}
        prisma = {
            $transaction: jest.fn(async (callback: (tx: object) => Promise<unknown>) =>
                callback(transactionClient),
            ),
        }
        transactionsRepository = {
            countTransactions: jest.fn(),
            createTransactionWithTags: jest.fn(),
            findActivePaymentSourceById: jest.fn(),
            findCategoryById: jest.fn(),
            findTransactionById: jest.fn(),
            listTransactions: jest.fn(),
            listWorkspaceTags: jest.fn(),
            softDeleteTransaction: jest.fn(),
            updateTransactionWithTags: jest.fn(),
        }

        service = new TransactionsService(
            prisma as never,
            transactionsRepository as unknown as TransactionsRepository,
        )
    })

    it('creates an expense transaction and leaves case-insensitive tag normalization to the repository layer', async () => {
        const createdTransaction = {
            id: 'transaction-1',
            workspaceId: 'workspace-1',
            categoryId: 'category-1',
            paymentSourceId: 'payment-source-1',
            type: 'expense',
            amount: 1050,
            currency: 'USD',
            date: new Date('2026-03-23T00:00:00.000Z'),
            description: 'Team lunch',
            notes: 'Lunch with the team',
            createdAt: new Date('2026-03-23T12:00:00.000Z'),
            updatedAt: new Date('2026-03-23T12:00:00.000Z'),
            deletedAt: null,
            tags: [
                {
                    id: 'tag-1',
                    workspaceId: 'workspace-1',
                    transactionId: 'transaction-1',
                    name: 'Food',
                    createdAt: new Date('2026-03-23T12:00:01.000Z'),
                    updatedAt: new Date('2026-03-23T12:00:01.000Z'),
                },
                {
                    id: 'tag-2',
                    workspaceId: 'workspace-1',
                    transactionId: 'transaction-1',
                    name: 'Work',
                    createdAt: new Date('2026-03-23T12:00:02.000Z'),
                    updatedAt: new Date('2026-03-23T12:00:02.000Z'),
                },
            ],
        }

        transactionsRepository.findCategoryById.mockResolvedValue({ id: 'category-1' } as never)
        transactionsRepository.findActivePaymentSourceById.mockResolvedValue({
            id: 'payment-source-1',
        } as never)
        transactionsRepository.createTransactionWithTags.mockResolvedValue(
            createdTransaction as never,
        )

        await expect(
            service.createTransaction(
                {
                    amount: 10.5,
                    date: '2026-03-23',
                    description: 'Team lunch',
                    categoryId: ' category-1 ',
                    paymentSourceId: ' payment-source-1 ',
                    notes: ' Lunch with the team ',
                    tags: [' Food ', 'food', ' Work '],
                },
                ' workspace-1 ',
                ' user-1 ',
            ),
        ).resolves.toEqual({
            id: 'transaction-1',
            workspace_id: 'workspace-1',
            category_id: 'category-1',
            payment_source_id: 'payment-source-1',
            type: 'expense',
            amount: 10.5,
            currency: 'USD',
            date: '2026-03-23',
            description: 'Team lunch',
            notes: 'Lunch with the team',
            tags: ['Food', 'Work'],
            created_at: new Date('2026-03-23T12:00:00.000Z'),
            updated_at: new Date('2026-03-23T12:00:00.000Z'),
        })

        expect(prisma.$transaction).toHaveBeenCalledTimes(1)
        expect(transactionsRepository.findCategoryById).toHaveBeenCalledWith(
            'workspace-1',
            'category-1',
            transactionClient,
        )
        expect(transactionsRepository.findActivePaymentSourceById).toHaveBeenCalledWith(
            'workspace-1',
            'payment-source-1',
            transactionClient,
        )
        expect(transactionsRepository.createTransactionWithTags).toHaveBeenCalledWith(
            {
                workspaceId: 'workspace-1',
                userId: 'user-1',
                categoryId: 'category-1',
                paymentSourceId: 'payment-source-1',
                type: 'expense',
                amount: 1050,
                currency: 'USD',
                date: new Date('2026-03-23T00:00:00.000Z'),
                description: 'Team lunch',
                notes: 'Lunch with the team',
                tags: ['Food', 'food', 'Work'],
            },
            transactionClient,
        )
    })

    it('returns a single transaction by id with tags and a display amount', async () => {
        transactionsRepository.findTransactionById.mockResolvedValue({
            id: 'transaction-7',
            workspaceId: 'workspace-1',
            categoryId: 'category-2',
            paymentSourceId: 'payment-source-1',
            type: 'expense',
            amount: 2575,
            currency: 'USD',
            date: new Date('2026-03-24T08:30:00.000Z'),
            description: 'Coffee beans',
            notes: 'Coffee beans',
            createdAt: new Date('2026-03-24T08:30:00.000Z'),
            updatedAt: new Date('2026-03-24T08:30:00.000Z'),
            deletedAt: null,
            tags: [
                {
                    id: 'tag-7',
                    workspaceId: 'workspace-1',
                    transactionId: 'transaction-7',
                    name: 'Food',
                    createdAt: new Date('2026-03-24T08:30:01.000Z'),
                    updatedAt: new Date('2026-03-24T08:30:01.000Z'),
                },
                {
                    id: 'tag-8',
                    workspaceId: 'workspace-1',
                    transactionId: 'transaction-7',
                    name: 'Home',
                    createdAt: new Date('2026-03-24T08:30:02.000Z'),
                    updatedAt: new Date('2026-03-24T08:30:02.000Z'),
                },
            ],
        } as never)

        await expect(
            service.getTransactionById(' transaction-7 ', ' workspace-1 '),
        ).resolves.toEqual({
            id: 'transaction-7',
            workspace_id: 'workspace-1',
            category_id: 'category-2',
            payment_source_id: 'payment-source-1',
            type: 'expense',
            amount: 25.75,
            currency: 'USD',
            date: '2026-03-24',
            description: 'Coffee beans',
            notes: 'Coffee beans',
            tags: ['Food', 'Home'],
            created_at: new Date('2026-03-24T08:30:00.000Z'),
            updated_at: new Date('2026-03-24T08:30:00.000Z'),
        })

        expect(prisma.$transaction).not.toHaveBeenCalled()
        expect(transactionsRepository.findTransactionById).toHaveBeenCalledWith(
            'workspace-1',
            'transaction-7',
            prisma,
        )
    })

    it('updates a transaction, validates workspace-scoped references, and replaces tags', async () => {
        transactionsRepository.findTransactionById.mockResolvedValue({
            id: 'transaction-9',
            workspaceId: 'workspace-1',
            categoryId: 'category-1',
            paymentSourceId: 'payment-source-1',
            type: 'expense',
            amount: 1050,
            currency: 'USD',
            date: new Date('2026-03-23T00:00:00.000Z'),
            description: 'Lunch',
            notes: 'Lunch',
            createdAt: new Date('2026-03-23T12:00:00.000Z'),
            updatedAt: new Date('2026-03-23T12:00:00.000Z'),
            deletedAt: null,
            tags: [],
        } as never)
        transactionsRepository.findCategoryById.mockResolvedValue({ id: 'category-2' } as never)
        transactionsRepository.findActivePaymentSourceById.mockResolvedValue({
            id: 'payment-source-2',
        } as never)
        transactionsRepository.updateTransactionWithTags.mockResolvedValue({
            id: 'transaction-9',
            workspaceId: 'workspace-1',
            categoryId: 'category-2',
            paymentSourceId: 'payment-source-2',
            type: 'expense',
            amount: 1275,
            currency: 'USD',
            date: new Date('2026-03-24T08:30:00.000Z'),
            description: 'Bus pass',
            notes: 'Bus pass',
            createdAt: new Date('2026-03-23T12:00:00.000Z'),
            updatedAt: new Date('2026-03-24T09:00:00.000Z'),
            deletedAt: null,
            tags: [
                {
                    id: 'tag-9',
                    workspaceId: 'workspace-1',
                    transactionId: 'transaction-9',
                    name: 'Travel',
                    createdAt: new Date('2026-03-24T09:00:01.000Z'),
                    updatedAt: new Date('2026-03-24T09:00:01.000Z'),
                },
                {
                    id: 'tag-10',
                    workspaceId: 'workspace-1',
                    transactionId: 'transaction-9',
                    name: 'Work',
                    createdAt: new Date('2026-03-24T09:00:02.000Z'),
                    updatedAt: new Date('2026-03-24T09:00:02.000Z'),
                },
            ],
        } as never)

        await expect(
            service.updateTransaction(
                {
                    amount: 12.75,
                    date: '2026-03-24',
                    description: 'Bus pass',
                    categoryId: ' category-2 ',
                    paymentSourceId: ' payment-source-2 ',
                    notes: ' Bus pass ',
                    tags: [' Travel ', 'travel', ' Work '],
                },
                ' transaction-9 ',
                ' workspace-1 ',
            ),
        ).resolves.toEqual({
            id: 'transaction-9',
            workspace_id: 'workspace-1',
            category_id: 'category-2',
            payment_source_id: 'payment-source-2',
            type: 'expense',
            amount: 12.75,
            currency: 'USD',
            date: '2026-03-24',
            description: 'Bus pass',
            notes: 'Bus pass',
            tags: ['Travel', 'Work'],
            created_at: new Date('2026-03-23T12:00:00.000Z'),
            updated_at: new Date('2026-03-24T09:00:00.000Z'),
        })

        expect(prisma.$transaction).toHaveBeenCalledTimes(1)
        expect(transactionsRepository.findTransactionById).toHaveBeenCalledWith(
            'workspace-1',
            'transaction-9',
            transactionClient,
        )
        expect(transactionsRepository.findCategoryById).toHaveBeenCalledWith(
            'workspace-1',
            'category-2',
            transactionClient,
        )
        expect(transactionsRepository.findActivePaymentSourceById).toHaveBeenCalledWith(
            'workspace-1',
            'payment-source-2',
            transactionClient,
        )
        expect(transactionsRepository.updateTransactionWithTags).toHaveBeenCalledWith(
            {
                workspaceId: 'workspace-1',
                transactionId: 'transaction-9',
                categoryId: 'category-2',
                paymentSourceId: 'payment-source-2',
                type: 'expense',
                amount: 1275,
                currency: 'USD',
                date: new Date('2026-03-24T00:00:00.000Z'),
                description: 'Bus pass',
                notes: 'Bus pass',
                tags: ['Travel', 'travel', 'Work'],
            },
            transactionClient,
        )
    })

    it('soft deletes an existing transaction and passes the audit snapshot payload to the repository', async () => {
        const transaction = {
            id: 'transaction-10',
            workspaceId: 'workspace-1',
            categoryId: 'category-1',
            paymentSourceId: 'payment-source-1',
            type: 'expense',
            amount: 1899,
            currency: 'USD',
            date: new Date('2026-03-24T08:30:00.000Z'),
            notes: 'Household items',
            createdAt: new Date('2026-03-24T08:30:00.000Z'),
            updatedAt: new Date('2026-03-24T08:30:00.000Z'),
            deletedAt: null,
            tags: [
                {
                    id: 'tag-11',
                    workspaceId: 'workspace-1',
                    transactionId: 'transaction-10',
                    name: 'Home',
                    createdAt: new Date('2026-03-24T08:30:01.000Z'),
                    updatedAt: new Date('2026-03-24T08:30:01.000Z'),
                },
            ],
        }

        transactionsRepository.findTransactionById.mockResolvedValue(transaction as never)
        transactionsRepository.softDeleteTransaction.mockResolvedValue(true)

        await expect(
            service.deleteTransaction(' transaction-10 ', ' workspace-1 ', ' user-1 '),
        ).resolves.toBeUndefined()

        expect(prisma.$transaction).toHaveBeenCalledTimes(1)
        expect(transactionsRepository.findTransactionById).toHaveBeenCalledWith(
            'workspace-1',
            'transaction-10',
            transactionClient,
        )
        expect(transactionsRepository.softDeleteTransaction).toHaveBeenCalledWith(
            expect.objectContaining({
                workspaceId: 'workspace-1',
                transactionId: 'transaction-10',
                userId: 'user-1',
                transaction,
                deletedAt: expect.any(Date),
            }),
            transactionClient,
        )
    })

    it('lists transactions with trimmed filters, inclusive date ranges, pagination, and display amounts', async () => {
        transactionsRepository.listTransactions.mockResolvedValue([
            {
                id: 'transaction-4',
                workspace_id: 'workspace-1',
                category_id: 'category-1',
                payment_source_id: 'payment-source-2',
                type: 'expense',
                amount: 4050,
                currency: 'USD',
                date: new Date('2026-03-22T09:30:00.000Z'),
                description: 'Train pass',
                notes: 'Train pass',
                tags: ['food', 'Travel'],
                created_at: new Date('2026-03-22T10:00:00.000Z'),
                updated_at: new Date('2026-03-22T10:00:00.000Z'),
            },
        ] as never)
        transactionsRepository.countTransactions.mockResolvedValue(2)

        await expect(
            service.listTransactions(
                {
                    categoryIds: [' category-1 ', 'category-2'],
                    sortBy: 'amount',
                    sortDirection: 'asc',
                    paymentSourceId: ' payment-source-2 ',
                    tag: ' FOOD ',
                    dateFrom: '2026-03-21',
                    dateTo: '2026-03-22',
                    limit: 1,
                    offset: 1,
                },
                ' workspace-1 ',
            ),
        ).resolves.toEqual({
            data: [
                {
                    id: 'transaction-4',
                    workspace_id: 'workspace-1',
                    category_id: 'category-1',
                    payment_source_id: 'payment-source-2',
                    type: 'expense',
                    amount: 40.5,
                    currency: 'USD',
                    date: '2026-03-22',
                    description: 'Train pass',
                    notes: 'Train pass',
                    tags: ['food', 'Travel'],
                    created_at: new Date('2026-03-22T10:00:00.000Z'),
                    updated_at: new Date('2026-03-22T10:00:00.000Z'),
                },
            ],
            total: 2,
            limit: 1,
            offset: 1,
        })

        expect(prisma.$transaction).not.toHaveBeenCalled()
        expect(transactionsRepository.listTransactions).toHaveBeenCalledWith(
            {
                workspaceId: 'workspace-1',
                categoryIds: ['category-1', 'category-2'],
                sortBy: 'amount',
                sortDirection: 'asc',
                paymentSourceId: 'payment-source-2',
                tag: 'FOOD',
                dateFrom: new Date('2026-03-21T00:00:00.000Z'),
                dateTo: new Date('2026-03-22T00:00:00.000Z'),
                limit: 1,
                offset: 1,
            },
            prisma,
        )
        expect(transactionsRepository.countTransactions).toHaveBeenCalledWith(
            {
                workspaceId: 'workspace-1',
                categoryIds: ['category-1', 'category-2'],
                sortBy: 'amount',
                sortDirection: 'asc',
                paymentSourceId: 'payment-source-2',
                tag: 'FOOD',
                dateFrom: new Date('2026-03-21T00:00:00.000Z'),
                dateTo: new Date('2026-03-22T00:00:00.000Z'),
            },
            prisma,
        )
    })

    it('returns workspace tags from the repository layer', async () => {
        transactionsRepository.listWorkspaceTags.mockResolvedValue(['Food', 'Travel'])

        await expect(service.listWorkspaceTags(' workspace-1 ')).resolves.toEqual([
            'Food',
            'Travel',
        ])

        expect(transactionsRepository.listWorkspaceTags).toHaveBeenCalledWith('workspace-1', prisma)
    })

    it('returns 404 when a single transaction lookup targets a missing or soft-deleted record', async () => {
        transactionsRepository.findTransactionById.mockResolvedValue(null)

        await expect(service.getTransactionById('transaction-404', 'workspace-1')).rejects.toThrow(
            NotFoundException,
        )

        expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('rejects invalid transaction input before opening a database transaction', async () => {
        try {
            await service.createTransaction(
                {
                    amount: 10.505,
                    date: '03/23/2026',
                    description: 'Invalid transaction',
                    categoryId: '   ',
                    paymentSourceId: '   ',
                    tags: new Array(11).fill('tag'),
                },
                'workspace-1',
                'user-1',
            )
            throw new Error('Expected createTransaction to reject invalid input')
        } catch (error) {
            expect(error).toBeInstanceOf(BadRequestException)
            expect((error as BadRequestException).getResponse()).toEqual(
                expect.objectContaining({
                    message: expect.arrayContaining([
                        'Amount must be a positive number with up to 2 decimal places',
                        'Date must be a valid calendar date in YYYY-MM-DD format',
                        'Category id is required',
                        'Tags cannot contain more than 10 items',
                    ]),
                }),
            )
        }

        expect(prisma.$transaction).not.toHaveBeenCalled()
        expect(transactionsRepository.findCategoryById).not.toHaveBeenCalled()
        expect(transactionsRepository.createTransactionWithTags).not.toHaveBeenCalled()
    })

    it('rejects timestamps for the date-only transaction field', async () => {
        await expect(
            service.createTransaction(
                {
                    amount: 10,
                    date: '2026-03-23T23:30:00-07:00',
                    description: 'Late purchase',
                    categoryId: 'category-1',
                    paymentSourceId: 'payment-source-1',
                },
                'workspace-1',
                'user-1',
            ),
        ).rejects.toMatchObject({
            response: {
                message: expect.arrayContaining([
                    'Date must be a valid calendar date in YYYY-MM-DD format',
                ]),
            },
        })
        expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('rejects invalid update input before opening a database transaction', async () => {
        await expect(
            service.updateTransaction(
                {
                    amount: 0,
                    date: '03/24/2026',
                    description: 'Invalid transaction',
                    categoryId: '   ',
                    paymentSourceId: '   ',
                    tags: new Array(11).fill('tag'),
                },
                'transaction-1',
                'workspace-1',
            ),
        ).rejects.toMatchObject({
            response: {
                message: expect.arrayContaining([
                    'Amount must be greater than 0',
                    'Date must be a valid calendar date in YYYY-MM-DD format',
                    'Category id is required',
                    'Tags cannot contain more than 10 items',
                ]),
            },
        })

        expect(prisma.$transaction).not.toHaveBeenCalled()
        expect(transactionsRepository.findTransactionById).not.toHaveBeenCalled()
        expect(transactionsRepository.updateTransactionWithTags).not.toHaveBeenCalled()
    })

    it('lists transactions without requiring a payment source filter', async () => {
        transactionsRepository.listTransactions.mockResolvedValue([])
        transactionsRepository.countTransactions.mockResolvedValue(0)

        await expect(
            service.listTransactions({ limit: 5, offset: 0 }, 'workspace-1'),
        ).resolves.toEqual({
            data: [],
            total: 0,
            limit: 5,
            offset: 0,
        })

        expect(transactionsRepository.listTransactions).toHaveBeenCalledWith(
            expect.objectContaining({
                workspaceId: 'workspace-1',
                paymentSourceId: undefined,
                limit: 5,
                offset: 0,
            }),
            prisma,
        )
    })
    it('rejects invalid domain filter relationships before hitting the repository layer', async () => {
        await expect(
            service.listTransactions(
                {
                    tag: '   ',
                    dateFrom: '2026-03-24',
                    dateTo: '2026-03-23',
                    limit: 5,
                    offset: 0,
                },
                'workspace-1',
            ),
        ).rejects.toMatchObject({
            response: {
                message: expect.arrayContaining([
                    'Tag must be a non-empty string',
                    'Date from must be less than or equal to date to',
                ]),
            },
        })

        expect(transactionsRepository.listTransactions).not.toHaveBeenCalled()
        expect(transactionsRepository.countTransactions).not.toHaveBeenCalled()
    })

    it('rejects a transaction without a payment source', async () => {
        await expect(
            service.createTransaction(
                {
                    amount: 10.5,
                    date: '2026-03-23',
                    description: 'Lunch',
                    categoryId: 'category-1',
                    paymentSourceId: '   ',
                },
                'workspace-1',
                'user-1',
            ),
        ).rejects.toBeInstanceOf(BadRequestException)

        expect(prisma.$transaction).not.toHaveBeenCalled()
    })
    it('rejects missing categories inside the workspace', async () => {
        transactionsRepository.findCategoryById.mockResolvedValue(null)

        await expect(
            service.createTransaction(
                {
                    amount: 10.5,
                    date: '2026-03-23',
                    description: 'Lunch',
                    categoryId: 'category-9',
                    paymentSourceId: 'payment-source-1',
                },
                'workspace-1',
                'user-1',
            ),
        ).rejects.toBeInstanceOf(NotFoundException)

        expect(transactionsRepository.findActivePaymentSourceById).not.toHaveBeenCalled()
        expect(transactionsRepository.createTransactionWithTags).not.toHaveBeenCalled()
    })

    it('rejects archived or missing payment sources', async () => {
        transactionsRepository.findCategoryById.mockResolvedValue({ id: 'category-1' } as never)
        transactionsRepository.findActivePaymentSourceById.mockResolvedValue(null)

        await expect(
            service.createTransaction(
                {
                    amount: 10.5,
                    date: '2026-03-23',
                    description: 'Lunch',
                    categoryId: 'category-1',
                    paymentSourceId: 'payment-source-9',
                },
                'workspace-1',
                'user-1',
            ),
        ).rejects.toBeInstanceOf(NotFoundException)

        expect(transactionsRepository.createTransactionWithTags).not.toHaveBeenCalled()
    })

    it('returns 404 when updating a missing or soft-deleted transaction', async () => {
        transactionsRepository.findTransactionById.mockResolvedValue(null)

        await expect(
            service.updateTransaction(
                {
                    amount: 10.5,
                    date: '2026-03-23',
                    description: 'Lunch',
                    categoryId: 'category-1',
                    paymentSourceId: 'payment-source-1',
                },
                'transaction-404',
                'workspace-1',
            ),
        ).rejects.toThrow(NotFoundException)

        expect(transactionsRepository.findCategoryById).not.toHaveBeenCalled()
        expect(transactionsRepository.updateTransactionWithTags).not.toHaveBeenCalled()
    })

    it('returns 404 when an update loses the race after the pre-check succeeds', async () => {
        transactionsRepository.findTransactionById.mockResolvedValue({
            id: 'transaction-404',
            workspaceId: 'workspace-1',
            categoryId: 'category-1',
            paymentSourceId: 'payment-source-1',
            type: 'expense',
            amount: 1050,
            currency: 'USD',
            date: new Date('2026-03-23T00:00:00.000Z'),
            notes: 'Lunch',
            createdAt: new Date('2026-03-23T12:00:00.000Z'),
            updatedAt: new Date('2026-03-23T12:00:00.000Z'),
            deletedAt: null,
            tags: [],
        } as never)
        transactionsRepository.findCategoryById.mockResolvedValue({ id: 'category-1' } as never)
        transactionsRepository.updateTransactionWithTags.mockResolvedValue(null)

        await expect(
            service.updateTransaction(
                {
                    amount: 10.5,
                    date: '2026-03-23',
                    description: 'Lunch',
                    categoryId: 'category-1',
                    paymentSourceId: 'payment-source-1',
                },
                'transaction-404',
                'workspace-1',
            ),
        ).rejects.toThrow(NotFoundException)
    })

    it('returns 404 when deleting a missing or soft-deleted transaction', async () => {
        transactionsRepository.findTransactionById.mockResolvedValue(null)

        await expect(
            service.deleteTransaction('transaction-404', 'workspace-1', 'user-1'),
        ).rejects.toThrow(NotFoundException)

        expect(transactionsRepository.softDeleteTransaction).not.toHaveBeenCalled()
    })

    it('returns 404 when a delete loses the race after the pre-check succeeds', async () => {
        transactionsRepository.findTransactionById.mockResolvedValue({
            id: 'transaction-10',
            workspaceId: 'workspace-1',
            categoryId: 'category-1',
            paymentSourceId: 'payment-source-1',
            type: 'expense',
            amount: 1899,
            currency: 'USD',
            date: new Date('2026-03-24T08:30:00.000Z'),
            notes: 'Household items',
            createdAt: new Date('2026-03-24T08:30:00.000Z'),
            updatedAt: new Date('2026-03-24T08:30:00.000Z'),
            deletedAt: null,
            tags: [],
        } as never)
        transactionsRepository.softDeleteTransaction.mockResolvedValue(false)

        await expect(
            service.deleteTransaction('transaction-10', 'workspace-1', 'user-1'),
        ).rejects.toThrow(NotFoundException)
    })

    it('stores an immutable historical FX snapshot in workspace base currency', async () => {
        const rateDate = new Date('2026-03-20T00:00:00.000Z')
        const currencyService = {
            getHistoricalQuote: jest.fn().mockResolvedValue({
                rate: 4.35,
                rateDate,
                source: 'ecb-frankfurter',
            }),
        }
        const workspaceService = {
            getWorkspaceById: jest.fn().mockResolvedValue({ baseCurrency: 'PLN' }),
        }
        service = new TransactionsService(
            prisma as never,
            transactionsRepository as unknown as TransactionsRepository,
            currencyService as never,
            workspaceService as never,
        )
        transactionsRepository.findCategoryById.mockResolvedValue({ id: 'category-1' } as never)
        transactionsRepository.findActivePaymentSourceById.mockResolvedValue({
            id: 'payment-source-1',
        } as never)
        transactionsRepository.createTransactionWithTags.mockResolvedValue({
            id: 'transaction-fx',
            workspaceId: 'workspace-1',
            categoryId: 'category-1',
            paymentSourceId: 'payment-source-1',
            type: 'expense',
            amount: 1050,
            currency: 'EUR',
            baseAmount: 4568,
            fxRate: 4.35,
            fxRateDate: rateDate,
            fxSource: 'ecb-frankfurter',
            date: new Date('2026-03-22T00:00:00.000Z'),
            notes: null,
            createdAt: new Date('2026-03-22T12:00:00.000Z'),
            updatedAt: new Date('2026-03-22T12:00:00.000Z'),
            deletedAt: null,
            tags: [],
        } as never)

        await service.createTransaction(
            {
                amount: 10.5,
                currency: 'eur',
                date: '2026-03-22',
                description: 'Lunch',
                categoryId: 'category-1',
                paymentSourceId: 'payment-source-1',
            },
            'workspace-1',
            'user-1',
        )

        expect(currencyService.getHistoricalQuote).toHaveBeenCalledWith(
            'EUR',
            'PLN',
            new Date('2026-03-22T00:00:00.000Z'),
        )
        expect(transactionsRepository.createTransactionWithTags).toHaveBeenCalledWith(
            expect.objectContaining({
                amount: 1050,
                currency: 'EUR',
                baseAmount: 4568,
                fxRate: 4.35,
                fxRateDate: rateDate,
                fxSource: 'ecb-frankfurter',
            }),
            transactionClient,
        )
    })
})
