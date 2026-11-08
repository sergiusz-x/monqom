import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GoalDetailPage from "@/pages/GoalDetailPage";
import { renderWithQueryClient } from "@/test/query-test-utils";

const mocks = vi.hoisted(() => ({ hide: false }));
vi.mock("@/hooks/useWorkspace", () => ({
  useWorkspace: () => ({
    workspaceId: "w",
    workspace: { id: "w", timezone: "UTC", baseCurrency: "PLN" },
    isLoading: false,
  }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useOptionalAuth: () => ({ user: { hideSalaryAmounts: mocks.hide } }),
}));
vi.mock("@/hooks/useGoals", () => ({
  useGoal: () => ({
    goal: {
      id: "g",
      name: "Holiday",
      initialAmount: 0,
      currentAmount: 100,
      targetAmount: 1000,
      targetDate: "2030-01-01",
      planStartMonth: "2026-01",
      currency: "PLN",
      remainingAmount: 900,
      progressPercentage: 10,
      status: "active",
      remainingMonths: 12,
      recommendedMonthlyAmount: 75,
      operations: [],
    },
    isLoading: false,
    error: null,
  }),
}));
vi.mock("@/lib/api", () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: {
        currency: "PLN",
        allocations: [{ goal_id: "g", amount_cents: 25000 }],
      },
    }),
  },
}));
function renderPage() {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={["/goals/g"]}>
      <Routes>
        <Route path="/goals/:goalId" element={<GoalDetailPage />} />
        <Route path="/budgets" element={<p>Monthly budget</p>} />
      </Routes>
    </MemoryRouter>,
  );
}
describe("goal detail", () => {
  beforeEach(() => {
    mocks.hide = false;
  });
  it("shows the planned amount and opens a withdrawal directly", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText(/Planned:.*250[.,]00/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Withdraw money" }));
    expect(
      screen.getByRole("heading", { name: "Withdraw money" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Withdrawal" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
  it("does not expose the planned amount when privacy is enabled", async () => {
    mocks.hide = true;
    renderPage();
    expect(
      await screen.findByText("See the planned amount in your monthly plan."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Planned:.*250[.,]00/)).not.toBeInTheDocument();
  });
});
