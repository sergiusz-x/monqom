import { useEffect, useReducer } from "react";
import api from "@/lib/api";

interface WorkspaceInfo {
  id: string;
  name: string;
}

interface State {
  workspaceId: string | null;
  isLoading: boolean;
  error: string | null;
}

type Action =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; payload: string | null }
  | { type: "FETCH_ERROR" };

function reducer(_state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_START":
      return { workspaceId: null, isLoading: true, error: null };
    case "FETCH_SUCCESS":
      return { workspaceId: action.payload, isLoading: false, error: null };
    case "FETCH_ERROR":
      return {
        workspaceId: null,
        isLoading: false,
        error: "Failed to load workspace",
      };
  }
}

const initialState: State = {
  workspaceId: null,
  isLoading: false,
  error: null,
};

export function useWorkspace(): State {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "FETCH_START" });

    api
      .get<WorkspaceInfo[]>("/workspaces")
      .then((res) => {
        if (!cancelled) {
          const first = res.data[0];
          dispatch({ type: "FETCH_SUCCESS", payload: first?.id ?? null });
        }
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "FETCH_ERROR" });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
