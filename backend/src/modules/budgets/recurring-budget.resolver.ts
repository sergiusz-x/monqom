/** A version changes the ongoing monthly limit starting with its effective month. */
export interface RecurringBudgetVersion<T> {
    categoryId: string
    effectiveMonth: string
    value: T | null
}

/** Monthly overrides take precedence over ongoing rules; null disables the limit for that month. */
export interface MonthlyBudgetOverride<T> {
    categoryId: string
    value: T | null
}

export interface ResolvedBudget<T> {
    categoryId: string
    value: T
    source: 'recurring' | 'monthly'
}

/** Resolves an individual month without changing stored versions or existing monthly budgets. */
export function resolveRecurringBudgets<T>(
    month: string,
    versions: RecurringBudgetVersion<T>[],
    overrides: MonthlyBudgetOverride<T>[],
): ResolvedBudget<T>[] {
    const latestByCategory = new Map<string, RecurringBudgetVersion<T>>()
    for (const version of versions) {
        if (version.effectiveMonth > month) continue
        const previous = latestByCategory.get(version.categoryId)
        if (!previous || version.effectiveMonth > previous.effectiveMonth) {
            latestByCategory.set(version.categoryId, version)
        }
    }

    const result = new Map<string, ResolvedBudget<T>>()
    for (const version of latestByCategory.values()) {
        if (version.value !== null) {
            result.set(version.categoryId, {
                categoryId: version.categoryId,
                value: version.value,
                source: 'recurring',
            })
        }
    }
    for (const override of overrides) {
        if (override.value === null) {
            result.delete(override.categoryId)
        } else {
            result.set(override.categoryId, {
                categoryId: override.categoryId,
                value: override.value,
                source: 'monthly',
            })
        }
    }
    return [...result.values()]
}
