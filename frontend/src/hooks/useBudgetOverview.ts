import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { queryKeys } from "@/lib/query-client";
import type { Budget, BudgetProgressItem } from "@/types/budget";
import type { ApiBudget, ApiBudgetProgressItem } from "@/types/api-contracts";
import { mapBudget, mapBudgetProgressItem } from "@/lib/api-mappers";
import { getApiErrorMessage } from "@/lib/api-errors";

interface BudgetOverview {
  progressItems: BudgetProgressItem[];
  budgets: Budget[];
}

export function useBudgetOverview(workspaceId: string, month: string) {
  const query = useQuery({
    queryKey: [...queryKeys.budgets(workspaceId), "overview", month],
    enabled: Boolean(workspaceId && month),
    queryFn: async ({ signal }): Promise<BudgetOverview> => {
      const [year, monthPart] = month.split("-").map(Number);
      const [progressResponse, budgetsResponse] = await Promise.all([
        api.get<ApiBudgetProgressItem[]>(
          `/workspaces/${workspaceId}/budgets/progress`,
          { params: { month }, signal },
        ),
        api.get<ApiBudget[]>(`/workspaces/${workspaceId}/budgets`, {
          params: { year, month: monthPart },
          signal,
        }),
      ]);

      return {
        progressItems: progressResponse.data.map(mapBudgetProgressItem),
        budgets: budgetsResponse.data.map(mapBudget),
      };
    },
  });

  return {
    progressItems: query.data?.progressItems ?? [],
    budgets: query.data?.budgets ?? [],
    isLoading: query.isPending,
    error: query.isError ? getApiErrorMessage(query.error) : null,
    retry: query.refetch,
  };
}
