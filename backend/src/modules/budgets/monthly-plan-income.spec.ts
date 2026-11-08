import { MonthlyPlanService } from './monthly-plan.service'

describe('monthly plan income', () => {
    it('sums workspace income in the selected category and its descendants', async () => {
        const aggregate = jest.fn().mockResolvedValue({ _sum: { baseAmount: 70000 } })
        const prisma = {
            monthlyPlan: {
                findUnique: jest.fn().mockResolvedValue({
                    funds: 100000,
                    incomeMode: 'transactions',
                    incomeCategoryIds: ['parent'],
                    incomePlanned: true,
                    currency: 'PLN',
                    goalAllocations: [],
                    revision: 1,
                }),
            },
            goalOperation: { groupBy: jest.fn().mockResolvedValue([]) },
            monthlyPlanIncomeRule: { findFirst: jest.fn().mockResolvedValue(null) },
            transaction: { aggregate },
        }
        const workspace = { getWorkspaceById: jest.fn().mockResolvedValue({ baseCurrency: 'PLN' }) }
        const budgets = {
            listCategoriesForProgress: jest.fn().mockResolvedValue([
                { id: 'parent', parentId: null, name: 'Income' },
                { id: 'child', parentId: 'parent', name: 'Salary' },
            ]),
            listBudgetsByMonth: jest.fn().mockResolvedValue([]),
            listTransactionSpendByCategory: jest.fn().mockResolvedValue([]),
        }
        const service = new MonthlyPlanService(
            prisma as never,
            workspace as never,
            budgets as never,
            {} as never,
        )
        const result = await service.get('workspace', '2026-11')
        expect(result?.funds_cents).toBe(70000)
        expect(result?.manual_funds_cents).toBe(100000)
        expect(result?.unallocated_cents).toBe(70000)
        expect(aggregate).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    workspaceId: 'workspace',
                    type: 'income',
                    deletedAt: null,
                    categoryId: { in: ['parent', 'child'] },
                }),
            }),
        )
        prisma.monthlyPlan.findUnique.mockResolvedValueOnce({
            funds: 100000,
            incomeMode: 'transactions',
            incomeCategoryIds: [],
            incomePlanned: true,
            currency: 'PLN',
            goalAllocations: [],
            revision: 1,
        })
        await service.get('workspace', '2026-11')
        expect(aggregate.mock.calls[1][0].where).not.toHaveProperty('categoryId')
        prisma.monthlyPlan.findUnique.mockResolvedValueOnce({
            funds: 100000,
            incomeMode: 'manual',
            incomeCategoryIds: [],
            incomePlanned: true,
            currency: 'PLN',
            goalAllocations: [],
            revision: 1,
        })
        expect((await service.get('workspace', '2026-11'))?.funds_cents).toBe(100000)
        expect(aggregate).toHaveBeenCalledTimes(2)
        prisma.monthlyPlan.findUnique.mockResolvedValueOnce(null)
        prisma.monthlyPlanIncomeRule.findFirst.mockResolvedValueOnce({
            categoryIds: ['parent'],
            currency: 'PLN',
            updatedAt: new Date(),
        })
        const inherited = await service.get('workspace', '2026-12')
        expect(inherited).toEqual(
            expect.objectContaining({
                revision: 0,
                income_mode: 'transactions',
                income_planned: true,
                category_ids: ['parent'],
                funds_cents: 70000,
            }),
        )
        expect(prisma.monthlyPlanIncomeRule.findFirst).toHaveBeenLastCalledWith({
            where: { workspaceId: 'workspace', effectiveMonth: { lte: '2026-12' } },
            orderBy: { effectiveMonth: 'desc' },
        })
    })
})
