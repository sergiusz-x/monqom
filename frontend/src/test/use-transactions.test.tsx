import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
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
          categoryId: "cat-1",
          tag: "food",
          paymentSourceId: "src-1",
          dateFrom: "2026-04-01",
          dateTo: "2026-04-30",
        },
        20,
        40,
      ),
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));

    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain("/workspaces/ws-1/transactions?");
    expect(url).toContain("category_id=cat-1");
    expect(url).toContain("tag=food");
    expect(url).toContain("payment_source_id=src-1");
    expect(url).toContain("date_from=2026-04-01");
    expect(url).toContain("date_to=2026-04-30");
    expect(url).toContain("limit=20");
    expect(url).toContain("offset=40");
  });

  it("relies on backend default date-desc sorting (no explicit sort override)", async () => {
    renderHook(() =>
      useTransactions(
        "ws-1",
        {
          categoryId: "",
          tag: "",
          paymentSourceId: "",
          dateFrom: "",
          dateTo: "",
        },
        20,
        0,
      ),
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));

    const url = mockGet.mock.calls[0][0] as string;
    expect(url).not.toContain("sort=");
    expect(url).not.toContain("order=");
  });
});
