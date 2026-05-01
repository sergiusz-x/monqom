import { useEffect, useReducer } from "react";
import api from "@/lib/api";
import type {
  CategoryBreakdown,
  SpendingSummary,
  TransactionsListResponse,
  TransactionItem,
} from "@/types/dashboard";

interface State {
  summary: SpendingSummary | null;
  categoryBreakdown: CategoryBreakdown | null;
  transactions: TransactionItem[];
  isLoading: boolean;
  error: string | null;
}

type Action =
  | { type: "FETCH_START" }
  | {
      type: "FETCH_SUCCESS";
      payload: {
        summary: SpendingSummary;
        categoryBreakdown: CategoryBreakdown;
        transactions: TransactionItem[];
      };
    }
  | { type: "FETCH_ERROR" };

const initialState: State = {
  summary: null,
  categoryBreakdown: null,
  transactions: [],
  isLoading: false,
  error: null,
};

function reducer(_state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_START":
      return {
        summary: null,
        categoryBreakdown: null,
        transactions: [],
        isLoading: true,
        error: null,
      };
    case "FETCH_SUCCESS":
      return {
        summary: action.payload.summary,
        categoryBreakdown: action.payload.categoryBreakdown,
        transactions: action.payload.transactions,
        isLoading: false,
        error: null,
      };
    case "FETCH_ERROR":
      return {
        summary: null,
        categoryBreakdown: null,
        transactions: [],
        isLoading: false,
        error: "Failed to load dashboard",
      };
  }
}

export function useDashboardData(
  workspaceId: string,
  month: string,
  refreshKey = 0,
): State {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (!workspaceId || !month) return;

    let cancelled = false;
    dispatch({ type: "FETCH_START" });

    Promise.all([
      api.get<SpendingSummary>(
        `/workspaces/${workspaceId}/dashboard/spending-summary`,
        { params: { month } },
      ),
      api.get<CategoryBreakdown>(
        `/workspaces/${workspaceId}/dashboard/category-breakdown`,
        { params: { month } },
      ),
      api.get<TransactionsListResponse>(
        `/workspaces/${workspaceId}/transactions`,
        {
          params: { limit: 5, offset: 0 },
        },
      ),
    ])
      .then(([summaryRes, categoryBreakdownRes, transactionsRes]) => {
        if (cancelled) return;
        dispatch({
          type: "FETCH_SUCCESS",
          payload: {
            summary: summaryRes.data,
            categoryBreakdown: categoryBreakdownRes.data,
            transactions: transactionsRes.data.data,
          },
        });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "FETCH_ERROR" });
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, month, refreshKey]);

  return state;
}
