import { useEffect, useReducer } from "react";
import api from "@/lib/api";
import type {
  CategoryBreakdown,
  SpendingTrendItem,
  SpendingSummary,
  TransactionsListResponse,
  TransactionItem,
} from "@/types/dashboard";

interface State {
  summary: SpendingSummary | null;
  categoryBreakdown: CategoryBreakdown | null;
  spendingTrend: SpendingTrendItem[];
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
        spendingTrend: SpendingTrendItem[];
        transactions: TransactionItem[];
      };
    }
  | { type: "FETCH_ERROR" };

const initialState: State = {
  summary: null,
  categoryBreakdown: null,
  spendingTrend: [],
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
        spendingTrend: [],
        transactions: [],
        isLoading: true,
        error: null,
      };
    case "FETCH_SUCCESS":
      return {
        summary: action.payload.summary,
        categoryBreakdown: action.payload.categoryBreakdown,
        spendingTrend: action.payload.spendingTrend,
        transactions: action.payload.transactions,
        isLoading: false,
        error: null,
      };
    case "FETCH_ERROR":
      return {
        summary: null,
        categoryBreakdown: null,
        spendingTrend: [],
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

    const trendMonths = getLastSixMonths(month);

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
      ...trendMonths.map((trendMonth) =>
        api.get<SpendingSummary>(
          `/workspaces/${workspaceId}/dashboard/spending-summary`,
          { params: { month: trendMonth } },
        ),
      ),
    ])
      .then(
        ([
          summaryRes,
          categoryBreakdownRes,
          transactionsRes,
          ...trendResponses
        ]) => {
          if (cancelled) return;
          dispatch({
            type: "FETCH_SUCCESS",
            payload: {
              summary: summaryRes.data,
              categoryBreakdown: categoryBreakdownRes.data,
              spendingTrend: trendResponses.map((response) => ({
                month: response.data.month,
                total: response.data.current_total,
              })),
              transactions: transactionsRes.data.data,
            },
          });
        },
      )
      .catch(() => {
        if (!cancelled) dispatch({ type: "FETCH_ERROR" });
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, month, refreshKey]);

  return state;
}

function getLastSixMonths(month: string): string[] {
  const [yearPart, monthPart] = month.split("-");
  const endDate = new Date(Number(yearPart), Number(monthPart) - 1, 1);

  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(
      endDate.getFullYear(),
      endDate.getMonth() - 5 + index,
      1,
    );

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}
