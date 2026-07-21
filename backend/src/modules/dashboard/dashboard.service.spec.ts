import { BadRequestException } from '@nestjs/common'
import { DashboardRepository } from './dashboard.repository'
import { DashboardService } from './dashboard.service'
import { TransactionsRepository } from '../transactions/transactions.repository'

describe('DashboardService', () => {
    let service: DashboardService
    let dashboardRepository: jest.Mocked<
        Pick<
            DashboardRepository,
            | 'getTotalSpendForRange'
            | 'listCategoriesByIds'
            | 'listCategorySpendForRange'
            | 'listMonthlySpendForRange'
        >
    >
    let transactionsRepository: jest.Mocked<Pick<TransactionsRepository, 'listTransactions'>>

    beforeEach(() => {
        dashboardRepository = {
            getTotalSpendForRange: jest.fn(),
            listCategoriesByIds: jest.fn(),
            listCategorySpendForRange: jest.fn(),
            listMonthlySpendForRange: jest.fn(),
        }
        transactionsRepository = {
            listTransactions: jest.fn(),
        }

        service = new DashboardService(
            dashboardRepository as unknown as DashboardRepository,
            undefined,
            transactionsRepository as unknown as TransactionsRepository,
        )
    })

    it('returns current and previous month spending totals with change metadata', async () => {
        dashboardRepository.getTotalSpendForRange
            .mockResolvedValueOnce(62599)
            .mockResolvedValueOnce(40000)

        await expect(
            service.getSpendingSummary({ month: ' 2026-03 ' }, ' workspace-1 '),
        ).resolves.toEqual({
            month: '2026-03',
            currency: 'USD',
            current_total: 625.99,
            previous_total: 400,
            change_amount: 225.99,
            change_percentage: 56.5,
            direction: 'up',
        })

        expect(dashboardRepository.getTotalSpendForRange).toHaveBeenNthCalledWith(
            1,
            'workspace-1',
            new Date('2026-03-01T00:00:00.000Z'),
            new Date('2026-04-01T00:00:00.000Z'),
        )
        expect(dashboardRepository.getTotalSpendForRange).toHaveBeenNthCalledWith(
            2,
            'workspace-1',
            new Date('2026-02-01T00:00:00.000Z'),
            new Date('2026-03-01T00:00:00.000Z'),
        )
    })

    it('builds the complete dashboard from one monthly aggregation query', async () => {
        dashboardRepository.listMonthlySpendForRange.mockResolvedValue([
            { month: '2025-12', amount: 1000 },
            { month: '2026-03', amount: 4000 },
            { month: '2026-04', amount: 10000 },
        ])
        dashboardRepository.listCategorySpendForRange.mockResolvedValue([
            { categoryId: 'category-1', amount: 10000 },
        ])
        dashboardRepository.listCategoriesByIds.mockResolvedValue([
            {
                id: 'category-1',
                name: 'Groceries',
                color: '#16a34a',
                systemKey: null,
            },
        ])
        transactionsRepository.listTransactions.mockResolvedValue([
            {
                id: 'transaction-1',
                workspace_id: 'workspace-1',
                category_id: 'category-1',
                payment_source_id: 'cash-1',
                type: 'expense',
                amount: 1250,
                currency: 'USD',
                date: new Date('2026-04-10T00:00:00.000Z'),
                description: 'Groceries',
                notes: null,
                tags: ['weekly'],
                created_at: new Date('2026-04-10T12:00:00.000Z'),
                updated_at: new Date('2026-04-10T12:00:00.000Z'),
            },
        ])

        await expect(service.getOverview({ month: '2026-04' }, 'workspace-1')).resolves.toEqual({
            summary: {
                month: '2026-04',
                currency: 'USD',
                current_total: 100,
                previous_total: 40,
                change_amount: 60,
                change_percentage: 150,
                direction: 'up',
            },
            category_breakdown: {
                month: '2026-04',
                currency: 'USD',
                total_spending: 100,
                categories: [
                    {
                        category_id: 'category-1',
                        category_name: 'Groceries',
                        category_system_key: null,
                        category_color: '#16a34a',
                        amount: 100,
                        percentage: 100,
                    },
                ],
            },
            spending_trend: [
                { month: '2025-11', total: 0 },
                { month: '2025-12', total: 10 },
                { month: '2026-01', total: 0 },
                { month: '2026-02', total: 0 },
                { month: '2026-03', total: 40 },
                { month: '2026-04', total: 100 },
            ],
            recent_transactions: [
                {
                    id: 'transaction-1',
                    workspace_id: 'workspace-1',
                    category_id: 'category-1',
                    payment_source_id: 'cash-1',
                    type: 'expense',
                    amount: 12.5,
                    currency: 'USD',
                    date: '2026-04-10',
                    description: 'Groceries',
                    notes: null,
                    tags: ['weekly'],
                    created_at: new Date('2026-04-10T12:00:00.000Z'),
                    updated_at: new Date('2026-04-10T12:00:00.000Z'),
                },
            ],
        })

        expect(dashboardRepository.listMonthlySpendForRange).toHaveBeenCalledTimes(1)
        expect(dashboardRepository.listMonthlySpendForRange).toHaveBeenCalledWith(
            'workspace-1',
            new Date('2025-11-01T00:00:00.000Z'),
            new Date('2026-05-01T00:00:00.000Z'),
        )
        expect(dashboardRepository.getTotalSpendForRange).not.toHaveBeenCalled()
        expect(transactionsRepository.listTransactions).toHaveBeenCalledWith({
            workspaceId: 'workspace-1',
            limit: 5,
            offset: 0,
            sortBy: 'date',
            sortDirection: 'desc',
        })
    })

    it('returns a null percentage when the previous month has no spending', async () => {
        dashboardRepository.getTotalSpendForRange
            .mockResolvedValueOnce(12500)
            .mockResolvedValueOnce(0)

        await expect(
            service.getSpendingSummary({ month: '2026-03' }, 'workspace-1'),
        ).resolves.toEqual({
            month: '2026-03',
            currency: 'USD',
            current_total: 125,
            previous_total: 0,
            change_amount: 125,
            change_percentage: null,
            direction: 'up',
        })
    })

    it('returns sorted category breakdown items with percentages based on integer cents', async () => {
        dashboardRepository.listCategorySpendForRange.mockResolvedValue([
            {
                categoryId: 'category-child-groceries',
                amount: 25050,
            },
            {
                categoryId: 'category-child-dining',
                amount: 9999,
            },
            {
                categoryId: 'category-child-transport',
                amount: 25050,
            },
            {
                categoryId: 'category-missing',
                amount: 1,
            },
        ])
        dashboardRepository.listCategoriesByIds.mockResolvedValue([
            {
                id: 'category-child-groceries',
                name: 'Groceries',
                color: '#16a34a',
            },
            {
                id: 'category-child-dining',
                name: 'Dining Out',
                color: '#dc2626',
            },
            {
                id: 'category-child-transport',
                name: 'Public Transport',
                color: null,
            },
        ] as never)

        await expect(
            service.getCategoryBreakdown({ month: '2026-03' }, 'workspace-1'),
        ).resolves.toEqual({
            month: '2026-03',
            currency: 'USD',
            total_spending: 601,
            categories: [
                {
                    category_id: 'category-child-groceries',
                    category_name: 'Groceries',
                    category_system_key: null,
                    category_color: '#16a34a',
                    amount: 250.5,
                    percentage: 41.68,
                },
                {
                    category_id: 'category-child-transport',
                    category_name: 'Public Transport',
                    category_system_key: null,
                    category_color: null,
                    amount: 250.5,
                    percentage: 41.68,
                },
                {
                    category_id: 'category-child-dining',
                    category_name: 'Dining Out',
                    category_system_key: null,
                    category_color: '#dc2626',
                    amount: 99.99,
                    percentage: 16.64,
                },
                {
                    category_id: 'category-missing',
                    category_name: 'Unknown category',
                    category_system_key: null,
                    category_color: null,
                    amount: 0.01,
                    percentage: 0,
                },
            ],
        })

        expect(dashboardRepository.listCategoriesByIds).toHaveBeenCalledWith('workspace-1', [
            'category-child-groceries',
            'category-child-dining',
            'category-child-transport',
            'category-missing',
        ])
    })

    it('returns an empty breakdown when the selected month has no spending', async () => {
        dashboardRepository.listCategorySpendForRange.mockResolvedValue([])

        await expect(
            service.getCategoryBreakdown({ month: '2026-03' }, 'workspace-1'),
        ).resolves.toEqual({
            month: '2026-03',
            currency: 'USD',
            total_spending: 0,
            categories: [],
        })

        expect(dashboardRepository.listCategoriesByIds).not.toHaveBeenCalled()
    })

    it('rejects invalid dashboard month filters', async () => {
        await expect(
            service.getSpendingSummary({ month: '2026/03' }, 'workspace-1'),
        ).rejects.toBeInstanceOf(BadRequestException)
        expect(dashboardRepository.getTotalSpendForRange).not.toHaveBeenCalled()
        expect(dashboardRepository.listCategorySpendForRange).not.toHaveBeenCalled()
    })
})
