import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import userEvent from "@testing-library/user-event";
import { renderWithQueryClient as render } from "@/test/query-test-utils";
import BudgetsPage from "@/pages/BudgetsPage";
import api from "@/lib/api";

vi.mock("@/components/budgets/MonthlyPlanPanel", () => ({
  MonthlyPlanPanel: () => null,
}));

vi.mock("@/hooks/useWorkspace", () => ({
  useWorkspace: () => ({
    workspaceId: "ws-1",
    workspace: { baseCurrency: "USD", timezone: "UTC" },
    isLoading: false,
    error: null,
  }),
}));
vi.mock("@/hooks/useCategories", () => ({
  useCategories: () => ({
    categories: [
      {
        id: "parent",
        name: "Food",
        icon: null,
        parentId: null,
        children: [
          {
            id: "cat-1",
            name: "Groceries",
            icon: null,
            parentId: "parent",
            children: [],
          },
          {
            id: "cat-2",
            name: "Dining",
            icon: null,
            parentId: "parent",
            children: [],
          },
        ],
      },
    ],
  }),
}));
vi.mock("@/hooks/useBudgetOverview", () => ({
  useBudgetOverview: () => ({
    progressItems: [
      {
        categoryId: "cat-1",
        categoryName: "Groceries",
        budgetAmount: 500,
        limit: 500,
        spent: 300,
        remaining: 200,
        percentage: 60,
      },
    ],
    budgets: [
      {
        id: "recurring:rule-1:2026-04",
        categoryId: "cat-1",
        amount: 500,
        currency: "USD",
        year: 2026,
        month: 4,
      },
    ],
    isLoading: false,
    error: null,
    retry: vi.fn(),
  }),
}));
vi.mock("@/hooks/useTransactions", () => ({
  useTransactions: () => ({
    data: { data: [], total: 0 },
    isLoading: false,
    error: null,
    retry: vi.fn(),
  }),
}));
vi.mock("@/components/CategorySelector", () => ({
  CategorySelector: ({
    onChange,
    value,
  }: {
    onChange: (id: string) => void;
    value: string | null;
  }) => (
    <button type="button" onClick={() => onChange("cat-2")}>
      {value ?? "Pick category"}
    </button>
  ),
}));
vi.mock("@/lib/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const mockPost = api.post as ReturnType<typeof vi.fn>;
const renderPage = () =>
  render(
    <MemoryRouter>
      <BudgetsPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockPost.mockResolvedValue({ data: {} });
});

describe("BudgetsPage", () => {
  it("opens budget details and returns to them after cancelling edit", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(
      screen.getByRole("button", { name: /open groceries budget details/i }),
    );
    expect(
      screen.getByRole("dialog", { name: "Budget details" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(
      screen.getByRole("heading", { name: "Edit budget" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.getByRole("dialog", { name: "Budget details" }),
    ).toBeInTheDocument();
  });

  it("creates a recurring budget by default", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Add Budget" }));
    await user.click(screen.getByRole("button", { name: "Pick category" }));
    await user.type(screen.getByLabelText("Monthly limit"), "25000");
    await user.click(screen.getByRole("button", { name: "Create budget" }));
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        "/workspaces/ws-1/budgets/recurring",
        expect.objectContaining({
          category_id: "cat-2",
          amount: 250,
          currency: "USD",
        }),
      ),
    );
  });

  it("creates a one-month exception when editing an inherited budget", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(
      screen.getByRole("button", { name: /open groceries budget details/i }),
    );
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.selectOptions(screen.getByLabelText("Apply to"), "month");
    await user.click(screen.getByRole("button", { name: "Save budget" }));
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        expect.stringContaining("/workspaces/ws-1/budgets"),
        expect.objectContaining({ category_id: "cat-1", amount: 500 }),
      ),
    );
  });

  it("offers the selected scope before deleting a budget", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(
      screen.getByRole("button", { name: /open groceries budget details/i }),
    );
    screen.getByRole("button", { name: "Budget actions" }).focus();
    await user.keyboard("{ArrowDown}");
    await user.click(await screen.findByRole("menuitem", { name: /delete/i }));
    const confirmation = screen.getByRole("dialog", {
      name: "Delete this budget?",
    });
    await user.selectOptions(
      within(confirmation).getByLabelText("Apply to"),
      "future",
    );
    await user.click(
      within(confirmation).getByRole("button", { name: "Delete budget" }),
    );
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        expect.stringContaining("/budgets/recurring/remove?scope=future"),
        expect.objectContaining({ category_id: "cat-1" }),
      ),
    );
  });
});
