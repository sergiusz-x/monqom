import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithQueryClient as render } from "@/test/query-test-utils";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import TransactionsPage from "@/pages/TransactionsPage";
import { ToastProvider } from "@/contexts/ToastContext";
import type {
  TransactionFilters,
  TransactionsPage as TransactionsPageData,
} from "@/types/transaction";

vi.mock("@/hooks/useWorkspace", () => ({ useWorkspace: vi.fn() }));
vi.mock("@/hooks/useCategories", () => ({ useCategories: vi.fn() }));
vi.mock("@/hooks/usePaymentSources", () => ({ usePaymentSources: vi.fn() }));
vi.mock("@/hooks/useTags", () => ({ useTags: vi.fn() }));
vi.mock("@/hooks/useTransactions", () => ({ useTransactions: vi.fn() }));
vi.mock("@/lib/api", () => ({
  default: { delete: vi.fn() },
}));
vi.mock("@/components/transactions/TransactionFormModal", () => ({
  TransactionFormModal: ({
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
  }) =>
    open ? (
      <div role="dialog" aria-label="Edit transaction">
        Edit modal
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    ) : null,
}));

import { useWorkspace } from "@/hooks/useWorkspace";
import { useCategories } from "@/hooks/useCategories";
import { usePaymentSources } from "@/hooks/usePaymentSources";
import { useTags } from "@/hooks/useTags";
import { useTransactions } from "@/hooks/useTransactions";
import api from "@/lib/api";

const mockUseWorkspace = useWorkspace as ReturnType<typeof vi.fn>;
const patchWorkspace = vi.fn();
const mockUseCategories = useCategories as ReturnType<typeof vi.fn>;
const mockUsePaymentSources = usePaymentSources as ReturnType<typeof vi.fn>;
const mockUseTags = useTags as ReturnType<typeof vi.fn>;
const mockUseTransactions = useTransactions as ReturnType<typeof vi.fn>;
const mockApi = api as unknown as {
  delete: ReturnType<typeof vi.fn>;
};

