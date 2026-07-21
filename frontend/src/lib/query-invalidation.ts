import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";

export async function invalidateFinancialData(
  client: QueryClient,
  workspaceId: string,
): Promise<void> {
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.transactions(workspaceId) }),
    client.invalidateQueries({ queryKey: queryKeys.dashboard(workspaceId) }),
    client.invalidateQueries({ queryKey: queryKeys.budgets(workspaceId) }),
    client.invalidateQueries({ queryKey: queryKeys.tags(workspaceId) }),
    client.invalidateQueries({ queryKey: queryKeys.workspaces }),
  ]);
}
