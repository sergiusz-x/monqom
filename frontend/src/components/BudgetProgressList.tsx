import { useBudgetProgress } from '@/hooks/useBudgetProgress'
import { BudgetProgressBar } from './BudgetProgressBar'

export interface BudgetProgressListProps {
  workspaceId: string
  month: string
}

export function BudgetProgressList({ workspaceId, month }: BudgetProgressListProps) {
  const { items, isLoading, error } = useBudgetProgress(workspaceId, month)

  if (isLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground" role="status">
        Loading budget progress…
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-8 text-center text-destructive" role="alert">
        {error}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No budgets or spending this month.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <BudgetProgressBar key={item.category_id} item={item} />
      ))}
    </div>
  )
}
