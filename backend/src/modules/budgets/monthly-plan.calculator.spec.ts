import {
    plannedBudgetTotal,
    remainingBudgetCommitments,
    remainingGoalCommitment,
} from './monthly-plan.calculator'
import type { CalculatedBudgetProgress } from './budget-progress.calculator'

function item(
    categoryId: string,
    budgetAmountCents: number,
    spentCents: number,
): CalculatedBudgetProgress {
    return {
        categoryId,
        categoryName: categoryId,
        categorySystemKey: null,
        budgetAmountCents,
        spentCents,
        remainingCents: budgetAmountCents - spentCents,
        percentageBasisPoints: 0,
    }
}

describe('monthly plan commitments', () => {
    it('plans full limits regardless of spending, without counting child budgets twice', () => {
        expect(
            plannedBudgetTotal(
                [
                    item('food', 150000, 40000),
                    item('dining', 30000, 10000),
                    item('travel', 20000, 22000),
                ],
                [
                    { id: 'food', parentId: null },
                    { id: 'dining', parentId: 'food' },
                    { id: 'travel', parentId: null },
                ],
            ),
        ).toEqual({ amount: 170000, overlaps: true })
    })
    it('counts a parent limit only once and does not reserve money already spent', () => {
        const result = remainingBudgetCommitments(
            [
                item('food', 150000, 40000),
                item('dining', 30000, 10000),
                item('travel', 20000, 22000),
            ],
            [
                { id: 'food', parentId: null },
                { id: 'dining', parentId: 'food' },
                { id: 'travel', parentId: null },
            ],
        )
        expect(result).toEqual({ amount: 110000, overlaps: true })
    })

    it('includes a child without a parent limit', () => {
        expect(
            remainingBudgetCommitments(
                [item('dining', 30000, 10000)],
                [
                    { id: 'food', parentId: null },
                    { id: 'dining', parentId: 'food' },
                ],
            ),
        ).toEqual({ amount: 20000, overlaps: false })
    })

    it('counts deposits without undoing them when savings are spent', () => {
        expect(remainingGoalCommitment(100000, 40000)).toBe(60000)
        expect(remainingGoalCommitment(100000, 150000)).toBe(0)
        expect(remainingGoalCommitment(100000, 0)).toBe(100000)
    })
})
