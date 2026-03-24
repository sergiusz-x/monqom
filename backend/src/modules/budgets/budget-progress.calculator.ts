export interface BudgetProgressCategoryInput {
    id: string
    parentId: string | null
    name: string
}

export interface BudgetProgressBudgetInput {
    categoryId: string | null
    amount: number
}

export interface BudgetProgressSpendingInput {
    categoryId: string
    amount: number
}

export interface CalculatedBudgetProgress {
    categoryId: string
    categoryName: string
    budgetAmountCents: number | null
    spentCents: number
    remainingCents: number | null
    percentageBasisPoints: number | null
}

interface BudgetProgressCalculationInput {
    categories: BudgetProgressCategoryInput[]
    budgets: BudgetProgressBudgetInput[]
    spending: BudgetProgressSpendingInput[]
}

export function calculateBudgetProgress(
    input: BudgetProgressCalculationInput,
): CalculatedBudgetProgress[] {
    const categoryMap = new Map(input.categories.map((category) => [category.id, category]))
    const childIdsByParentId = new Map<string, string[]>()

    for (const category of input.categories) {
        if (!category.parentId) {
            continue
        }

        const childIds = childIdsByParentId.get(category.parentId) ?? []
        childIds.push(category.id)
        childIdsByParentId.set(category.parentId, childIds)
    }

    const budgetAmountByCategoryId = new Map<string, number>()

    for (const budget of input.budgets) {
        if (!budget.categoryId) {
            continue
        }

        budgetAmountByCategoryId.set(budget.categoryId, budget.amount)
    }

    const ownSpentByCategoryId = new Map<string, number>()

    for (const spending of input.spending) {
        ownSpentByCategoryId.set(
            spending.categoryId,
            (ownSpentByCategoryId.get(spending.categoryId) ?? 0) + spending.amount,
        )
    }

    const totalSpentByCategoryId = new Map<string, number>()

    const getTotalSpent = (categoryId: string): number => {
        const cachedTotal = totalSpentByCategoryId.get(categoryId)

        if (typeof cachedTotal === 'number') {
            return cachedTotal
        }

        const ownSpent = ownSpentByCategoryId.get(categoryId) ?? 0
        const childIds = childIdsByParentId.get(categoryId) ?? []
        const totalSpent = childIds.reduce((sum, childId) => sum + getTotalSpent(childId), ownSpent)

        totalSpentByCategoryId.set(categoryId, totalSpent)

        return totalSpent
    }

    const relevantCategoryIds = new Set<string>()

    for (const category of input.categories) {
        const spentCents = getTotalSpent(category.id)

        if (budgetAmountByCategoryId.has(category.id) || spentCents > 0) {
            relevantCategoryIds.add(category.id)
        }
    }

    for (const budget of input.budgets) {
        if (budget.categoryId && categoryMap.has(budget.categoryId)) {
            relevantCategoryIds.add(budget.categoryId)
        }
    }

    return input.categories
        .filter((category) => relevantCategoryIds.has(category.id))
        .map((category) => {
            const budgetAmountCents = budgetAmountByCategoryId.get(category.id) ?? null
            const spentCents = getTotalSpent(category.id)

            return {
                categoryId: category.id,
                categoryName: category.name,
                budgetAmountCents,
                spentCents,
                remainingCents: budgetAmountCents === null ? null : budgetAmountCents - spentCents,
                percentageBasisPoints:
                    budgetAmountCents === null
                        ? null
                        : calculatePercentageBasisPoints(spentCents, budgetAmountCents),
            }
        })
}

function calculatePercentageBasisPoints(spentCents: number, budgetAmountCents: number): number {
    if (budgetAmountCents <= 0) {
        return 0
    }

    const numerator = spentCents * 10000
    const quotient = Math.trunc(numerator / budgetAmountCents)
    const remainder = numerator % budgetAmountCents

    return quotient + (remainder * 2 >= budgetAmountCents ? 1 : 0)
}
