import { useEffect, useReducer } from "react";
import api from "@/lib/api";
import type { BudgetProgressItem } from "@/types/budget";

interface Budget {
  id: string;
  category_id: string;
  amount: number;
  year: number;
  month: number;
}

interface State {
  progressItems: BudgetProgressItem[];
  budgets: Budget[];
  isLoading: boolean;
  error: string | null;
}

type Action =
  | { type: "FETCH_START" }
  | {
      type: "FETCH_SUCCESS";
      payload: { progressItems: BudgetProgressItem[]; budgets: Budget[] };
    }
  | { type: "FETCH_ERROR" };

function reducer(_state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_START":
      return { progressItems: [], budgets: [], isLoading: true, error: null };
    case "FETCH_SUCCESS":
      return {
        progressItems: action.payload.progressItems,
        budgets: action.payload.budgets,
        isLoading: false,
        error: null,
      };
    case "FETCH_ERROR":
      return {
        progressItems: [],
        budgets: [],
        isLoading: false,
        error: "Failed to load budget overview",
      };
  }
}

const initialState: State = {
  progressItems: [],
  budgets: [],
  isLoading: false,
  error: null,
};

export function useBudgetOverview(
  workspaceId: string,
  month: string,
  reloadToken = 0,
) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (!workspaceId || !month) return;

    let cancelled = false;
    dispatch({ type: "FETCH_START" });

    const [year, monthPart] = month.split("-").map(Number);

    Promise.all([
      api.get<BudgetProgressItem[]>(
        `/workspaces/${workspaceId}/budgets/progress`,
        {
          params: { month },
        },
      ),
      api.get<Budget[]>(`/workspaces/${workspaceId}/budgets`, {
        params: { year, month: monthPart },
      }),
    ])
      .then(([progressRes, budgetsRes]) => {
        if (!cancelled) {
          dispatch({
            type: "FETCH_SUCCESS",
            payload: {
              progressItems: progressRes.data,
              budgets: budgetsRes.data,
            },
          });
        }
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "FETCH_ERROR" });
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, month, reloadToken]);

  return state;
}
