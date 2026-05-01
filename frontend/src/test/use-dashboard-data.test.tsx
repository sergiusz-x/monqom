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
    mockGet.mockImplementation((url: string) => {
      if (url.includes("spending-summary")) {
        return Promise.resolve({
          data: {
            month: "2026-04",
            currency: "USD",
            current_total: 100,
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
    });
  });

  it("loads spending summary, category breakdown, and recent transactions", async () => {
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
    expect(result.current.summary?.current_total).toBe(100);
    expect(result.current.categoryBreakdown?.categories[0].amount).toBe(100);
  });
});
