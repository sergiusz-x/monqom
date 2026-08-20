import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { getApiErrorMessage } from "@/lib/api-errors";
import { mapGoal } from "@/lib/goals";
import { queryKeys } from "@/lib/query-client";
import type { ApiGoal } from "@/types/api-contracts";

export function useGoals(workspaceId: string, includeArchived = true) {
  const query = useQuery({
    queryKey: [...queryKeys.goals(workspaceId), { includeArchived }],
    enabled: Boolean(workspaceId),
    queryFn: async ({ signal }) => {
      const response = await api.get<ApiGoal[]>(
        `/workspaces/${workspaceId}/goals`,
        {
          params: { include_archived: includeArchived },
          signal,
        },
      );
      return response.data.map(mapGoal);
    },
  });
  return {
    goals: query.data ?? [],
    isLoading: query.isPending,
    error: query.isError ? getApiErrorMessage(query.error) : null,
    retry: query.refetch,
  };
}

export function useGoal(workspaceId: string, goalId: string) {
  const query = useQuery({
    queryKey: queryKeys.goal(workspaceId, goalId),
    enabled: Boolean(workspaceId && goalId),
    queryFn: async ({ signal }) => {
      const response = await api.get<ApiGoal>(
        `/workspaces/${workspaceId}/goals/${goalId}`,
        { signal },
      );
      return mapGoal(response.data);
    },
  });
  return {
    goal: query.data ?? null,
    isLoading: query.isPending,
    error: query.isError ? getApiErrorMessage(query.error) : null,
    retry: query.refetch,
  };
}
