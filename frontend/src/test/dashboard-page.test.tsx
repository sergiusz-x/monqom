import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithQueryClient as render } from "@/test/query-test-utils";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import DashboardPage from "@/pages/DashboardPage";
import { AuthContext, type AuthContextValue } from "@/contexts/AuthContext";
import type {
  CategoryBreakdown,
  SpendingTrendItem,
  SpendingSummary,
} from "@/types/dashboard";
import type { Transaction } from "@/types/transaction";
import type { Category } from "@/types/category";

vi.mock("@/hooks/useBudgetOverview", () => ({ useBudgetOverview: vi.fn() }));
vi.mock("@/hooks/useWorkspace", () => ({ useWorkspace: vi.fn() }));
vi.mock("@/hooks/useDashboardData", () => ({ useDashboardData: vi.fn() }));
vi.mock("@/hooks/useCategories", () => ({ useCategories: vi.fn() }));
vi.mock("@/hooks/usePaymentSources", () => ({
  usePaymentSources: vi.fn(),
}));

import { useBudgetOverview } from "@/hooks/useBudgetOverview";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useCategories } from "@/hooks/useCategories";
import { usePaymentSources } from "@/hooks/usePaymentSources";

const mockUseWorkspace = useWorkspace as ReturnType<typeof vi.fn>;
const mockUseDashboardData = useDashboardData as ReturnType<typeof vi.fn>;
const mockUseCategories = useCategories as ReturnType<typeof vi.fn>;
const mockUsePaymentSources = usePaymentSources as ReturnType<typeof vi.fn>;

function makeSummary(
  overrides: Partial<SpendingSummary> = {},
): SpendingSummary {
  return {
    month: "2026-04",
    currency: "USD",
    currentTotal: 1234.56,
    previousTotal: 1000,
    changeAmount: 234.56,
    changePercentage: 23.46,
    direction: "up",
    incomeTotal: 1500,
    netTotal: 265.44,
    ...overrides,
  };
}

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-1",
    workspaceId: "ws-1",
    categoryId: "cat-1",
    paymentSourceId: null,
    type: "expense",
    amount: 42.5,
    currency: "USD",
    date: "2026-04-18T00:00:00.000Z",
    description: "Team lunch",
    notes: null,
    tags: [],
    createdAt: "2026-04-18T00:00:00.000Z",
    updatedAt: "2026-04-18T00:00:00.000Z",
    ...overrides,
  };
}

function makeCategoryBreakdown(
  overrides: Partial<CategoryBreakdown> = {},
): CategoryBreakdown {
  return {
    month: "2026-04",
    currency: "USD",
    totalSpending: 1234.56,
    categories: [
      {
        categoryId: "cat-1",
        categoryName: "Groceries",
        categoryColor: "#16a34a",
        amount: 1234.56,
        percentage: 100,
      },
    ],
    ...overrides,
  };
}

function makeSpendingTrend(): SpendingTrendItem[] {
  return [
    { month: "2025-11", total: 0 },
    { month: "2025-12", total: 100 },
    { month: "2026-01", total: 200 },
    { month: "2026-02", total: 300 },
    { month: "2026-03", total: 400 },
    { month: "2026-04", total: 1234.56 },
  ];
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: "cat-1",
    name: "Groceries",
    icon: null,
    parentId: null,
    sortOrder: 0,
    children: [],
    ...overrides,
  };
}

import { ToastProvider } from "@monqom/ui/toast";

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useBudgetOverview).mockReturnValue({
    progressItems: [],
    budgets: [],
    isLoading: false,
    error: null,
    retry: vi.fn(),
  });
  mockUseWorkspace.mockReturnValue({
    workspaceId: "ws-1",
    isLoading: false,
    error: null,
  });
  mockUseCategories.mockReturnValue({
    categories: [makeCategory()],
    isLoading: false,
    error: null,
  });
  mockUsePaymentSources.mockReturnValue({
    paymentSources: [],
    isLoading: false,
    error: null,
  });
  mockUseDashboardData.mockReturnValue({
    summary: makeSummary(),
    categoryBreakdown: makeCategoryBreakdown(),
    spendingTrend: makeSpendingTrend(),
    financialTrend: makeSpendingTrend().map((item) => ({
      month: item.month,
      income: 500,
      spending: item.total,
    })),
    transactions: [makeTransaction()],
    isLoading: false,
    error: null,
  });
});

