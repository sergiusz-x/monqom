import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionFormModal } from "@/components/transactions/TransactionFormModal";

vi.mock("@/lib/api", () => ({
  default: { post: vi.fn(), put: vi.fn() },
}));
vi.mock("@/hooks/usePaymentSources", () => ({
  usePaymentSources: vi.fn(() => ({
    paymentSources: [{ id: "ps-1", name: "Cash" }],
    error: null,
  })),
}));
vi.mock("@/components/CategorySelector", () => ({
  CategorySelector: ({
    onChange,
  }: {
    onChange: (value: string | null) => void;
  }) => (
    <button type="button" onClick={() => onChange("cat-1")}>
      Pick category
    </button>
  ),
}));

import api from "@/lib/api";

const mockApi = api as unknown as {
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
};

describe("TransactionFormModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.post.mockResolvedValue({ data: {} });
    mockApi.put.mockResolvedValue({ data: {} });
  });

  it("creates transaction from modal form", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(
      <TransactionFormModal
        open
        mode="create"
        workspaceId="ws-1"
        onClose={onClose}
        onSaved={onSaved}
      />,
    );

    await user.type(screen.getByLabelText("Amount"), "12.34");
    await user.click(screen.getByRole("button", { name: /pick category/i }));
    await user.type(screen.getByLabelText("Tags"), "Food, Lunch");
    await user.click(screen.getByRole("button", { name: /save transaction/i }));

    await waitFor(() => expect(mockApi.post).toHaveBeenCalledTimes(1));
    expect(mockApi.post.mock.calls[0][0]).toBe("/workspaces/ws-1/transactions");
    expect(mockApi.post.mock.calls[0][1]).toMatchObject({
      amount: 12.34,
      category_id: "cat-1",
      tags: ["Food", "Lunch"],
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("prefills and updates transaction in edit mode", async () => {
    const user = userEvent.setup();
    render(
      <TransactionFormModal
        open
        mode="edit"
        workspaceId="ws-1"
        transaction={{
          id: "tx-1",
          amount: 20.5,
          date: "2026-04-20T00:00:00.000Z",
          category_id: "cat-1",
          notes: "Lunch",
          tags: ["Food"],
          payment_source_id: null,
        }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Amount")).toHaveValue("20.50");
    expect(screen.getByLabelText("Notes")).toHaveValue("Lunch");
    expect(screen.getByLabelText("Tags")).toHaveValue("Food");

    await user.clear(screen.getByLabelText("Amount"));
    await user.type(screen.getByLabelText("Amount"), "19.99");
    await user.click(screen.getByRole("button", { name: /save transaction/i }));

    await waitFor(() => expect(mockApi.put).toHaveBeenCalledTimes(1));
    expect(mockApi.put.mock.calls[0][0]).toBe(
      "/workspaces/ws-1/transactions/tx-1",
    );
    expect(mockApi.put.mock.calls[0][1]).toMatchObject({ amount: 19.99 });
  });
});
