import { useQuery } from "@tanstack/react-query";
import { goalsApi } from "@/api/contract";
import { getApiErrorMessage } from "@/lib/api-errors";
import { mapGoal } from "@/lib/goals";
import { queryKeys } from "@/lib/query-client";
import type { ApiGoal } from "@/types/api-contracts";

export function useGoals(workspaceId: string, includeArchived = true) {
  const query = useQuery({
    queryKey: [...queryKeys.goals(workspaceId), { includeArchived }],
    enabled: Boolean(workspaceId),
    queryFn: async ({ signal }) => {
      const response = await goalsApi.goalsControllerList(
        workspaceId,
        includeArchived ? "true" : "false",
        { signal },
      );
      return response.data.map((goal) => mapGoal(goal as ApiGoal));
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
      const response = await goalsApi.goalsControllerGet(goalId, workspaceId, {
        signal,
      });
      return mapGoal(response.data as ApiGoal);
    },
  });
  return {
    goal: query.data ?? null,
    isLoading: query.isPending,
    error: query.isError ? getApiErrorMessage(query.error) : null,
    retry: query.refetch,
  };
}
