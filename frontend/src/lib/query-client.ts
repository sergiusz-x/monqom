import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});

export const queryKeys = {
  workspaces: ["workspaces"] as const,
  categories: (workspaceId: string) =>
    ["workspaces", workspaceId, "categories"] as const,
  paymentSourcesRoot: (workspaceId: string) =>
    ["workspaces", workspaceId, "payment-sources"] as const,
  paymentSources: (workspaceId: string, includeArchived: boolean) =>
    [
      ...queryKeys.paymentSourcesRoot(workspaceId),
      { includeArchived },
    ] as const,
  tags: (workspaceId: string) => ["workspaces", workspaceId, "tags"] as const,
  transactions: (workspaceId: string) =>
    ["workspaces", workspaceId, "transactions"] as const,
  transaction: (workspaceId: string, transactionId: string) =>
    ["workspaces", workspaceId, "transactions", transactionId] as const,
  dashboard: (workspaceId: string) =>
    ["workspaces", workspaceId, "dashboard"] as const,
  budgets: (workspaceId: string) =>
    ["workspaces", workspaceId, "budgets"] as const,
};
