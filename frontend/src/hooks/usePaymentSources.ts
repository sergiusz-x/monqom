import { useQuery } from "@tanstack/react-query";
import { paymentSourcesApi } from "@/api/contract";
import { queryKeys } from "@/lib/query-client";
import { getApiErrorMessage } from "@/lib/api-errors";
import { mapPaymentSource } from "@/lib/api-mappers";
import type { ApiPaymentSource } from "@/types/api-contracts";
export type { PaymentSource, PaymentSourceType } from "@/types/payment-source";

export function usePaymentSources(
  workspaceId: string,
  includeArchived = false,
) {
  const query = useQuery({
    queryKey: queryKeys.paymentSources(workspaceId, includeArchived),
    enabled: Boolean(workspaceId),
    queryFn: async ({ signal }) => {
      const response =
        await paymentSourcesApi.paymentSourcesControllerListPaymentSources(
          workspaceId,
          includeArchived || undefined,
          { signal },
        );
      return response.data.map((source) =>
        mapPaymentSource(source as ApiPaymentSource),
      );
    },
  });

  return {
    paymentSources: query.data ?? [],
    isLoading: query.isPending && query.fetchStatus !== "idle",
    error: query.isError ? getApiErrorMessage(query.error) : null,
    retry: query.refetch,
  };
}
