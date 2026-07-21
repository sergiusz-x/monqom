import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { queryKeys } from "@/lib/query-client";
import type { TransactionFilters } from "@/types/transaction";
import type { ApiTransactionsPage } from "@/types/api-contracts";
import { mapTransactionsPage } from "@/lib/api-mappers";
import { getApiErrorMessage } from "@/lib/api-errors";

function buildParams(
  filters: TransactionFilters,
  limit: number,
  offset: number,
): URLSearchParams {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    sort_by: filters.sortBy,
    sort_direction: filters.sortDirection,
  });

  if (filters.categoryIds.length > 0) {
    params.set("category_ids", filters.categoryIds.join(","));
  }
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.paymentSourceId) {
    params.set("payment_source_id", filters.paymentSourceId);
  }
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);

  return params;
}

export function useTransactions(
  workspaceId: string,
  filters: TransactionFilters,
  limit: number,
  offset: number,
) {
  const query = useQuery({
    queryKey: [
      ...queryKeys.transactions(workspaceId),
      "list",
      {
        categoryIds: filters.categoryIds,
        tag: filters.tag,
        paymentSourceId: filters.paymentSourceId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        sortBy: filters.sortBy,
        sortDirection: filters.sortDirection,
        limit,
        offset,
      },
    ],
    enabled: Boolean(workspaceId),
    queryFn: async ({ signal }) => {
      const response = await api.get<ApiTransactionsPage>(
        `/workspaces/${workspaceId}/transactions`,
        { params: buildParams(filters, limit, offset), signal },
      );
      return mapTransactionsPage(response.data);
    },
    placeholderData: (previousData) => previousData,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isPending && !query.data,
    error: query.isError ? getApiErrorMessage(query.error) : null,
    retry: query.refetch,
  };
}
