import { useQuery } from "@tanstack/react-query";
import { budgetsApi } from "@/api/contract";
import { queryKeys } from "@/lib/query-client";
import type { Budget, BudgetProgressItem } from "@/types/budget";
import { mapBudget, mapBudgetProgressItem } from "@/lib/api-mappers";
import { getApiErrorMessage } from "@/lib/api-errors";
import type { ApiBudget } from "@/types/api-contracts";

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
        budgetsApi.budgetsControllerListBudgetProgress(month, workspaceId, {
          signal,
        }),
        budgetsApi.budgetsControllerListBudgets(year, monthPart, workspaceId, {
          signal,
        }),
      ]);

      return {
        progressItems: progressResponse.data.map(mapBudgetProgressItem),
        budgets: budgetsResponse.data.map((budget) =>
          mapBudget(budget as ApiBudget),
        ),
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
