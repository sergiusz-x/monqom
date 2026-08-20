import { useQuery } from "@tanstack/react-query";
import { budgetsApi } from "@/api/contract";
import { queryKeys } from "@/lib/query-client";
import { mapBudgetProgressItem } from "@/lib/api-mappers";
import { getApiErrorMessage } from "@/lib/api-errors";

export function useBudgetProgress(workspaceId: string, month: string) {
  const query = useQuery({
    queryKey: [...queryKeys.budgets(workspaceId), "progress", month],
    enabled: Boolean(workspaceId && month),
    queryFn: async ({ signal }) => {
      const response = await budgetsApi.budgetsControllerListBudgetProgress(
        month,
        workspaceId,
        { signal },
      );
      return response.data.map(mapBudgetProgressItem);
    },
  });

  return {
    items: query.data ?? [],
    isLoading: query.isPending,
    error: query.isError ? getApiErrorMessage(query.error) : null,
    retry: query.refetch,
  };
}
