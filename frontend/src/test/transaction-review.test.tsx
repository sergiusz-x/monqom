import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TransactionMetadata } from "@/components/transactions/TransactionMetadata";
import { mapTransaction } from "@/lib/api-mappers";
import {
  buildTransactionListParams,
  DEFAULT_TRANSACTION_FILTERS,
  parseTransactionFilters,
} from "@/lib/transaction-list-state";
import type { ApiTransaction } from "@/types/api-contracts";

const imported: ApiTransaction = {
  id: "imported",
  workspace_id: "workspace",
  category_id: null,
  integration_id: "integration",
  integration_name: "Bank sync",
  payment_source_id: "card",
  type: "expense",
  amount: 12,
  currency: "PLN",
  date: "2026-10-20",
  description: "Example",
  notes: null,
  tags: [],
  created_at: "2026-10-20T10:00:00Z",
  updated_at: "2026-10-20T10:00:00Z",
};

describe("transaction review and provenance", () => {
  it("keeps provenance after a category is assigned and removes attention", () => {
    const { rerender } = render(
      <TransactionMetadata transaction={mapTransaction(imported)} />,
    );
    expect(screen.getByText("Needs a category")).toBeInTheDocument();
    expect(screen.queryByText(/Bank sync/)).not.toBeInTheDocument();
    expect(screen.queryByText("Added manually")).not.toBeInTheDocument();
    rerender(
      <TransactionMetadata
        transaction={mapTransaction({ ...imported, category_id: "food" })}
      />,
    );
    expect(screen.queryByText("Needs a category")).not.toBeInTheDocument();
    expect(screen.queryByText(/Bank sync/)).not.toBeInTheDocument();
    expect(
      mapTransaction({ ...imported, category_id: "food" }).integrationId,
    ).toBe("integration");
  });

  it("also flags manual transactions without a category, without calling them imported", () => {
    render(
      <TransactionMetadata
        transaction={mapTransaction({
          ...imported,
          integration_id: null,
          integration_name: null,
        })}
      />,
    );
    expect(screen.getByText("Needs a category")).toBeInTheDocument();
    expect(screen.queryByText("Added manually")).not.toBeInTheDocument();
    expect(screen.queryByText(/Bank sync/)).not.toBeInTheDocument();
  });

  it("preserves combined review and provenance filters through a bookmarked URL", () => {
    const filters = {
      ...DEFAULT_TRANSACTION_FILTERS,
      uncategorized: true,
      origin: "integration" as const,
    };
    const params = buildTransactionListParams(new URLSearchParams(), filters);
    expect(params.get("category_status")).toBe("uncategorized");
    expect(params.get("origin")).toBe("integration");
    expect(parseTransactionFilters(params)).toEqual(filters);
    const cleared = buildTransactionListParams(
      params,
      DEFAULT_TRANSACTION_FILTERS,
    );
    expect(cleared.has("category_status")).toBe(false);
    expect(cleared.has("origin")).toBe(false);
  });
});
