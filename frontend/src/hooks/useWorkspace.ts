import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { queryKeys } from "@/lib/query-client";
import { getApiErrorMessage } from "@/lib/api-errors";

export interface WorkspaceInfo {
  id: string;
  name: string;
  timezone: string;
  baseCurrency: string;
  lastPaymentSourceId: string | null;
  baseCurrencyLocked: boolean;
}

interface WorkspaceContextValue {
  workspaces: WorkspaceInfo[];
  workspaceId: string | null;
  workspace: WorkspaceInfo | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  patchWorkspace: (patch: Partial<WorkspaceInfo>) => void;
  setActiveWorkspace: (workspaceId: string) => void;
}

const ACTIVE_WORKSPACE_STORAGE_KEY = "monqom-active-workspace";
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const EMPTY_WORKSPACES: WorkspaceInfo[] = [];

function readStoredWorkspaceId(): string | null {
  return localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY);
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    readStoredWorkspaceId,
  );
  const query = useQuery({
    queryKey: queryKeys.workspaces,
    queryFn: async ({ signal }) => {
      const response = await api.get<WorkspaceInfo[]>("/workspaces", {
        signal,
      });
      return response.data;
    },
  });
  const workspaces = query.data ?? EMPTY_WORKSPACES;
  const workspace = useMemo(
    () =>
      workspaces.find((item) => item.id === activeWorkspaceId) ??
      workspaces.at(0) ??
      null,
    [activeWorkspaceId, workspaces],
  );
  const workspaceId = workspace?.id ?? null;

  useEffect(() => {
    if (!query.isSuccess) return;
    if (workspaceId) {
      localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, workspaceId);
    } else {
      localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
    }
  }, [query.isSuccess, workspaceId]);

  const patchWorkspace = useCallback(
    (patch: Partial<WorkspaceInfo>) => {
      if (!workspaceId) return;
      queryClient.setQueryData<WorkspaceInfo[]>(
        queryKeys.workspaces,
        (current = []) =>
          current.map((item) =>
            item.id === workspaceId ? { ...item, ...patch } : item,
          ),
      );
    },
    [queryClient, workspaceId],
  );

  const setActiveWorkspace = useCallback(
    (nextWorkspaceId: string) => {
      if (!workspaces.some((item) => item.id === nextWorkspaceId)) return;
      localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, nextWorkspaceId);
      setActiveWorkspaceId(nextWorkspaceId);
    },
    [workspaces],
  );

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const value: WorkspaceContextValue = {
    workspaces,
    workspaceId,
    workspace,
    isLoading: query.isPending,
    error: query.isError ? getApiErrorMessage(query.error) : null,
    refetch,
    patchWorkspace,
    setActiveWorkspace,
  };

  return createElement(WorkspaceContext.Provider, { value }, children);
}

export function useWorkspace(): WorkspaceContextValue {
  const state = useContext(WorkspaceContext);

  if (!state) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }

  return state;
}
