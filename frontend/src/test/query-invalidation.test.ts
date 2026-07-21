import { describe, expect, it } from "vitest";
import { createTestQueryClient } from "@/test/query-test-utils";
import { queryKeys } from "@/lib/query-client";
import { invalidateFinancialData } from "@/lib/query-invalidation";

describe("invalidateFinancialData", () => {
  it("invalidates every workspace view affected by a transaction mutation", async () => {
    const client = createTestQueryClient();
    const workspaceId = "ws-1";
    const keys = [
      [...queryKeys.transactions(workspaceId), "list", { offset: 0 }],
      queryKeys.transaction(workspaceId, "tx-1"),
      [...queryKeys.dashboard(workspaceId), "2026-07"],
      [...queryKeys.budgets(workspaceId), "overview", "2026-07"],
      queryKeys.tags(workspaceId),
      queryKeys.workspaces,
    ] as const;

    keys.forEach((key) => client.setQueryData(key, { seeded: true }));

    await invalidateFinancialData(client, workspaceId);

    keys.forEach((key) => {
      expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    });
  });
});
