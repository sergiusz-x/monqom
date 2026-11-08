import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { renderWithQueryClient as render } from "@/test/query-test-utils";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router";
import TransactionsPage from "@/pages/TransactionsPage";

import type {
  TransactionFilters,
  TransactionsPage as TransactionsPageData,
} from "@/types/transaction";

vi.mock("@/hooks/useWorkspace", () => ({ useWorkspace: vi.fn() }));
vi.mock("@/hooks/useCategories", () => ({ useCategories: vi.fn() }));
vi.mock("@/hooks/usePaymentSources", () => ({ usePaymentSources: vi.fn() }));
vi.mock("@/hooks/useTransactions", () => ({ useTransactions: vi.fn() }));
vi.mock("@/lib/api", () => ({
  default: { delete: vi.fn(), patch: vi.fn() },
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
import { useTransactions } from "@/hooks/useTransactions";
import api from "@/lib/api";
import { ToastProvider } from "@monqom/ui";

const mockUseWorkspace = useWorkspace as ReturnType<typeof vi.fn>;
const patchWorkspace = vi.fn();
const mockUseCategories = useCategories as ReturnType<typeof vi.fn>;
const mockUsePaymentSources = usePaymentSources as ReturnType<typeof vi.fn>;
const mockUseTransactions = useTransactions as ReturnType<typeof vi.fn>;
const mockApi = api as unknown as {
  delete: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
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
    categories: [{ id: "cat-1", name: "Food", icon: "🍔", children: [] }],
    isLoading: false,
    error: null,
  });
  mockUsePaymentSources.mockReturnValue({
    paymentSources: [{ id: "src-1", name: "Cash Wallet" }],
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

  it("searches across the list and resets pagination", async () => {
    const user = userEvent.setup();
    renderPage("/transactions?page=2");
    await waitForPreferenceHydration();
    await user.type(
      screen.getByRole("searchbox", { name: "Search transactions" }),
      "team lunch",
    );
    await waitFor(() => {
      const call = mockUseTransactions.mock.calls.at(-1) as [
        string,
        TransactionFilters,
        number,
        number,
      ];
      expect(call[1].search).toBe("team lunch");
      expect(call[3]).toBe(0);
    });
  });

  it("clears filters from the empty results state", async () => {
    const user = userEvent.setup();
    mockUseTransactions.mockReturnValue({
      data: makeResponse({ data: [], total: 0 }),
      isLoading: false,
      error: null,
    });
    renderPage("/transactions?search=missing");
    await waitForPreferenceHydration();
    expect(
      screen.getByText("No transactions match your filters"),
    ).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Clear" }).at(-1)!);
    await waitFor(() =>
      expect(
        screen.getByText("No transactions yet. Add your first expense."),
      ).toBeInTheDocument(),
    );
  });

  it("sorts on mobile and opens a transaction from its entire card", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForPreferenceHydration();
    await user.selectOptions(screen.getByLabelText("Sort"), "amount:desc");
    expect(
      (
        mockUseTransactions.mock.calls.at(-1) as [string, TransactionFilters]
      )[1],
    ).toMatchObject({ sortBy: "amount", sortDirection: "desc" });
    await user.click(
      screen.getByRole("button", { name: /Team lunch.*Cash Wallet/ }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
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
    await user.click(
      screen.getByRole("button", { name: "Food", pressed: false }),
    );

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
    await user.click(
      screen.getByRole("button", { name: "Food", pressed: false }),
    );
    await user.click(
      screen.getByRole("button", { name: "Transport", pressed: false }),
    );

    const latestCall = mockUseTransactions.mock.calls.at(-1) as [
      string,
      TransactionFilters,
      number,
      number,
    ];
    expect(latestCall[1].categoryIds).toEqual(["cat-1", "cat-2"]);
  });

  it("does not show the tag filter or apply a legacy tag URL", async () => {
    const user = userEvent.setup();
    renderPage("/transactions?tag=Food");
    await waitForPreferenceHydration();
    await user.click(screen.getByRole("button", { name: "More filters" }));
    expect(screen.queryByLabelText("Tags")).not.toBeInTheDocument();
    const latestCall = mockUseTransactions.mock.calls.at(-1) as [
      string,
      TransactionFilters,
      number,
      number,
    ];
    expect(latestCall[1]).not.toHaveProperty("tag");
  });
  it("keeps an advanced filter visible and removable when its controls are collapsed", async () => {
    const user = userEvent.setup();
    renderPage();
    const toggle = screen.getByRole("button", { name: "More filters" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Added by")).not.toBeInTheDocument();
    await user.click(toggle);
    await user.selectOptions(screen.getByLabelText("Added by"), "manual");
    await user.click(toggle);
    expect(screen.queryByLabelText("Added by")).not.toBeInTheDocument();
    expect(
      (mockUseTransactions.mock.calls.at(-1) as [string, TransactionFilters])[1]
        .origin,
    ).toBe("manual");
    await user.click(
      screen.getByRole("button", { name: "Remove filter: Added manually" }),
    );
    expect(
      (mockUseTransactions.mock.calls.at(-1) as [string, TransactionFilters])[1]
        .origin,
    ).toBeUndefined();
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
      .find((element) => element.closest("td"));
    const row = descriptionCell?.closest("tr");
    expect(row).not.toBeNull();

    await user.click(row as HTMLTableRowElement);

    const detailsDialog = screen.getByRole("dialog", {
      name: "Transaction details",
    });
    expect(detailsDialog).toHaveTextContent("🍔");
    expect(detailsDialog).toHaveTextContent("Food");
    expect(detailsDialog).toHaveTextContent("Account or wallet");
    expect(detailsDialog).toHaveTextContent("$20.50");
    expect(detailsDialog).toHaveTextContent("Cash Wallet");
    expect(detailsDialog).toHaveTextContent("Lunch");

    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(
      screen.getByRole("dialog", { name: "Edit transaction" }),
    ).toBeInTheDocument();
  });

  it("hides the notes section when no note was added", async () => {
    const user = userEvent.setup();
    const response = makeResponse();
    response.data[0] = { ...response.data[0]!, notes: null };
    mockUseTransactions.mockReturnValue({
      data: response,
      isLoading: false,
      error: null,
    });
    renderPage();
    const description = screen
      .getAllByText("Team lunch")
      .find((element) => element.closest("td"));
    await user.click(description!.closest("tr")!);
    const dialog = screen.getByRole("dialog", { name: "Transaction details" });
    expect(dialog).not.toHaveTextContent("Notes");
    expect(dialog).not.toHaveTextContent("No notes");
  });

  it.each(["expense", "income"] as const)(
    "assigns a category inline for an uncategorized %s",
    async (type) => {
      const user = userEvent.setup();
      const response = makeResponse();
      response.data[0] = {
        ...response.data[0]!,
        type,
        categoryId: null,
        integrationId: "bank-sync",
        integrationName: "Bank sync",
      };
      mockUseTransactions.mockReturnValue({
        data: response,
        isLoading: false,
        error: null,
      });
      mockApi.patch.mockResolvedValueOnce({ data: undefined });
      renderPage();
      const description = screen
        .getAllByText("Team lunch")
        .find((element) => element.closest("td"));
      await user.click(description!.closest("tr")!);
      expect(
        screen.getByRole("dialog", { name: "Transaction details" }),
      ).not.toHaveTextContent("Uncategorized");
      await user.click(screen.getByRole("button", { name: "Assign category" }));
      expect(
        screen.getByRole("listbox", { name: "Categories" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("dialog", { name: "Edit transaction" }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
      await user.click(screen.getByRole("option", { name: /Food/ }));
      expect(mockUseCategories).toHaveBeenCalledWith("ws-1", false, type);
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() =>
        expect(mockApi.patch).toHaveBeenCalledWith(
          "/workspaces/ws-1/transactions/tx-1/category",
          { category_id: "cat-1" },
        ),
      );
      await waitFor(() =>
        expect(
          screen.getByRole("dialog", { name: "Transaction details" }),
        ).not.toHaveTextContent("Needs a category"),
      );
      expect(
        screen.getByRole("dialog", { name: "Transaction details" }),
      ).toHaveTextContent("Food");
    },
  );

  it("allows cancelling category assignment and reports save errors", async () => {
    const user = userEvent.setup();
    const response = makeResponse();
    response.data[0] = { ...response.data[0]!, categoryId: null };
    mockUseTransactions.mockReturnValue({
      data: response,
      isLoading: false,
      error: null,
    });
    mockApi.patch.mockRejectedValueOnce(new Error("failed"));
    renderPage();
    const description = screen
      .getAllByText("Team lunch")
      .find((element) => element.closest("td"));
    await user.click(description!.closest("tr")!);
    await user.click(screen.getByRole("button", { name: "Assign category" }));
    await user.click(screen.getByRole("option", { name: /Food/ }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText(
        "Could not assign the category. Please try again.",
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.getByRole("button", { name: "Assign category" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "Transaction details" }),
    ).toHaveTextContent("Needs a category");
  });

  it("returns to transaction details after cancelling edit", async () => {
    const user = userEvent.setup();
    renderPage();

    const descriptionCell = screen
      .getAllByText("Team lunch")
      .find((element) => element.closest("td"));
    await user.click(descriptionCell!.closest("tr") as HTMLTableRowElement);
    await user.click(screen.getByRole("button", { name: "Edit" }));
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
      .find((element) => element.closest("td"));
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

    await user.click(screen.getByRole("button", { name: "More filters" }));
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

describe("transaction filters", () => {
  it("shows grouped searchable categories and retains compatible choices when changing type", async () => {
    const user = userEvent.setup();
    mockUseCategories.mockImplementation(
      (_workspace: string, _archived: boolean, type: string) => ({
        categories:
          type === "expense"
            ? [
                {
                  id: "food",
                  name: "Food",
                  icon: "🍔",
                  type: "expense",
                  children: [
                    {
                      id: "groceries",
                      name: "Groceries",
                      icon: "🛒",
                      type: "expense",
                      children: [],
                    },
                  ],
                },
              ]
            : [
                {
                  id: "salary",
                  name: "Salary",
                  icon: "💼",
                  type: "income",
                  children: [],
                },
              ],
        isLoading: false,
        error: null,
      }),
    );
    renderPage();
    await waitForPreferenceHydration();
    await user.click(screen.getByRole("button", { name: "All categories" }));
    await user.type(
      screen.getByRole("searchbox", { name: "Search categories" }),
      "grocer",
    );
    expect(
      screen.getByRole("button", { name: /Groceries/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Food/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Salary/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Groceries/ }));
    await user.keyboard("{Escape}");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Type" }),
      "expense",
    );
    await waitFor(() =>
      expect(
        (
          mockUseTransactions.mock.calls.at(-1) as [string, TransactionFilters]
        )[1].categoryIds,
      ).toEqual(["groceries"]),
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Type" }),
      "income",
    );
    await waitFor(() =>
      expect(
        (
          mockUseTransactions.mock.calls.at(-1) as [string, TransactionFilters]
        )[1].categoryIds,
      ).toEqual([]),
    );
  });

  it("displays active filters individually and supports date presets", async () => {
    const user = userEvent.setup();
    renderPage(
      "/transactions?type=expense&search=lunch&category_status=uncategorized",
    );
    await waitForPreferenceHydration();
    expect(
      screen.getByRole("button", { name: "Remove filter: lunch" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove filter: Expense" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Remove filter: Without category" }),
    );
    await waitFor(() =>
      expect(
        (
          mockUseTransactions.mock.calls.at(-1) as [string, TransactionFilters]
        )[1].uncategorized,
      ).toBeUndefined(),
    );
    await user.click(screen.getByRole("button", { name: /More filters/ }));
    await user.click(screen.getByRole("button", { name: "Last 30 days" }));
    await waitFor(() =>
      expect(
        (
          mockUseTransactions.mock.calls.at(-1) as [string, TransactionFilters]
        )[1].dateFrom,
      ).toMatch(/^\d{4}-\d{2}-\d{2}$/),
    );
  });
});

describe("category in transaction lists", () => {
  it("shows the category icon and hierarchy in both layouts", () => {
    mockUseCategories.mockReturnValue({
      categories: [
        {
          id: "parent",
          name: "Food",
          icon: "🍔",
          children: [
            { id: "cat-1", name: "Groceries", icon: "🛒", children: [] },
          ],
        },
      ],
      isLoading: false,
      error: null,
    });
    renderPage();
    for (const list of [
      screen.getByTestId("transaction-table"),
      screen.getByTestId("transaction-cards"),
    ]) {
      expect(within(list).getByText("Food /")).toBeInTheDocument();
      expect(within(list).getByText("Groceries")).toBeInTheDocument();
      expect(within(list).getByText("🛒")).toBeInTheDocument();
    }
  });
  it("shows a readable fallback for an unavailable category", () => {
    mockUseCategories.mockReturnValue({
      categories: [],
      isLoading: false,
      error: null,
    });
    renderPage();
    expect(screen.getAllByText("Category unavailable")).toHaveLength(2);
    expect(screen.queryByText("cat-1")).not.toBeInTheDocument();
  });
});