describe("DashboardPage", () => {
  it("masks the trend again when privacy is re-enabled", async () => {
    const user = userEvent.setup();
    const auth: AuthContextValue = {
      user: {
        id: "u",
        email: "a@example.com",
        name: "A",
        hideSalaryAmounts: true,
        emailVerified: true,
        totpEnabled: false,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
    };
    const view = (value: AuthContextValue) => (
      <AuthContext.Provider value={value}>
        <ToastProvider>
          <MemoryRouter>
            <DashboardPage />
          </MemoryRouter>
        </ToastProvider>
      </AuthContext.Provider>
    );
    const { rerender } = render(view(auth));
    await user.click(screen.getByRole("button", { name: "Reveal chart" }));
    rerender(
      view({ ...auth, user: { ...auth.user!, hideSalaryAmounts: false } }),
    );
    rerender(view(auth));
    expect(
      screen.getByRole("button", { name: "Reveal chart" }),
    ).toBeInTheDocument();
  });
  it("renders loading skeleton while workspace loads", () => {
    mockUseWorkspace.mockReturnValue({
      workspaceId: null,
      isLoading: true,
      error: null,
    });
    renderPage();
    expect(
      screen.getByRole("status", { name: /loading dashboard/i }),
    ).toBeInTheDocument();
  });

  it("renders spending summary and recent transaction", () => {
    renderPage();
    expect(
      screen.getByLabelText(/monthly spending summary/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Groceries/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute(
      "href",
      "/transactions",
    );
  });

  it("changes month when month navigation buttons are clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /previous month/i }));
    await user.click(screen.getByRole("button", { name: /next month/i }));

    expect(mockUseDashboardData).toHaveBeenCalled();
    expect(mockUseDashboardData.mock.calls.length).toBeGreaterThan(1);
  });

  it("selects a month in another year and returns to the current month", async () => {
    const user = userEvent.setup();
    renderPage();
    const currentMonth = mockUseDashboardData.mock.lastCall?.[1] as string;
    const previousYear = Number(currentMonth.slice(0, 4)) - 1;
    await user.click(
      screen.getByRole("button", { name: /choose month, selected/i }),
    );
    await user.click(screen.getByRole("button", { name: "Previous year" }));
    await user.click(
      screen.getByRole("button", { name: `March ${previousYear}` }),
    );
    expect(mockUseDashboardData).toHaveBeenLastCalledWith(
      "ws-1",
      `${previousYear}-03`,
    );
    await user.click(
      screen.getByRole("button", { name: /choose month, selected/i }),
    );
    await user.click(screen.getByRole("button", { name: "Current month" }));
    expect(mockUseDashboardData).toHaveBeenLastCalledWith("ws-1", currentMonth);
  });

  it("updates the whole dashboard when a month on the chart is selected", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "March 2026" }));
    expect(mockUseDashboardData).toHaveBeenLastCalledWith("ws-1", "2026-03");
    expect(vi.mocked(useBudgetOverview)).toHaveBeenLastCalledWith(
      "ws-1",
      "2026-03",
    );
  });

  it("shows exceeded budgets only when there are any", () => {
    vi.mocked(useBudgetOverview).mockReturnValue({
      progressItems: [
        {
          categoryId: "cat-1",
          categoryName: "Groceries",
          budgetAmount: 100,
          limit: 100,
          spent: 120,
          remaining: -20,
          percentage: 120,
        },
      ],
      budgets: [],
      isLoading: false,
      error: null,
      retry: vi.fn(),
    });
    renderPage();
    expect(screen.getByText("1 budget exceeded")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View budgets" })).toHaveAttribute(
      "href",
      "/budgets",
    );
  });

  it("links category spending to expenses for the selected month", () => {
    renderPage();
    const link = screen.getByRole("link", { name: /groceries/i });
    const params = new URLSearchParams(
      link.getAttribute("href")?.split("?")[1],
    );
    expect(params.get("category_id")).toBe("cat-1");
    expect(params.get("type")).toBe("expense");
    expect(params.get("date_from")).toMatch(/^\d{4}-\d{2}-01$/);
    expect(params.get("date_to")).toBeTruthy();
  });

  it("opens transaction details when a recent item is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /team lunch/i }));

    expect(
      screen.getByRole("dialog", { name: /transaction details/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: /edit transaction/i }),
    ).not.toBeInTheDocument();
  });

  it("shows empty state for new users", () => {
    mockUseDashboardData.mockReturnValue({
      summary: makeSummary({
        currentTotal: 0,
        previousTotal: 0,
        changeAmount: 0,
        direction: "flat",
      }),
      categoryBreakdown: makeCategoryBreakdown({
        totalSpending: 0,
        categories: [],
      }),
      spendingTrend: makeSpendingTrend().map((item) => ({ ...item, total: 0 })),
      transactions: [],
      isLoading: false,
      error: null,
    });

    renderPage();
    expect(screen.getByText("No transactions yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Add your first transaction to start tracking monthly spending.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("No category spending yet")).toBeInTheDocument();
  });

  it("shows dashboard error alert when data fetch fails", () => {
    mockUseDashboardData.mockReturnValue({
      summary: null,
      categoryBreakdown: null,
      spendingTrend: [],
      transactions: [],
      isLoading: false,
      error: "Failed to load dashboard",
    });

    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Failed to load dashboard",
    );
  });
});
