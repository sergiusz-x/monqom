import { beforeEach, describe, expect, it } from "vitest";
import {
  buildTransactionListParams,
  DEFAULT_TRANSACTION_FILTERS,
  loadTransactionPreferences,
  parseTransactionFilters,
  parseTransactionPage,
  hasTransactionListState,
  saveTransactionPreferences,
} from "@/lib/transaction-list-state";

describe("transaction list URL and preferences", () => {
  beforeEach(() => localStorage.clear());

  it("parses a bookmarked URL and validates unsupported values", () => {
    const filters = parseTransactionFilters(
      new URLSearchParams(
        "category_ids=cat-1,cat-2&tag=food&date_from=bad&sort_by=unknown&sort_direction=asc",
      ),
    );

    expect(filters).toEqual({
      ...DEFAULT_TRANSACTION_FILTERS,
      categoryIds: ["cat-1", "cat-2"],
      tag: "food",
      sortDirection: "asc",
    });
  });

  it("serializes filter, sorting, and pagination state canonically", () => {
    const params = buildTransactionListParams(
      new URLSearchParams("unrelated=kept&category_id=legacy"),
      {
        ...DEFAULT_TRANSACTION_FILTERS,
        paymentSourceId: "card-1",
        sortBy: "amount",
        sortDirection: "asc",
      },
      3,
    );

    expect(params.toString()).toBe(
      "unrelated=kept&payment_source_id=card-1&sort_by=amount&sort_direction=asc&page=3",
    );
    expect(parseTransactionPage(params)).toBe(3);
    expect(hasTransactionListState(new URLSearchParams("page=3"))).toBe(true);
  });

  it("stores a versioned preference document", () => {
    saveTransactionPreferences(localStorage, "ws-1", {
      ...DEFAULT_TRANSACTION_FILTERS,
      tag: "weekly",
    });

    expect(
      JSON.parse(
        localStorage.getItem("monqom:transaction-list-preferences:v1:ws-1")!,
      ),
    ).toEqual({
      version: 1,
      filters: { ...DEFAULT_TRANSACTION_FILTERS, tag: "weekly" },
    });
  });

  it("safely migrates and validates a legacy preference", () => {
    localStorage.setItem(
      "monqom:transaction-filters:ws-1",
      JSON.stringify({
        categoryIds: ["cat-1", 42, "", "cat-1"],
        tag: " food ",
        dateFrom: "not-a-date",
        sortBy: "not-a-field",
        sortDirection: "asc",
        unknown: "ignored",
      }),
    );

    expect(loadTransactionPreferences(localStorage, "ws-1")).toEqual({
      ...DEFAULT_TRANSACTION_FILTERS,
      categoryIds: ["cat-1"],
      tag: "food",
      sortDirection: "asc",
    });
    expect(localStorage.getItem("monqom:transaction-filters:ws-1")).toBeNull();
    expect(
      localStorage.getItem("monqom:transaction-list-preferences:v1:ws-1"),
    ).not.toBeNull();
  });

  it("discards malformed or unsupported preference documents", () => {
    localStorage.setItem(
      "monqom:transaction-list-preferences:v1:ws-1",
      JSON.stringify({ version: 999, filters: DEFAULT_TRANSACTION_FILTERS }),
    );

    expect(loadTransactionPreferences(localStorage, "ws-1")).toBeNull();
    expect(
      localStorage.getItem("monqom:transaction-list-preferences:v1:ws-1"),
    ).toBeNull();
  });
});
