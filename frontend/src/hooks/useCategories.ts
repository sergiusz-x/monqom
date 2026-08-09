import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { queryKeys } from "@/lib/query-client";
import type { ApiCategory } from "@/types/api-contracts";
import { mapCategory } from "@/lib/api-mappers";
import { getApiErrorMessage } from "@/lib/api-errors";
export function useCategories(workspaceId: string, includeArchived = false) {
  const query = useQuery({
    queryKey: [...queryKeys.categories(workspaceId), { includeArchived }],
    enabled: Boolean(workspaceId),
    queryFn: async ({ signal }) => {
      const response = await api.get<ApiCategory[]>(
        `/workspaces/${workspaceId}/categories`,
        {
          signal,
          params: includeArchived ? { include_archived: true } : undefined,
        },
      );
      return response.data.map(mapCategory);
    },
  });
  return {
    categories: query.data ?? [],
    isLoading: query.isPending && query.fetchStatus !== "idle",
    error: query.isError ? getApiErrorMessage(query.error) : null,
    retry: query.refetch,
  };
}
