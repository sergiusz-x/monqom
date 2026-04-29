import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TransactionsPage from "@/pages/TransactionsPage";
import TransactionDetailPage from "@/pages/TransactionDetailPage";
import type {
  TransactionFilters,
  TransactionsResponse,
} from "@/types/transaction";

vi.mock("@/hooks/useWorkspace", () => ({ useWorkspace: vi.fn() }));
vi.mock("@/hooks/useCategories", () => ({ useCategories: vi.fn() }));
vi.mock("@/hooks/usePaymentSources", () => ({ usePaymentSources: vi.fn() }));
vi.mock("@/hooks/useTags", () => ({ useTags: vi.fn() }));
vi.mock("@/hooks/useTransactions", () => ({ useTransactions: vi.fn() }));

import { useWorkspace } from "@/hooks/useWorkspace";
import { useCategories } from "@/hooks/useCategories";
import { usePaymentSources } from "@/hooks/usePaymentSources";
import { useTags } from "@/hooks/useTags";
import { useTransactions } from "@/hooks/useTransactions";

const mockUseWorkspace = useWorkspace as ReturnType<typeof vi.fn>;
const mockUseCategories = useCategories as ReturnType<typeof vi.fn>;
const mockUsePaymentSources = usePaymentSources as ReturnType<typeof vi.fn>;
const mockUseTags = useTags as ReturnType<typeof vi.fn>;
const mockUseTransactions = useTransactions as ReturnType<typeof vi.fn>;

function makeResponse(
  overrides: Partial<TransactionsResponse> = {},
): TransactionsResponse {
  return {
    data: [
      {
        id: "tx-1",
        workspace_id: "ws-1",
        category_id: "cat-1",
        payment_source_id: "src-1",
        type: "expense",
        amount: 20.5,
        currency: "USD",
        date: "2026-04-20T00:00:00.000Z",
        notes: "Lunch",
        tags: ["Food"],
        created_at: "2026-04-20T00:00:00.000Z",
        updated_at: "2026-04-20T00:00:00.000Z",
      },
    ],
    total: 40,
    limit: 20,
    offset: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  mockUseWorkspace.mockReturnValue({
    workspaceId: "ws-1",
    isLoading: false,
    error: null,
  });
  mockUseCategories.mockReturnValue({
    categories: [{ id: "cat-1", name: "Food", children: [] }],
    isLoading: false,
    error: null,
  });
  mockUsePaymentSources.mockReturnValue({
    paymentSources: [{ id: "src-1", name: "Cash Wallet" }],
    isLoading: false,
    error: null,
  });
  mockUseTags.mockReturnValue({
    tags: ["Food"],
    isLoading: false,
    error: null,
  });
  mockUseTransactions.mockReturnValue({
    data: makeResponse(),
    isLoading: false,
    error: null,
  });
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/transactions"]}>
      <Routes>
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route
          path="/transactions/:transactionId"
          element={<TransactionDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TransactionsPage", () => {
  it("renders desktop table and mobile cards layouts", () => {
    renderPage();

    expect(screen.getByTestId("transaction-table").className).toContain(
      "hidden",
    );
    expect(screen.getByTestId("transaction-table").className).toContain(
      "md:block",
    );
    expect(screen.getByTestId("transaction-cards").className).toContain(
      "md:hidden",
    );
  });

  it("shows loading skeleton while fetching", () => {
    mockUseTransactions.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });
    renderPage();

    expect(
      screen.getByRole("status", { name: "Loading transactions" }),
    ).toBeInTheDocument();
  });

  it("shows empty state when transactions do not exist", () => {
    mockUseTransactions.mockReturnValue({
      data: makeResponse({ data: [], total: 0 }),
      isLoading: false,
      error: null,
    });
    renderPage();

    expect(
      screen.getByText("No transactions yet. Add your first expense."),
    ).toBeInTheDocument();
  });

  it("passes selected filters and resets offset to 0", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(screen.getByLabelText("Category"), "cat-1");

    const latestCall = mockUseTransactions.mock.calls.at(-1) as [
      string,
      TransactionFilters,
      number,
      number,
    ];
    expect(latestCall[1].categoryId).toBe("cat-1");
    expect(latestCall[3]).toBe(0);
  });

  it("supports next page pagination", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Next" }));

    const latestCall = mockUseTransactions.mock.calls.at(-1) as [
      string,
      TransactionFilters,
      number,
      number,
    ];
    expect(latestCall[3]).toBe(20);
  });

  it("disables previous button on the first page", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled();
  });

  it("disables next button on the last page", () => {
    mockUseTransactions.mockReturnValue({
      data: makeResponse({ total: 20, limit: 20, offset: 0 }),
      isLoading: false,
      error: null,
    });
    renderPage();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("opens transaction detail route when desktop row is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    const notesCell = screen
      .getAllByText("Lunch")
      .find((el) => el.tagName === "TD");
    expect(notesCell).toBeDefined();
    const row = notesCell!.closest("tr");
    expect(row).not.toBeNull();

    await user.click(row as HTMLTableRowElement);
    expect(
      screen.getByRole("heading", { name: /transaction details/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/transaction id: tx-1/i)).toBeInTheDocument();
  });

  it("shows validation message for invalid date range and avoids transaction fetch", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("Date from"), "2026-04-20");
    await user.type(screen.getByLabelText("Date to"), "2026-04-19");

    expect(
      screen.getByText("Date from must be earlier than or equal to date to."),
    ).toBeInTheDocument();

    const latestCall = mockUseTransactions.mock.calls.at(-1) as [
      string,
      TransactionFilters,
      number,
      number,
    ];
    expect(latestCall[0]).toBe("");
  });
});
