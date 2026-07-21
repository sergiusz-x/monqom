import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithQueryClient as render } from "@/test/query-test-utils";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TransactionDetailPage from "@/pages/TransactionDetailPage";

vi.mock("@/hooks/useWorkspace", () => ({
  useWorkspace: () => ({
    workspaceId: "ws-1",
    workspace: {
      id: "ws-1",
      name: "Household",
      timezone: "Europe/Warsaw",
      baseCurrency: "PLN",
      lastPaymentSourceId: "cash-1",
      baseCurrencyLocked: true,
    },
    isLoading: false,
    error: null,
    patchWorkspace: vi.fn(),
  }),
}));
vi.mock("@/hooks/useCategories", () => ({
  useCategories: () => ({
    categories: [
      {
        id: "food",
        name: "Food",
        systemKey: null,
        icon: null,
        parentId: null,
        sortOrder: 0,
        children: [],
      },
    ],
  }),
}));
vi.mock("@/hooks/usePaymentSources", () => ({
  usePaymentSources: () => ({
    paymentSources: [{ id: "cash-1", name: "Wallet", systemKey: null }],
  }),
}));
vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock("@/components/transactions/TransactionFormModal", () => ({
  TransactionFormModal: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">Edit transaction form</div> : null,
}));
vi.mock("@/lib/api", () => ({
  default: { get: vi.fn(), delete: vi.fn() },
}));

import api from "@/lib/api";

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const transaction = {
  id: "tx-1",
  workspace_id: "ws-1",
  category_id: "food",
  payment_source_id: "cash-1",
  type: "expense" as const,
  amount: 42.5,
  currency: "PLN",
  date: "2026-07-19T00:00:00.000Z",
  description: "Weekly groceries",
  notes: "Local market",
  tags: ["home"],
  created_at: "2026-07-19T10:00:00.000Z",
  updated_at: "2026-07-19T10:00:00.000Z",
};

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/transactions/tx-1"]}>
      <Routes>
        <Route
          path="/transactions/:transactionId"
          element={<TransactionDetailPage />}
        />
        <Route path="/transactions" element={<div>Transaction list</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TransactionDetailPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads and renders complete transaction details", async () => {
    mockApi.get.mockResolvedValueOnce({ data: transaction });
    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading transaction details",
    );
    expect(
      await screen.findByRole("heading", { name: "Weekly groceries" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Food")).toBeInTheDocument();
    expect(screen.getByText("Wallet")).toBeInTheDocument();
    expect(screen.getByText("Local market")).toBeInTheDocument();
    expect(screen.getByText("home")).toBeInTheDocument();
    expect(mockApi.get).toHaveBeenCalledWith(
      "/workspaces/ws-1/transactions/tx-1",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("renders a dedicated not-found state", async () => {
    mockApi.get.mockRejectedValueOnce({ response: { status: 404 } });
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Transaction not found" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to transactions" }),
    ).toHaveAttribute("href", "/transactions");
  });

  it("supports editing and confirmed deletion", async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValueOnce({ data: transaction });
    mockApi.delete.mockResolvedValueOnce({});
    renderPage();
    await screen.findByRole("heading", { name: "Weekly groceries" });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Edit transaction form",
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Delete this transaction?")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!);

    await waitFor(() =>
      expect(mockApi.delete).toHaveBeenCalledWith(
        "/workspaces/ws-1/transactions/tx-1",
      ),
    );
    expect(await screen.findByText("Transaction list")).toBeInTheDocument();
  });
});
