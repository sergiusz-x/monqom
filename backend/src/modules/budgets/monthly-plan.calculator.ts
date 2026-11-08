import type { CalculatedBudgetProgress } from './budget-progress.calculator'

export function remainingBudgetCommitments(
    progress: CalculatedBudgetProgress[],
    categories: { id: string; parentId: string | null }[],
): { amount: number; overlaps: boolean } {
    const budgeted = new Set(
        progress.filter((item) => item.budgetAmountCents !== null).map((item) => item.categoryId),
    )
    const parents = new Map(categories.map((category) => [category.id, category.parentId]))
    let amount = 0
    let overlaps = false
    for (const item of progress) {
        if (item.budgetAmountCents === null) continue
        let parent = parents.get(item.categoryId)
        const visited = new Set([item.categoryId])
        let covered = false
        while (parent && !visited.has(parent)) {
            if (budgeted.has(parent)) {
                covered = true
                break
            }
            visited.add(parent)
            parent = parents.get(parent)
        }
        if (covered) {
            overlaps = true
            continue
        }
        amount += Math.max(item.budgetAmountCents - item.spentCents, 0)
    }
    return { amount, overlaps }
}

export function plannedBudgetTotal(
    progress: CalculatedBudgetProgress[],
    categories: { id: string; parentId: string | null }[],
): { amount: number; overlaps: boolean } {
    return remainingBudgetCommitments(
        progress.map((item) => ({ ...item, spentCents: 0 })),
        categories,
    )
}

export function remainingGoalCommitment(planned: number, deposited: number): number {
    return Math.max(planned - deposited, 0)
}
