import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithQueryClient as render } from "@/test/query-test-utils";
import userEvent from "@testing-library/user-event";
import { TransactionFormModal } from "@/components/transactions/TransactionFormModal";

vi.mock("@/lib/api", () => ({
  default: { post: vi.fn(), put: vi.fn() },
}));
vi.mock("@/hooks/useTags", () => ({
  useTags: () => ({ tags: ["Food", "Travel"], isLoading: false, error: null }),
}));
vi.mock("@/hooks/usePaymentSources", () => ({
  usePaymentSources: vi.fn(() => ({
    paymentSources: [
      {
        id: "ps-1",
        name: "Cash",
        systemKey: "cash",
        isArchived: false,
      },
      {
        id: "ps-2",
        name: "Card",
        systemKey: null,
        isArchived: false,
      },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
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

  it("closes when the user clicks the backdrop", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(
      <TransactionFormModal
        open
        mode="create"
        workspaceId="ws-1"
        onClose={onClose}
        onSaved={vi.fn()}
      />,
    );
    const backdrop = container.ownerDocument.querySelector(
      '[data-slot="modal-backdrop"]',
    );

    expect(screen.getByRole("dialog")).toHaveClass("border", "border-border");
    expect(backdrop).not.toBeNull();
    await user.click(backdrop as HTMLElement);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays open when the user clicks inside the modal", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <TransactionFormModal
        open
        mode="create"
        workspaceId="ws-1"
        onClose={onClose}
        onSaved={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("Amount"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it.each([
    ["12000", "120.00", 120],
    ["1619", "16.19", 16.19],
  ])(
    "treats typed digits %s as minor currency units",
    async (digits, displayed, amount) => {
      const user = userEvent.setup();
      render(
        <TransactionFormModal
          open
          mode="create"
          workspaceId="ws-1"
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />,
      );

      const amountInput = screen.getByLabelText("Amount");
      await user.type(amountInput, digits);
      await user.type(screen.getByLabelText("Description"), "Lunch");
      expect(amountInput).toHaveValue(displayed);
      await user.click(screen.getByRole("button", { name: /pick category/i }));
      await user.click(
        screen.getByRole("button", { name: /save transaction/i }),
      );

      await waitFor(() => expect(mockApi.post).toHaveBeenCalledTimes(1));
      expect(mockApi.post.mock.calls[0][1]).toMatchObject({ amount });
    },
  );

  it("uses workspace currency, local today and the user's last payment source", async () => {
    const user = userEvent.setup();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    render(
      <TransactionFormModal
        open
        mode="create"
        workspaceId="ws-1"
        defaultCurrency="PLN"
        defaultPaymentSourceId="ps-2"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Date")).toHaveValue(today);
    await waitFor(() =>
      expect(screen.getByLabelText("Payment source")).toHaveValue("ps-2"),
    );
    await user.type(screen.getByLabelText("Amount"), "1234");
    await user.type(screen.getByLabelText("Description"), "Team lunch");
    await user.click(screen.getByRole("button", { name: /pick category/i }));
    await user.click(screen.getByRole("button", { name: /more options/i }));
    expect(screen.getByLabelText("Currency")).toHaveValue("PLN");
    await user.selectOptions(
      screen.getByLabelText("Select an existing tag"),
      "Food",
    );
    await user.type(screen.getByLabelText("New tag"), "Lunch");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await user.click(screen.getByRole("button", { name: /save transaction/i }));

    await waitFor(() => expect(mockApi.post).toHaveBeenCalledTimes(1));
    expect(mockApi.post.mock.calls[0][1]).toMatchObject({
      amount: 12.34,
      currency: "PLN",
      date: today,
      description: "Team lunch",
      category_id: "cat-1",
      payment_source_id: "ps-2",
      tags: ["Food", "Lunch"],
    });
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
          currency: "PLN",
          date: "2026-04-20T00:00:00.000Z",
          description: "Team lunch",
          workspaceId: "ws-1",
          categoryId: "cat-1",
          notes: "Lunch",
          tags: ["Food"],
          paymentSourceId: "ps-1",
          type: "expense",
          createdAt: "2026-04-20T00:00:00.000Z",
          updatedAt: "2026-04-20T00:00:00.000Z",
        }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Amount")).toHaveValue("20.50");
    expect(screen.getByLabelText("Description")).toHaveValue("Team lunch");
    expect(screen.getByLabelText("Notes")).toHaveValue("Lunch");
    expect(
      screen.getByRole("button", { name: "Remove tag Food" }),
    ).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Amount"));
    await user.type(screen.getByLabelText("Amount"), "1999");
    await user.click(screen.getByRole("button", { name: /save transaction/i }));

    await waitFor(() => expect(mockApi.put).toHaveBeenCalledTimes(1));
    expect(mockApi.put.mock.calls[0][0]).toBe(
      "/workspaces/ws-1/transactions/tx-1",
    );
    expect(mockApi.put.mock.calls[0][1]).toMatchObject({ amount: 19.99 });
  });
});
