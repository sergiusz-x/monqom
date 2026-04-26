import { useState } from 'react'
import { useWorkspace } from '@/hooks/useWorkspace'
import { BudgetProgressList } from '@/components/BudgetProgressList'

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function BudgetsPage() {
  const { workspaceId, isLoading: workspaceLoading, error: workspaceError } = useWorkspace()
  const [month] = useState(getCurrentMonth)

  function renderContent() {
    if (workspaceLoading) {
      return (
        <div className="py-8 text-center text-muted-foreground" role="status">
          Loading…
        </div>
      )
    }

    if (workspaceError || !workspaceId) {
      return (
        <div className="py-8 text-center text-destructive" role="alert">
          {workspaceError ?? 'No workspace found.'}
        </div>
      )
    }

    return <BudgetProgressList workspaceId={workspaceId} month={month} />
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Budgets</h1>
        <span className="text-sm text-muted-foreground">{month}</span>
      </div>
      {renderContent()}
    </div>
  )
}
