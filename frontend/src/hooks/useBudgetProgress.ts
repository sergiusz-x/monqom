import { useEffect, useReducer } from 'react'
import api from '@/lib/api'
import type { BudgetProgressItem } from '@/types/budget'

interface State {
  items: BudgetProgressItem[]
  isLoading: boolean
  error: string | null
}

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: BudgetProgressItem[] }
  | { type: 'FETCH_ERROR' }

function reducer(_state: State, action: Action): State {
  switch (action.type) {
    case 'FETCH_START':
      return { items: [], isLoading: true, error: null }
    case 'FETCH_SUCCESS':
      return { items: action.payload, isLoading: false, error: null }
    case 'FETCH_ERROR':
      return { items: [], isLoading: false, error: 'Failed to load budget progress' }
  }
}

const initialState: State = { items: [], isLoading: false, error: null }

export function useBudgetProgress(workspaceId: string, month: string): State {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    if (!workspaceId || !month) return

    let cancelled = false
    dispatch({ type: 'FETCH_START' })

    api
      .get<BudgetProgressItem[]>(`/workspaces/${workspaceId}/budgets/progress`, {
        params: { month },
      })
      .then((res) => {
        if (!cancelled) dispatch({ type: 'FETCH_SUCCESS', payload: res.data })
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'FETCH_ERROR' })
      })

    return () => {
      cancelled = true
    }
  }, [workspaceId, month])

  return state
}
