import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithQueryClient as render } from "@/test/query-test-utils";
import userEvent from "@testing-library/user-event";
import { TransactionFormModal } from "@/components/transactions/TransactionFormModal";
import { ToastProvider } from "@monqom/ui/toast";

vi.mock("@/lib/api", () => ({
  default: { post: vi.fn(), put: vi.fn() },
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
      <ToastProvider>
        <TransactionFormModal
          open
          mode="create"
          workspaceId="ws-1"
          onClose={onClose}
          onSaved={vi.fn()}
        />
      </ToastProvider>,
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
      <ToastProvider>
        <TransactionFormModal
          open
          mode="create"
          workspaceId="ws-1"
          onClose={onClose}
          onSaved={vi.fn()}
        />
      </ToastProvider>,
    );

    await user.click(screen.getByLabelText("Amount"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("tabs through the required fields before the defaulted fields", async () => {
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

    expect(screen.getByLabelText("Amount")).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText("Description")).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: /pick category/i }),
    ).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: /today.*cash/i })).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.tab();
    expect(screen.getByLabelText("Date")).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText("Account or wallet")).toHaveFocus();
  });
  it.each([
    ["12000", "120.00", 120],
    ["1619", "16.19", 16.19],
  ])(
    "treats typed digits %s as minor currency units",
    async (digits, displayed, amount) => {
      const user = userEvent.setup();
      render(
        <ToastProvider>
          <TransactionFormModal
            open
            mode="create"
            workspaceId="ws-1"
            onClose={vi.fn()}
            onSaved={vi.fn()}
          />
        </ToastProvider>,
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
      expect(mockApi.post.mock.calls[0]?.[1]).toMatchObject({ amount });
    },
  );

  it("sends the selected income type when creating a transaction", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TransactionFormModal
          open
          mode="create"
          workspaceId="ws-1"
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </ToastProvider>,
    );

    await user.click(screen.getByRole("tab", { name: "Income" }));
    await user.type(screen.getByLabelText("Amount"), "250000");
    await user.type(screen.getByLabelText("Description"), "Salary");
    await user.click(screen.getByRole("button", { name: /pick category/i }));
    await user.click(screen.getByRole("button", { name: /save transaction/i }));

    await waitFor(() => expect(mockApi.post).toHaveBeenCalledTimes(1));
    expect(mockApi.post.mock.calls[0]?.[1]).toMatchObject({
      type: "income",
      amount: 2500,
    });
  });
  it.each([
    ["Expense", "Income"],
    ["Income", "Expense"],
  ])(
    "requires a new category after switching from %s to %s",
    async (initial, next) => {
      const user = userEvent.setup();
      render(
        <ToastProvider>
          <TransactionFormModal
            open
            mode="create"
            workspaceId="ws-1"
            onClose={vi.fn()}
            onSaved={vi.fn()}
          />
        </ToastProvider>,
      );
      await user.click(screen.getByRole("tab", { name: initial }));
      await user.type(screen.getByLabelText("Amount"), "1000");
      await user.type(screen.getByLabelText("Description"), "Example");
      await user.click(screen.getByRole("button", { name: /pick category/i }));
      await user.click(screen.getByRole("tab", { name: next }));
      await user.click(
        screen.getByRole("button", { name: /save transaction/i }),
      );
      expect(screen.getByText("Category is required.")).toBeInTheDocument();
      expect(mockApi.post).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: /pick category/i }));
      await user.click(
        screen.getByRole("button", { name: /save transaction/i }),
      );
      await waitFor(() => expect(mockApi.post).toHaveBeenCalledTimes(1));
      expect(mockApi.post.mock.calls[0]?.[1]).toMatchObject({
        type: next.toLowerCase(),
        category_id: "cat-1",
      });
    },
  );

  it("uses workspace currency, local today and the user's last payment source", async () => {
    const user = userEvent.setup();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    render(
      <ToastProvider>
        <TransactionFormModal
          open
          mode="create"
          workspaceId="ws-1"
          defaultCurrency="PLN"
          defaultPaymentSourceId="ps-2"
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: /today.*card/i }));
    expect(screen.getByLabelText("Date")).toHaveValue(today);
    await waitFor(() =>
      expect(screen.getByLabelText("Account or wallet")).toHaveValue("ps-2"),
    );
    await user.type(screen.getByLabelText("Amount"), "1234");
    await user.type(screen.getByLabelText("Description"), "Team lunch");
    await user.click(screen.getByRole("button", { name: /pick category/i }));
    expect(screen.getByLabelText("Currency")).toHaveValue("PLN");
    expect(screen.queryByText("Tags")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save transaction/i }));

    await waitFor(() => expect(mockApi.post).toHaveBeenCalledTimes(1));
    expect(mockApi.post.mock.calls[0]?.[1]).toMatchObject({
      amount: 12.34,
      currency: "PLN",
      date: today,
      description: "Team lunch",
      category_id: "cat-1",
      payment_source_id: "ps-2",
      tags: [],
    });
  });

  it("lets the user change the date and payment source and saves them", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TransactionFormModal
          open
          mode="create"
          workspaceId="ws-1"
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: /today.*cash/i }));
    await user.clear(screen.getByLabelText("Date"));
    await user.type(screen.getByLabelText("Date"), "2026-10-15");
    await user.selectOptions(
      screen.getByLabelText("Account or wallet"),
      "ps-2",
    );
    await user.click(screen.getByRole("button", { name: /card/i }));
    await user.type(screen.getByLabelText("Amount"), "2500");
    await user.type(screen.getByLabelText("Description"), "Lunch");
    await user.click(screen.getByRole("button", { name: /pick category/i }));
    await user.click(screen.getByRole("button", { name: /save transaction/i }));

    await waitFor(() => expect(mockApi.post).toHaveBeenCalledTimes(1));
    expect(mockApi.post.mock.calls[0]?.[1]).toMatchObject({
      date: "2026-10-15",
      payment_source_id: "ps-2",
    });
  });

  it("opens account creation from the source list and preserves the selection when cancelled", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TransactionFormModal
          open
          mode="create"
          workspaceId="ws-1"
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: /today.*cash/i }));
    const source = screen.getByLabelText("Account or wallet");
    expect(source).toHaveValue("ps-1");
    await user.selectOptions(source, "__create_payment_source__");
    expect(
      screen.getByRole("dialog", { name: "Add payment source" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(source).toHaveValue("ps-1");
  });

  it("prefills and updates transaction in edit mode", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
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
        />
      </ToastProvider>,
    );

    expect(screen.getByLabelText("Amount")).toHaveValue("20.50");
    expect(screen.getByLabelText("Description")).toHaveValue("Team lunch");
    expect(
      screen.getByRole("button", { name: /transaction details/i }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText("Notes")).toHaveValue("Lunch");
    expect(
      screen.getByLabelText("Notes").closest("#transaction-default-details"),
    ).toHaveClass("hidden");
    expect(screen.queryByText("Food")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Amount"));
    await user.type(screen.getByLabelText("Amount"), "1999");
    await user.click(screen.getByRole("button", { name: /save transaction/i }));

    await waitFor(() => expect(mockApi.put).toHaveBeenCalledTimes(1));
    expect(mockApi.put.mock.calls[0]?.[0]).toBe(
      "/workspaces/ws-1/transactions/tx-1",
    );
    expect(mockApi.put.mock.calls[0]?.[1]).toMatchObject({
      amount: 19.99,
      notes: "Lunch",
      currency: "PLN",
      tags: ["Food"],
    });
  });

  it("does not save an edit when existing tags were not loaded", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TransactionFormModal
          open
          mode="edit"
          workspaceId="ws-1"
          transaction={{
            id: "tx-missing-tags",
            amount: 20,
            currency: "PLN",
            date: "2026-04-20",
            description: "Lunch",
            workspaceId: "ws-1",
            categoryId: "cat-1",
            notes: null,
            tags: undefined as unknown as string[],
            paymentSourceId: "ps-1",
            type: "expense",
            createdAt: "2026-04-20",
            updatedAt: "2026-04-20",
          }}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: /save transaction/i }));
    expect(mockApi.put).not.toHaveBeenCalled();
    expect(
      screen.getByText("Failed to load transaction details."),
    ).toBeInTheDocument();
  });

  it("submits the form with Ctrl+Enter keyboard shortcut", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <ToastProvider>
        <TransactionFormModal
          open
          mode="create"
          workspaceId="ws-1"
          onClose={vi.fn()}
          onSaved={onSaved}
        />
      </ToastProvider>,
    );

    await user.type(screen.getByLabelText("Amount"), "4550");
    await user.type(screen.getByLabelText("Description"), "Lunch");
    await user.click(screen.getByRole("button", { name: /pick category/i }));

    // Press Ctrl+Enter while focused on description
    await user.type(
      screen.getByLabelText("Description"),
      "{Control>}{Enter}{/Control}",
    );

    await waitFor(() => expect(mockApi.post).toHaveBeenCalledTimes(1));
    expect(mockApi.post.mock.calls[0]?.[0]).toBe(
      "/workspaces/ws-1/transactions",
    );
    expect(mockApi.post.mock.calls[0]?.[1]).toMatchObject({
      amount: 45.5,
      description: "Lunch",
      category_id: "cat-1",
    });
  });
});
