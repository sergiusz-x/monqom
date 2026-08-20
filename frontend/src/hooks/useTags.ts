import { useQuery } from "@tanstack/react-query";
import { transactionTagsApi } from "@/api/contract";
import { queryKeys } from "@/lib/query-client";
import { getApiErrorMessage } from "@/lib/api-errors";

export function useTags(workspaceId: string) {
  const query = useQuery({
    queryKey: queryKeys.tags(workspaceId),
    enabled: Boolean(workspaceId),
    queryFn: async ({ signal }) => {
      const response =
        await transactionTagsApi.transactionTagsControllerListWorkspaceTags(
          workspaceId,
          { signal },
        );
      return response.data;
    },
  });

  return {
    tags: query.data ?? [],
    isLoading: query.isPending && query.fetchStatus !== "idle",
    error: query.isError ? getApiErrorMessage(query.error) : null,
    retry: query.refetch,
  };
}
