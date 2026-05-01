import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
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
    mockGet.mockImplementation(
      (url: string, config?: { params?: { month?: string } }) => {
        if (url.includes("spending-summary")) {
          const requestMonth = config?.params?.month ?? "2026-04";
          const monthlyTotals: Record<string, number> = {
            "2025-11": 0,
            "2025-12": 10,
            "2026-01": 20,
            "2026-02": 30,
            "2026-03": 40,
            "2026-04": 100,
          };

          return Promise.resolve({
            data: {
              month: requestMonth,
              currency: "USD",
              current_total: monthlyTotals[requestMonth] ?? 0,
              previous_total: 80,
              change_amount: 20,
              change_percentage: 25,
              direction: "up",
            },
          });
        }

        if (url.includes("category-breakdown")) {
          return Promise.resolve({
            data: {
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
          });
        }

        return Promise.resolve({
          data: { data: [], total: 0, limit: 5, offset: 0 },
        });
      },
    );
  });

  it("loads spending summary, category breakdown, spending trend, and recent transactions", async () => {
    const { result } = renderHook(() => useDashboardData("ws-1", "2026-04"));

    await waitFor(() =>
      expect(result.current.categoryBreakdown).not.toBeNull(),
    );

    expect(mockGet).toHaveBeenCalledWith(
      "/workspaces/ws-1/dashboard/spending-summary",
      { params: { month: "2026-04" } },
    );
    expect(mockGet).toHaveBeenCalledWith(
      "/workspaces/ws-1/dashboard/category-breakdown",
      { params: { month: "2026-04" } },
    );
    expect(mockGet).toHaveBeenCalledWith(
      "/workspaces/ws-1/dashboard/spending-summary",
      { params: { month: "2025-11" } },
    );
    expect(mockGet).toHaveBeenCalledWith(
      "/workspaces/ws-1/dashboard/spending-summary",
      { params: { month: "2026-04" } },
    );
    expect(result.current.summary?.current_total).toBe(100);
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
