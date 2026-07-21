import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { renderHookWithQueryClient as renderHook } from "@/test/query-test-utils";
import { useTransactions } from "@/hooks/useTransactions";
import api from "@/lib/api";

vi.mock("@/lib/api", () => ({
  default: {
    get: vi.fn(),
  },
}));

const mockGet = api.get as ReturnType<typeof vi.fn>;

describe("useTransactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({
      data: { data: [], total: 0, limit: 20, offset: 0 },
    });
  });

  it("builds query params from filters and pagination", async () => {
    renderHook(() =>
      useTransactions(
        "ws-1",
        {
          categoryIds: ["cat-1"],
          tag: "food",
          paymentSourceId: "src-1",
          dateFrom: "2026-04-01",
          dateTo: "2026-04-30",
          sortBy: "amount",
          sortDirection: "asc",
        },
        20,
        40,
      ),
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));

    expect(mockGet.mock.calls[0][0]).toBe("/workspaces/ws-1/transactions");
    const params = (mockGet.mock.calls[0][1] as { params: URLSearchParams })
      .params;
    expect(params.get("category_ids")).toBe("cat-1");
    expect(params.get("tag")).toBe("food");
    expect(params.get("payment_source_id")).toBe("src-1");
    expect(params.get("date_from")).toBe("2026-04-01");
    expect(params.get("date_to")).toBe("2026-04-30");
    expect(params.get("limit")).toBe("20");
    expect(params.get("offset")).toBe("40");
    expect(params.get("sort_by")).toBe("amount");
    expect(params.get("sort_direction")).toBe("asc");
  });

  it("sends the default date-desc sorting", async () => {
    renderHook(() =>
      useTransactions(
        "ws-1",
        {
          categoryIds: [],
          tag: "",
          paymentSourceId: "",
          dateFrom: "",
          dateTo: "",
          sortBy: "date",
          sortDirection: "desc",
        },
        20,
        0,
      ),
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));

    const params = (mockGet.mock.calls[0][1] as { params: URLSearchParams })
      .params;
    expect(params.get("sort_by")).toBe("date");
    expect(params.get("sort_direction")).toBe("desc");
  });
});
