import { useQuery } from "@tanstack/react-query";
import { transactionsApi } from "@/api/contract";
import { queryKeys } from "@/lib/query-client";
import type { TransactionFilters } from "@/types/transaction";
import type { ApiTransactionsPage } from "@/types/api-contracts";
import { mapTransactionsPage } from "@/lib/api-mappers";
import { getApiErrorMessage } from "@/lib/api-errors";

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
        type: filters.type,
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
      const response =
        await transactionsApi.transactionsControllerListTransactions(
          workspaceId,
          filters.type || undefined,
          undefined,
          filters.categoryIds.length ? filters.categoryIds : undefined,
          filters.sortBy,
          filters.sortDirection,
          filters.paymentSourceId || undefined,
          filters.tag || undefined,
          filters.dateFrom || undefined,
          filters.dateTo || undefined,
          limit,
          offset,
          { signal },
        );
      return mapTransactionsPage(response.data as ApiTransactionsPage);
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