function makeResponse(
  overrides: Partial<TransactionsPageData> = {},
): TransactionsPageData {
  return {
    data: [
      {
        id: "tx-1",
        workspaceId: "ws-1",
        categoryId: "cat-1",
        paymentSourceId: "src-1",
        type: "expense",
        amount: 20.5,
        currency: "USD",
        date: "2026-04-20T00:00:00.000Z",
        description: "Team lunch",
        notes: "Lunch",
        tags: ["Food"],
        createdAt: "2026-04-20T00:00:00.000Z",
        updatedAt: "2026-04-20T00:00:00.000Z",
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
  window.localStorage.clear();

  mockUseWorkspace.mockReturnValue({
    workspaceId: "ws-1",
    isLoading: false,
    error: null,
    patchWorkspace,
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

function HistoryControls() {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate(-1)}>
        History back
      </button>
      <button type="button" onClick={() => navigate(1)}>
        History forward
      </button>
    </>
  );
}

function renderPage(initialEntry = "/transactions") {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <HistoryControls />
        <Routes>
          <Route path="/transactions" element={<TransactionsPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

async function waitForPreferenceHydration() {
  await waitFor(() => {
    expect(
      window.localStorage.getItem(
        "monqom:transaction-list-preferences:v1:ws-1",
      ),
    ).not.toBeNull();
  });
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
    await waitForPreferenceHydration();

    screen.getByRole("button", { name: "All categories" }).focus();
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Food" }));

    const latestCall = mockUseTransactions.mock.calls.at(-1) as [
      string,
      TransactionFilters,
      number,
      number,
    ];
    expect(latestCall[1].categoryIds).toEqual(["cat-1"]);
    expect(latestCall[3]).toBe(0);
  });

  it("allows selecting multiple categories", async () => {
    const user = userEvent.setup();
    mockUseCategories.mockReturnValue({
      categories: [
        { id: "cat-1", name: "Food", children: [] },
        { id: "cat-2", name: "Transport", children: [] },
      ],
      isLoading: false,
      error: null,
    });
    renderPage();
    await waitForPreferenceHydration();

    screen.getByRole("button", { name: "All categories" }).focus();
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Food" }));
    await user.click(
      screen.getByRole("menuitemcheckbox", { name: "Transport" }),
    );

    const latestCall = mockUseTransactions.mock.calls.at(-1) as [
      string,
      TransactionFilters,
      number,
      number,
    ];
    expect(latestCall[1].categoryIds).toEqual(["cat-1", "cat-2"]);
  });

  it("selects tags only from existing workspace tags", async () => {
    const user = userEvent.setup();
    renderPage();

    const tagFilter = screen.getByLabelText("Tags");
    expect(tagFilter).toHaveProperty("tagName", "SELECT");
    await user.selectOptions(tagFilter, "Food");

    const latestCall = mockUseTransactions.mock.calls.at(-1) as [
      string,
      TransactionFilters,
      number,
      number,
    ];
    expect(latestCall[1].tag).toBe("Food");
  });
  it("prefills filters from query params", () => {
    renderPage(
      "/transactions?category_id=cat-1&date_from=2026-04-01&date_to=2026-04-30",
    );

    const latestCall = mockUseTransactions.mock.calls.at(-1) as [
      string,
      TransactionFilters,
      number,
      number,
    ];
    expect(latestCall[1].categoryIds).toEqual(["cat-1"]);
    expect(latestCall[1].dateFrom).toBe("2026-04-01");
    expect(latestCall[1].dateTo).toBe("2026-04-30");
  });

  it("restores the last filters and sorting for the current workspace", async () => {
    window.localStorage.setItem(
      "monqom:transaction-filters:ws-1",
      JSON.stringify({
        categoryIds: ["cat-1"],
        tag: "Food",
        paymentSourceId: "src-1",
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
        sortBy: "amount",
        sortDirection: "asc",
      }),
    );

    renderPage();

    await waitFor(() => {
      const latestCall = mockUseTransactions.mock.calls.at(-1) as [
        string,
        TransactionFilters,
        number,
        number,
      ];
      expect(latestCall[1]).toMatchObject({
        categoryIds: ["cat-1"],
        tag: "Food",
        paymentSourceId: "src-1",
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
        sortBy: "amount",
        sortDirection: "asc",
      });
    });
  });

  it("sorts the table by a selected column", async () => {
    const user = userEvent.setup();
    renderPage();

    const sortButton = screen.getByRole("button", { name: "Amount" });
    expect(sortButton).toHaveClass("cursor-pointer");
    await user.click(sortButton);

    const latestCall = mockUseTransactions.mock.calls.at(-1) as [
      string,
      TransactionFilters,
      number,
      number,
    ];
    expect(latestCall[1].sortBy).toBe("amount");
    expect(latestCall[1].sortDirection).toBe("asc");
  });

  it("restores URL-backed sorting through browser back and forward", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Amount" }));
    expect(
      (mockUseTransactions.mock.calls.at(-1) as [string, TransactionFilters])[1]
        .sortBy,
    ).toBe("amount");

    await user.click(screen.getByRole("button", { name: "History back" }));
    await waitFor(() => {
      expect(
        (
          mockUseTransactions.mock.calls.at(-1) as [string, TransactionFilters]
        )[1].sortBy,
      ).toBe("date");
    });

    await user.click(screen.getByRole("button", { name: "History forward" }));
    await waitFor(() => {
      expect(
        (
          mockUseTransactions.mock.calls.at(-1) as [string, TransactionFilters]
        )[1].sortBy,
      ).toBe("amount");
    });
  });

  it("sets the current month date range with one click", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "This month" }));

    const now = new Date();
    const expectedPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const latestCall = mockUseTransactions.mock.calls.at(-1) as [
      string,
      TransactionFilters,
      number,
      number,
    ];
    expect(latestCall[1].dateFrom).toBe(`${expectedPrefix}-01`);
    expect(latestCall[1].dateTo).toMatch(new RegExp(`^${expectedPrefix}-`));
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

  it("opens transaction details before editing", async () => {
    const user = userEvent.setup();
    renderPage();

    const descriptionCell = screen
      .getAllByText("Team lunch")
      .find((element) => element.tagName === "TD");
    const row = descriptionCell?.closest("tr");
    expect(row).not.toBeNull();

    await user.click(row as HTMLTableRowElement);

    const detailsDialog = screen.getByRole("dialog", {
      name: "Transaction details",
    });
    expect(detailsDialog).toHaveTextContent("Food");
    expect(detailsDialog).toHaveTextContent("$20.50");
    expect(detailsDialog).toHaveTextContent("Cash Wallet");
    expect(detailsDialog).toHaveTextContent("Lunch");

    const actionsButton = screen.getByRole("button", {
      name: "Transaction actions",
    });
    actionsButton.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("menuitem", { name: "Edit" }),
    ).not.toBeInTheDocument();
    expect(actionsButton).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));

    expect(
      screen.getByRole("dialog", { name: "Edit transaction" }),
    ).toBeInTheDocument();
  });

  it("returns to transaction details after cancelling edit", async () => {
    const user = userEvent.setup();
    renderPage();

    const descriptionCell = screen
      .getAllByText("Team lunch")
      .find((element) => element.tagName === "TD");
    await user.click(descriptionCell!.closest("tr") as HTMLTableRowElement);
    screen.getByRole("button", { name: "Transaction actions" }).focus();
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.getByRole("dialog", { name: "Transaction details" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Edit transaction" }),
    ).not.toBeInTheDocument();
  });
  it("deletes a transaction after confirmation", async () => {
    const user = userEvent.setup();
    mockApi.delete.mockResolvedValueOnce({ data: undefined });
    renderPage();

    const descriptionCell = screen
      .getAllByText("Team lunch")
      .find((element) => element.tagName === "TD");
    await user.click(descriptionCell!.closest("tr") as HTMLTableRowElement);
    screen.getByRole("button", { name: "Transaction actions" }).focus();
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(screen.getByText("Delete this transaction?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(mockApi.delete).toHaveBeenCalledWith(
        "/workspaces/ws-1/transactions/tx-1",
      );
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Transaction deleted.",
    );
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
