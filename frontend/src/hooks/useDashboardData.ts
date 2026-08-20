import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/api/contract";
import { queryKeys } from "@/lib/query-client";
import { mapDashboardOverview } from "@/lib/api-mappers";
import { getApiErrorMessage } from "@/lib/api-errors";
import type { ApiDashboardOverview } from "@/types/api-contracts";

export function useDashboardData(workspaceId: string, month: string) {
  const query = useQuery({
    queryKey: [...queryKeys.dashboard(workspaceId), month],
    enabled: Boolean(workspaceId && month),
    queryFn: async ({ signal }) => {
      const response = await dashboardApi.dashboardControllerGetOverview(
        month,
        workspaceId,
        { signal },
      );
      return mapDashboardOverview(response.data as ApiDashboardOverview);
    },
  });

  return {
    summary: query.data?.summary ?? null,
    categoryBreakdown: query.data?.categoryBreakdown ?? null,
    spendingTrend: query.data?.spendingTrend ?? [],
    transactions: query.data?.recentTransactions ?? [],
    isLoading: query.isPending,
    error: query.isError ? getApiErrorMessage(query.error) : null,
    retry: query.refetch,
  };
}
