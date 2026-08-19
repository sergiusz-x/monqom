import {
    addUtcMonthsClamped,
    calculateGoalPlan,
    dateInTimeZone,
} from './goal-plan.calculator'

describe('goal plan calculator', () => {
    const today = new Date('2026-08-19T00:00:00.000Z')

    it('spreads the remaining amount across calendar months and rounds cents up', () => {
        expect(
            calculateGoalPlan({
                targetAmountCents: 100_00,
                initialAmountCents: 10_00,
                depositedAmountCents: 10_00,
                withdrawnAmountCents: 0,
                targetDate: new Date('2026-11-19T00:00:00.000Z'),
                planStartMonth: new Date('2026-09-01T00:00:00.000Z'),
                today,
            }),
        ).toMatchObject({
            currentAmountCents: 20_00,
            remainingAmountCents: 80_00,
            remainingMonths: 3,
            recommendedMonthlyAmountCents: 2667,
            status: 'active',
        })
    })

    it('includes the current month when the plan starts immediately', () => {
        const plan = calculateGoalPlan({
            targetAmountCents: 100_00,
            initialAmountCents: 0,
            depositedAmountCents: 0,
            withdrawnAmountCents: 0,
            targetDate: new Date('2026-09-19T00:00:00.000Z'),
            planStartMonth: new Date('2026-08-01T00:00:00.000Z'),
            today,
        })
        expect(plan.remainingMonths).toBe(2)
        expect(plan.recommendedMonthlyAmountCents).toBe(50_00)
    })

    it('derives completed before overdue and allows overfunding', () => {
        expect(
            calculateGoalPlan({
                targetAmountCents: 100_00,
                initialAmountCents: 120_00,
                depositedAmountCents: 0,
                withdrawnAmountCents: 0,
                targetDate: new Date('2026-07-01T00:00:00.000Z'),
                planStartMonth: new Date('2026-01-01T00:00:00.000Z'),
                today,
            }),
        ).toMatchObject({
            status: 'completed',
            remainingAmountCents: 0,
            recommendedMonthlyAmountCents: 0,
            progressPercentage: 120,
        })
    })

    it('marks an incomplete expired goal overdue without a monthly amount', () => {
        expect(
            calculateGoalPlan({
                targetAmountCents: 100_00,
                initialAmountCents: 20_00,
                depositedAmountCents: 0,
                withdrawnAmountCents: 0,
                targetDate: new Date('2026-08-18T00:00:00.000Z'),
                planStartMonth: new Date('2026-01-01T00:00:00.000Z'),
                today,
            }),
        ).toMatchObject({ status: 'overdue', remainingMonths: 0, recommendedMonthlyAmountCents: null })
    })

    it('clamps month additions and resolves the workspace-local day', () => {
        expect(addUtcMonthsClamped(new Date('2026-01-31T00:00:00.000Z'), 1).toISOString()).toBe(
            '2026-02-28T00:00:00.000Z',
        )
        expect(dateInTimeZone(new Date('2026-08-19T22:30:00.000Z'), 'Europe/Warsaw')).toEqual(
            new Date('2026-08-20T00:00:00.000Z'),
        )
    })
})
