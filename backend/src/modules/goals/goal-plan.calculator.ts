export type GoalStatus = 'active' | 'completed' | 'overdue'

export interface GoalPlan {
    currentAmountCents: number
    remainingAmountCents: number
    progressPercentage: number
    remainingMonths: number
    recommendedMonthlyAmountCents: number | null
    status: GoalStatus
}

export function calculateGoalPlan(input: {
    targetAmountCents: number
    initialAmountCents: number
    depositedAmountCents: number
    withdrawnAmountCents: number
    targetDate: Date
    planStartMonth: Date
    today: Date
}): GoalPlan {
    const currentAmountCents =
        input.initialAmountCents + input.depositedAmountCents - input.withdrawnAmountCents
    const remainingAmountCents = Math.max(input.targetAmountCents - currentAmountCents, 0)
    const completed = currentAmountCents >= input.targetAmountCents
    const overdue = compareDateOnly(input.targetDate, input.today) < 0
    const status: GoalStatus = completed ? 'completed' : overdue ? 'overdue' : 'active'
    const firstMonth = laterMonth(input.planStartMonth, startOfUtcMonth(input.today))
    const targetMonth = startOfUtcMonth(input.targetDate)
    const remainingMonths = overdue ? 0 : inclusiveMonthCount(firstMonth, targetMonth)

    return {
        currentAmountCents,
        remainingAmountCents,
        progressPercentage:
            input.targetAmountCents === 0
                ? 0
                : Number(((currentAmountCents / input.targetAmountCents) * 100).toFixed(2)),
        remainingMonths,
        recommendedMonthlyAmountCents:
            completed ? 0 : remainingMonths > 0 ? Math.ceil(remainingAmountCents / remainingMonths) : null,
        status,
    }
}

export function dateInTimeZone(now: Date, timeZone: string): Date {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(now)
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
    return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)))
}

export function addUtcMonthsClamped(date: Date, months: number): Date {
    const year = date.getUTCFullYear()
    const month = date.getUTCMonth() + months
    const day = date.getUTCDate()
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    return new Date(Date.UTC(year, month, Math.min(day, lastDay)))
}

export function startOfUtcMonth(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function inclusiveMonthCount(start: Date, end: Date): number {
    const count =
        (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
        end.getUTCMonth() -
        start.getUTCMonth() +
        1
    return Math.max(count, 0)
}

function laterMonth(left: Date, right: Date): Date {
    return left.getTime() >= right.getTime() ? startOfUtcMonth(left) : startOfUtcMonth(right)
}

function compareDateOnly(left: Date, right: Date): number {
    return Date.UTC(left.getUTCFullYear(), left.getUTCMonth(), left.getUTCDate()) -
        Date.UTC(right.getUTCFullYear(), right.getUTCMonth(), right.getUTCDate())
}
