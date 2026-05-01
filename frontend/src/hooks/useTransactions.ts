import { useEffect, useReducer } from "react";
import api from "@/lib/api";
import type {
  TransactionFilters,
  TransactionsResponse,
} from "@/types/transaction";

interface State {
  data: TransactionsResponse | null;
  isLoading: boolean;
  error: string | null;
}

type Action =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; payload: TransactionsResponse }
  | { type: "FETCH_ERROR" };

function reducer(_state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_START":
      return { data: null, isLoading: true, error: null };
    case "FETCH_SUCCESS":
      return { data: action.payload, isLoading: false, error: null };
    case "FETCH_ERROR":
      return {
        data: null,
        isLoading: false,
        error: "Failed to load transactions",
      };
  }
}

const initialState: State = { data: null, isLoading: false, error: null };

function buildParams(
  categoryId: string,
  tag: string,
  paymentSourceId: string,
  dateFrom: string,
  dateTo: string,
  limit: number,
  offset: number,
): URLSearchParams {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  if (categoryId) params.set("category_id", categoryId);
  if (tag) params.set("tag", tag);
  if (paymentSourceId) params.set("payment_source_id", paymentSourceId);
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);

  return params;
}

export function useTransactions(
  workspaceId: string,
  filters: TransactionFilters,
  limit: number,
  offset: number,
  refreshKey = 0,
): State {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { categoryId, tag, paymentSourceId, dateFrom, dateTo } = filters;

  useEffect(() => {
    if (!workspaceId) return;

    let cancelled = false;
    dispatch({ type: "FETCH_START" });

    const params = buildParams(
      categoryId,
      tag,
      paymentSourceId,
      dateFrom,
      dateTo,
      limit,
      offset,
    );

    api
      .get<TransactionsResponse>(
        `/workspaces/${workspaceId}/transactions?${params.toString()}`,
      )
      .then((res) => {
        if (!cancelled) dispatch({ type: "FETCH_SUCCESS", payload: res.data });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "FETCH_ERROR" });
      });

    return () => {
      cancelled = true;
    };
  }, [
    workspaceId,
    categoryId,
    tag,
    paymentSourceId,
    dateFrom,
    dateTo,
    limit,
    offset,
    refreshKey,
  ]);

  return state;
}
