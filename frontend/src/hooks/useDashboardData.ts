import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { queryKeys } from "@/lib/query-client";
import type { ApiDashboardOverview } from "@/types/api-contracts";
import { mapDashboardOverview } from "@/lib/api-mappers";
import { getApiErrorMessage } from "@/lib/api-errors";

export function useDashboardData(workspaceId: string, month: string) {
  const query = useQuery({
    queryKey: [...queryKeys.dashboard(workspaceId), month],
    enabled: Boolean(workspaceId && month),
    queryFn: async ({ signal }) => {
      const response = await api.get<ApiDashboardOverview>(
        `/workspaces/${workspaceId}/dashboard`,
        { params: { month }, signal },
      );
      return mapDashboardOverview(response.data);
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
