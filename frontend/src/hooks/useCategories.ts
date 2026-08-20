import { useQuery } from "@tanstack/react-query";
import { categoriesApi } from "@/api/contract";
import { queryKeys } from "@/lib/query-client";
import { mapCategory } from "@/lib/api-mappers";
import { getApiErrorMessage } from "@/lib/api-errors";
import type { ApiCategory } from "@/types/api-contracts";
export function useCategories(
  workspaceId: string,
  includeArchived = false,
  type: "expense" | "income" = "expense",
) {
  const query = useQuery({
    queryKey: [...queryKeys.categories(workspaceId), { includeArchived, type }],
    enabled: Boolean(workspaceId),
    queryFn: async ({ signal }) => {
      const response = await categoriesApi.categoriesControllerListCategories(
        workspaceId,
        includeArchived || undefined,
        type,
        { signal },
      );
      return response.data.map((category) =>
        mapCategory(category as unknown as ApiCategory),
      );
    },
  });
  return {
    categories: query.data ?? [],
    isLoading: query.isPending && query.fetchStatus !== "idle",
    error: query.isError ? getApiErrorMessage(query.error) : null,
    retry: query.refetch,
  };
}
