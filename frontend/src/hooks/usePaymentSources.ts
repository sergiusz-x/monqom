import { useEffect, useReducer } from "react";
import api from "@/lib/api";

export interface PaymentSource {
  id: string;
  name: string;
}

interface State {
  paymentSources: PaymentSource[];
  isLoading: boolean;
  error: string | null;
}

type Action =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; payload: PaymentSource[] }
  | { type: "FETCH_ERROR" };

function reducer(_state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_START":
      return { paymentSources: [], isLoading: true, error: null };
    case "FETCH_SUCCESS":
      return { paymentSources: action.payload, isLoading: false, error: null };
    case "FETCH_ERROR":
      return {
        paymentSources: [],
        isLoading: false,
        error: "Failed to load payment sources",
      };
  }
}

const initialState: State = {
  paymentSources: [],
  isLoading: false,
  error: null,
};

export function usePaymentSources(workspaceId: string): State {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (!workspaceId) return;

    let cancelled = false;
    dispatch({ type: "FETCH_START" });

    api
      .get<PaymentSource[]>(`/workspaces/${workspaceId}/payment-sources`)
      .then((res) => {
        if (!cancelled) dispatch({ type: "FETCH_SUCCESS", payload: res.data });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "FETCH_ERROR" });
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return state;
}
