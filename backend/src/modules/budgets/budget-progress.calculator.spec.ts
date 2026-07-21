import { calculateBudgetProgress } from './budget-progress.calculator'

describe('calculateBudgetProgress', () => {
    it('includes child spending in parent budget calculations using integer arithmetic', () => {
        expect(
            calculateBudgetProgress({
                categories: [
                    {
                        id: 'category-parent-food',
                        parentId: null,
                        name: 'Food',
                    },
                    {
                        id: 'category-child-groceries',
                        parentId: 'category-parent-food',
                        name: 'Groceries',
                    },
                    {
                        id: 'category-child-dining',
                        parentId: 'category-parent-food',
                        name: 'Dining Out',
                    },
                ],
                budgets: [
                    {
                        categoryId: 'category-parent-food',
                        amount: 80000,
                    },
                ],
                spending: [
                    {
                        categoryId: 'category-child-groceries',
                        amount: 30000,
                    },
                    {
                        categoryId: 'category-child-dining',
                        amount: 20000,
                    },
                ],
            }),
        ).toEqual([
            {
                categoryId: 'category-parent-food',
                categoryName: 'Food',
                categorySystemKey: null,
                budgetAmountCents: 80000,
                spentCents: 50000,
                remainingCents: 30000,
                percentageBasisPoints: 6250,
            },
            {
                categoryId: 'category-child-groceries',
                categoryName: 'Groceries',
                categorySystemKey: null,
                budgetAmountCents: null,
                spentCents: 30000,
                remainingCents: null,
                percentageBasisPoints: null,
            },
            {
                categoryId: 'category-child-dining',
                categoryName: 'Dining Out',
                categorySystemKey: null,
                budgetAmountCents: null,
                spentCents: 20000,
                remainingCents: null,
                percentageBasisPoints: null,
            },
        ])
    })

    it('returns only categories with a budget or spending', () => {
        expect(
            calculateBudgetProgress({
                categories: [
                    {
                        id: 'category-parent-food',
                        parentId: null,
                        name: 'Food',
                    },
                    {
                        id: 'category-child-groceries',
                        parentId: 'category-parent-food',
                        name: 'Groceries',
                    },
                ],
                budgets: [],
                spending: [],
            }),
        ).toEqual([])
    })
})
