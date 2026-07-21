import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithQueryClient as render } from "@/test/query-test-utils";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import DashboardPage from "@/pages/DashboardPage";
import type {
  CategoryBreakdown,
  SpendingTrendItem,
  SpendingSummary,
} from "@/types/dashboard";
import type { Transaction } from "@/types/transaction";
import type { Category } from "@/types/category";

vi.mock("@/hooks/useWorkspace", () => ({ useWorkspace: vi.fn() }));
vi.mock("@/hooks/useDashboardData", () => ({ useDashboardData: vi.fn() }));
vi.mock("@/hooks/useCategories", () => ({ useCategories: vi.fn() }));

import { useWorkspace } from "@/hooks/useWorkspace";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useCategories } from "@/hooks/useCategories";

const mockUseWorkspace = useWorkspace as ReturnType<typeof vi.fn>;
const mockUseDashboardData = useDashboardData as ReturnType<typeof vi.fn>;
const mockUseCategories = useCategories as ReturnType<typeof vi.fn>;

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

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
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
  mockUseDashboardData.mockReturnValue({
    summary: makeSummary(),
    categoryBreakdown: makeCategoryBreakdown(),
    spendingTrend: makeSpendingTrend(),
    transactions: [makeTransaction()],
    isLoading: false,
    error: null,
  });
});

describe("DashboardPage", () => {
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
    expect(screen.getAllByText("$1,234.56").length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/spending trend/i)).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /spending \$/i }),
    ).toHaveLength(6);
    expect(screen.getByLabelText(/spending by category/i)).toBeInTheDocument();
    expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /view all/i })).toHaveAttribute(
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

  it("opens edit transaction modal when recent item is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /groceries/i }));

    expect(
      screen.getByRole("dialog", { name: /edit transaction/i }),
    ).toBeInTheDocument();
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
