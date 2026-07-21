import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { BudgetsRepository } from './budgets.repository'
import { BudgetsService } from './budgets.service'

describe('BudgetsService', () => {
    let service: BudgetsService
    let transactionClient: object
    let prisma: {
        $transaction: jest.Mock
    }
    let budgetsRepository: jest.Mocked<
        Pick<
            BudgetsRepository,
            | 'createBudget'
            | 'deleteBudget'
            | 'findActiveCategoryById'
            | 'findBudgetByCategoryAndMonth'
            | 'findBudgetById'
            | 'listCategoriesForProgress'
            | 'listBudgetsByMonth'
            | 'listTransactionSpendByCategory'
            | 'updateBudget'
        >
    >

    beforeEach(() => {
        transactionClient = {}
        prisma = {
            $transaction: jest.fn(async (callback: (tx: object) => Promise<unknown>) =>
                callback(transactionClient),
            ),
        }
        budgetsRepository = {
            createBudget: jest.fn(),
            deleteBudget: jest.fn(),
            findActiveCategoryById: jest.fn(),
            findBudgetByCategoryAndMonth: jest.fn(),
            findBudgetById: jest.fn(),
            listCategoriesForProgress: jest.fn(),
            listBudgetsByMonth: jest.fn(),
            listTransactionSpendByCategory: jest.fn(),
            updateBudget: jest.fn(),
        }

        service = new BudgetsService(
            prisma as never,
            budgetsRepository as unknown as BudgetsRepository,
        )
    })

    it('lists budgets for a month and converts stored cents to display amounts', async () => {
        budgetsRepository.listBudgetsByMonth.mockResolvedValue([
            {
                id: 'budget-1',
                workspaceId: 'workspace-1',
                categoryId: 'category-child-groceries',
                amount: 4599,
                currency: 'USD',
                year: 2026,
                month: 3,
                createdAt: new Date('2026-03-24T12:00:00.000Z'),
                updatedAt: new Date('2026-03-24T12:00:00.000Z'),
            },
        ] as never)

        await expect(
            service.listBudgets({ year: 2026, month: 3 }, ' workspace-1 '),
        ).resolves.toEqual([
            {
                id: 'budget-1',
                workspace_id: 'workspace-1',
                category_id: 'category-child-groceries',
                amount: 45.99,
                currency: 'USD',
                year: 2026,
                month: 3,
                created_at: new Date('2026-03-24T12:00:00.000Z'),
                updated_at: new Date('2026-03-24T12:00:00.000Z'),
            },
        ])

        expect(budgetsRepository.listBudgetsByMonth).toHaveBeenCalledWith(
            'workspace-1',
            2026,
            3,
            prisma,
        )
    })

    it('returns progress rows for budgets and no-budget spending categories', async () => {
        budgetsRepository.listCategoriesForProgress.mockResolvedValue([
            {
                id: 'category-parent-food',
                parentId: null,
                name: 'Food',
                sortOrder: 1,
            },
            {
                id: 'category-child-dining',
                parentId: 'category-parent-food',
                name: 'Dining Out',
                sortOrder: 2,
            },
            {
                id: 'category-child-groceries',
                parentId: 'category-parent-food',
                name: 'Groceries',
                sortOrder: 3,
            },
            {
                id: 'category-parent-utilities',
                parentId: null,
                name: 'Utilities',
                sortOrder: 4,
            },
            {
                id: 'category-child-internet',
                parentId: 'category-parent-utilities',
                name: 'Internet',
                sortOrder: 5,
            },
        ] as never)
        budgetsRepository.listBudgetsByMonth.mockResolvedValue([
            {
                id: 'budget-1',
                workspaceId: 'workspace-1',
                categoryId: 'category-child-groceries',
                amount: 80000,
                currency: 'USD',
                year: 2026,
                month: 3,
                createdAt: new Date('2026-03-24T12:00:00.000Z'),
                updatedAt: new Date('2026-03-24T12:00:00.000Z'),
            },
        ] as never)
        budgetsRepository.listTransactionSpendByCategory.mockResolvedValue([
            {
                categoryId: 'category-child-groceries',
                amount: 50000,
            },
            {
                categoryId: 'category-child-dining',
                amount: 12000,
            },
            {
                categoryId: 'category-child-internet',
                amount: 6500,
            },
        ])

        await expect(
            service.listBudgetProgress({ month: '2026-03' }, ' workspace-1 '),
        ).resolves.toEqual([
            {
                category_id: 'category-parent-food',
                category_name: 'Food',
                category_system_key: null,
                budget_amount: null,
                limit: null,
                spent: 620,
                remaining: null,
                percentage: null,
            },
            {
                category_id: 'category-child-dining',
                category_name: 'Dining Out',
                category_system_key: null,
                budget_amount: null,
                limit: null,
                spent: 120,
                remaining: null,
                percentage: null,
            },
            {
                category_id: 'category-child-groceries',
                category_name: 'Groceries',
                category_system_key: null,
                budget_amount: 800,
                limit: 800,
                spent: 500,
                remaining: 300,
                percentage: 62.5,
            },
            {
                category_id: 'category-parent-utilities',
                category_name: 'Utilities',
                category_system_key: null,
                budget_amount: null,
                limit: null,
                spent: 65,
                remaining: null,
                percentage: null,
            },
            {
                category_id: 'category-child-internet',
                category_name: 'Internet',
                category_system_key: null,
                budget_amount: null,
                limit: null,
                spent: 65,
                remaining: null,
                percentage: null,
            },
        ])

        expect(budgetsRepository.listCategoriesForProgress).toHaveBeenCalledWith(
            'workspace-1',
            prisma,
        )
        expect(budgetsRepository.listBudgetsByMonth).toHaveBeenCalledWith(
            'workspace-1',
            2026,
            3,
            prisma,
        )
        expect(budgetsRepository.listTransactionSpendByCategory).toHaveBeenCalledWith(
            'workspace-1',
            new Date('2026-03-01T00:00:00.000Z'),
            new Date('2026-04-01T00:00:00.000Z'),
            prisma,
        )
    })

    it('rejects invalid budget progress month filters', async () => {
        await expect(
            service.listBudgetProgress({ month: '2026/03' }, 'workspace-1'),
        ).rejects.toBeInstanceOf(BadRequestException)

        expect(budgetsRepository.listCategoriesForProgress).not.toHaveBeenCalled()
        expect(budgetsRepository.listBudgetsByMonth).not.toHaveBeenCalled()
        expect(budgetsRepository.listTransactionSpendByCategory).not.toHaveBeenCalled()
    })

    it('creates a monthly budget for an active child category', async () => {
        budgetsRepository.findActiveCategoryById.mockResolvedValue({
            id: 'category-child-groceries',
            parentId: 'category-parent-food',
        } as never)
        budgetsRepository.findBudgetByCategoryAndMonth.mockResolvedValue(null)
        budgetsRepository.createBudget.mockResolvedValue({
            id: 'budget-1',
            workspaceId: 'workspace-1',
            categoryId: 'category-child-groceries',
            amount: 80000,
            currency: 'USD',
            year: 2026,
            month: 3,
            createdAt: new Date('2026-03-24T12:00:00.000Z'),
            updatedAt: new Date('2026-03-24T12:00:00.000Z'),
        } as never)

        await expect(
            service.createBudget(
                {
                    amount: 800,
                    categoryId: ' category-child-groceries ',
                    year: 2026,
                    month: 3,
                },
                ' workspace-1 ',
                ' user-1 ',
            ),
        ).resolves.toEqual({
            id: 'budget-1',
            workspace_id: 'workspace-1',
            category_id: 'category-child-groceries',
            amount: 800,
            currency: 'USD',
            year: 2026,
            month: 3,
            created_at: new Date('2026-03-24T12:00:00.000Z'),
            updated_at: new Date('2026-03-24T12:00:00.000Z'),
        })

        expect(prisma.$transaction).toHaveBeenCalledTimes(1)
        expect(budgetsRepository.findActiveCategoryById).toHaveBeenCalledWith(
            'workspace-1',
            'category-child-groceries',
            transactionClient,
        )
        expect(budgetsRepository.findBudgetByCategoryAndMonth).toHaveBeenCalledWith(
            'workspace-1',
            'category-child-groceries',
            2026,
            3,
            transactionClient,
        )
        expect(budgetsRepository.createBudget).toHaveBeenCalledWith(
            {
                workspaceId: 'workspace-1',
                userId: 'user-1',
                categoryId: 'category-child-groceries',
                amount: 80000,
                currency: 'USD',
                year: 2026,
                month: 3,
            },
            transactionClient,
        )
    })

    it('rejects parent categories for budgets', async () => {
        budgetsRepository.findActiveCategoryById.mockResolvedValue({
            id: 'category-parent-food',
            parentId: null,
        } as never)
        budgetsRepository.findBudgetByCategoryAndMonth.mockResolvedValue(null)

        await expect(
            service.createBudget(
                {
                    amount: 125,
                    categoryId: 'category-parent-food',
                    year: 2026,
                    month: 3,
                },
                'workspace-1',
                'user-1',
            ),
        ).rejects.toBeInstanceOf(BadRequestException)

        expect(budgetsRepository.createBudget).not.toHaveBeenCalled()
    })

    it('rejects duplicate budgets for the same category and month', async () => {
        budgetsRepository.findActiveCategoryById.mockResolvedValue({
            id: 'category-child-groceries',
            parentId: 'category-parent-food',
        } as never)
        budgetsRepository.findBudgetByCategoryAndMonth.mockResolvedValue({
            id: 'budget-existing',
        } as never)

        await expect(
            service.createBudget(
                {
                    amount: 125,
                    categoryId: 'category-child-groceries',
                    year: 2026,
                    month: 3,
                },
                'workspace-1',
                'user-1',
            ),
        ).rejects.toBeInstanceOf(ConflictException)

        expect(budgetsRepository.createBudget).not.toHaveBeenCalled()
    })

    it('rejects a non-positive amount before creating a budget', async () => {
        await expect(
            service.createBudget(
                {
                    amount: 0,
                    categoryId: 'category-child-groceries',
                    year: 2026,
                    month: 3,
                },
                'workspace-1',
                'user-1',
            ),
        ).rejects.toBeInstanceOf(BadRequestException)

        expect(prisma.$transaction).not.toHaveBeenCalled()
        expect(budgetsRepository.findActiveCategoryById).not.toHaveBeenCalled()
        expect(budgetsRepository.createBudget).not.toHaveBeenCalled()
    })

    it('rejects amounts that exceed supported integer storage when creating a budget', async () => {
        await expect(
            service.createBudget(
                {
                    amount: 21474836.48,
                    categoryId: 'category-child-groceries',
                    year: 2026,
                    month: 3,
                },
                'workspace-1',
                'user-1',
            ),
        ).rejects.toBeInstanceOf(BadRequestException)

        expect(prisma.$transaction).not.toHaveBeenCalled()
        expect(budgetsRepository.findActiveCategoryById).not.toHaveBeenCalled()
        expect(budgetsRepository.createBudget).not.toHaveBeenCalled()
    })

    it('updates an existing budget and logs the previous record to the repository layer', async () => {
        const existingBudget = {
            id: 'budget-1',
            workspaceId: 'workspace-1',
            categoryId: 'category-child-groceries',
            amount: 60000,
            currency: 'USD',
            year: 2026,
            month: 3,
            createdAt: new Date('2026-03-20T12:00:00.000Z'),
            updatedAt: new Date('2026-03-20T12:00:00.000Z'),
        }

        budgetsRepository.findBudgetById.mockResolvedValue(existingBudget as never)
        budgetsRepository.findActiveCategoryById.mockResolvedValue({
            id: 'category-child-transport',
            parentId: 'category-parent-transport',
        } as never)
        budgetsRepository.findBudgetByCategoryAndMonth.mockResolvedValue(existingBudget as never)
        budgetsRepository.updateBudget.mockResolvedValue({
            ...existingBudget,
            categoryId: 'category-child-transport',
            amount: 7550,
            month: 4,
            updatedAt: new Date('2026-03-24T15:00:00.000Z'),
        } as never)

        await expect(
            service.updateBudget(
                {
                    amount: 75.5,
                    categoryId: 'category-child-transport',
                    year: 2026,
                    month: 4,
                },
                ' budget-1 ',
                ' workspace-1 ',
                ' user-1 ',
            ),
        ).resolves.toEqual({
            id: 'budget-1',
            workspace_id: 'workspace-1',
            category_id: 'category-child-transport',
            amount: 75.5,
            currency: 'USD',
            year: 2026,
            month: 4,
            created_at: new Date('2026-03-20T12:00:00.000Z'),
            updated_at: new Date('2026-03-24T15:00:00.000Z'),
        })

        expect(budgetsRepository.updateBudget).toHaveBeenCalledWith(
            {
                workspaceId: 'workspace-1',
                budgetId: 'budget-1',
                userId: 'user-1',
                categoryId: 'category-child-transport',
                amount: 7550,
                currency: 'USD',
                year: 2026,
                month: 4,
                previousBudget: existingBudget,
            },
            transactionClient,
        )
    })

    it('rejects amounts that exceed supported integer storage when updating a budget', async () => {
        await expect(
            service.updateBudget(
                {
                    amount: 21474836.48,
                    categoryId: 'category-child-groceries',
                    year: 2026,
                    month: 3,
                },
                'budget-1',
                'workspace-1',
                'user-1',
            ),
        ).rejects.toBeInstanceOf(BadRequestException)

        expect(prisma.$transaction).not.toHaveBeenCalled()
        expect(budgetsRepository.findBudgetById).not.toHaveBeenCalled()
        expect(budgetsRepository.updateBudget).not.toHaveBeenCalled()
    })

    it('throws not found when deleting a missing budget', async () => {
        budgetsRepository.findBudgetById.mockResolvedValue(null)

        await expect(
            service.deleteBudget('budget-missing', 'workspace-1', 'user-1'),
        ).rejects.toBeInstanceOf(NotFoundException)

        expect(budgetsRepository.deleteBudget).not.toHaveBeenCalled()
    })
})
