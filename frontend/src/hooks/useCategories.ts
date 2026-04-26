import { useEffect, useReducer } from 'react'
import api from '@/lib/api'
import type { Category } from '@/types/category'

interface State {
  categories: Category[]
  isLoading: boolean
  error: string | null
}

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: Category[] }
  | { type: 'FETCH_ERROR' }

function reducer(_state: State, action: Action): State {
  switch (action.type) {
    case 'FETCH_START':
      return { categories: [], isLoading: true, error: null }
    case 'FETCH_SUCCESS':
      return { categories: action.payload, isLoading: false, error: null }
    case 'FETCH_ERROR':
      return { categories: [], isLoading: false, error: 'Failed to load categories' }
  }
}

const initialState: State = { categories: [], isLoading: false, error: null }

export function useCategories(workspaceId: string): State {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    if (!workspaceId) return

    let cancelled = false
    dispatch({ type: 'FETCH_START' })

    api
      .get<Category[]>(`/workspaces/${workspaceId}/categories`)
      .then((res) => {
        if (!cancelled) dispatch({ type: 'FETCH_SUCCESS', payload: res.data })
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'FETCH_ERROR' })
      })

    return () => {
      cancelled = true
    }
  }, [workspaceId])

  return state
}
