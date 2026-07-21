import { beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { renderHookWithQueryClient as renderHook } from "@/test/query-test-utils";
import { useDashboardData } from "@/hooks/useDashboardData";
import api from "@/lib/api";

vi.mock("@/lib/api", () => ({
  default: {
    get: vi.fn(),
  },
}));

const mockGet = api.get as ReturnType<typeof vi.fn>;

describe("useDashboardData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({
      data: {
        summary: {
          month: "2026-04",
          currency: "USD",
          current_total: 100,
          previous_total: 40,
          change_amount: 60,
          change_percentage: 150,
          direction: "up",
        },
        category_breakdown: {
          month: "2026-04",
          currency: "USD",
          total_spending: 100,
          categories: [
            {
              category_id: "cat-1",
              category_name: "Groceries",
              category_color: "#16a34a",
              amount: 100,
              percentage: 100,
            },
          ],
        },
        spending_trend: [
          { month: "2025-11", total: 0 },
          { month: "2025-12", total: 10 },
          { month: "2026-01", total: 20 },
          { month: "2026-02", total: 30 },
          { month: "2026-03", total: 40 },
          { month: "2026-04", total: 100 },
        ],
        recent_transactions: [],
      },
    });
  });

  it("loads the complete dashboard with exactly one request", async () => {
    const { result } = renderHook(() => useDashboardData("ws-1", "2026-04"));

    await waitFor(() =>
      expect(result.current.categoryBreakdown).not.toBeNull(),
    );

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(
      "/workspaces/ws-1/dashboard",
      expect.objectContaining({
        params: { month: "2026-04" },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result.current.summary?.currentTotal).toBe(100);
    expect(result.current.categoryBreakdown?.categories[0].amount).toBe(100);
    expect(result.current.spendingTrend).toEqual([
      { month: "2025-11", total: 0 },
      { month: "2025-12", total: 10 },
      { month: "2026-01", total: 20 },
      { month: "2026-02", total: 30 },
      { month: "2026-03", total: 40 },
      { month: "2026-04", total: 100 },
    ]);
  });
});
