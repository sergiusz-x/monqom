import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { queryKeys } from "@/lib/query-client";
import { getApiErrorMessage } from "@/lib/api-errors";
import type { ApiPaymentSource } from "@/types/api-contracts";
import { mapPaymentSource } from "@/lib/api-mappers";
export type { PaymentSource, PaymentSourceType } from "@/types/payment-source";

export function usePaymentSources(
  workspaceId: string,
  includeArchived = false,
) {
  const query = useQuery({
    queryKey: queryKeys.paymentSources(workspaceId, includeArchived),
    enabled: Boolean(workspaceId),
    queryFn: async ({ signal }) => {
      const response = await api.get<ApiPaymentSource[]>(
        `/workspaces/${workspaceId}/payment-sources`,
        {
          params: includeArchived ? { include_archived: true } : undefined,
          signal,
        },
      );
      return response.data.map(mapPaymentSource);
    },
  });

  return {
    paymentSources: query.data ?? [],
    isLoading: query.isPending && query.fetchStatus !== "idle",
    error: query.isError ? getApiErrorMessage(query.error) : null,
    retry: query.refetch,
  };
}
