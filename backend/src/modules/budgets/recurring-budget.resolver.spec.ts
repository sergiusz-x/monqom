import { resolveRecurringBudgets } from './recurring-budget.resolver'

describe('resolveRecurringBudgets', () => {
    const versions = [
        { categoryId: 'food', effectiveMonth: '2026-11', value: 1500 },
        { categoryId: 'food', effectiveMonth: '2027-02', value: 1800 },
        { categoryId: 'food', effectiveMonth: '2027-04', value: null },
    ]

    it('applies rules only from their effective month and preserves older months', () => {
        expect(resolveRecurringBudgets('2026-10', versions, [])).toEqual([])
        expect(resolveRecurringBudgets('2027-01', versions, [])[0]?.value).toBe(1500)
        expect(resolveRecurringBudgets('2027-02', versions, [])[0]?.value).toBe(1800)
        expect(resolveRecurringBudgets('2027-04', versions, [])).toEqual([])
    })

    it('applies a one-month exception without changing subsequent months', () => {
        expect(
            resolveRecurringBudgets('2026-12', versions, [{ categoryId: 'food', value: 2000 }]),
        ).toEqual([{ categoryId: 'food', value: 2000, source: 'monthly' }])
        expect(
            resolveRecurringBudgets('2026-12', versions, [{ categoryId: 'food', value: null }]),
        ).toEqual([])
        expect(resolveRecurringBudgets('2027-01', versions, [])[0]?.value).toBe(1500)
    })
})
