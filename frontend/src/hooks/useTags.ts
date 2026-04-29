import { useEffect, useReducer } from "react";
import api from "@/lib/api";

interface State {
  tags: string[];
  isLoading: boolean;
  error: string | null;
}

type Action =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; payload: string[] }
  | { type: "FETCH_ERROR" };

function reducer(_state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_START":
      return { tags: [], isLoading: true, error: null };
    case "FETCH_SUCCESS":
      return { tags: action.payload, isLoading: false, error: null };
    case "FETCH_ERROR":
      return { tags: [], isLoading: false, error: "Failed to load tags" };
  }
}

const initialState: State = { tags: [], isLoading: false, error: null };

export function useTags(workspaceId: string): State {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (!workspaceId) return;

    let cancelled = false;
    dispatch({ type: "FETCH_START" });

    api
      .get<string[]>(`/workspaces/${workspaceId}/tags`)
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
