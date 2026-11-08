import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GoalFormPage from "@/pages/GoalFormPage";
import { renderWithQueryClient } from "@/test/query-test-utils";

const mocks = vi.hoisted(() => ({
  goal: null as null | Record<string, unknown>,
  update: vi.fn(),
}));
vi.mock("@/hooks/useWorkspace", () => ({
  useWorkspace: () => ({
    workspaceId: "w",
    workspace: { id: "w", timezone: "UTC", baseCurrency: "PLN" },
    isLoading: false,
  }),
}));
vi.mock("@/hooks/useGoals", () => ({
  useGoal: () => ({ goal: mocks.goal, isLoading: false, error: null }),
}));
vi.mock("@/api/contract", () => ({
  goalsApi: { goalsControllerUpdate: mocks.update },
}));

function renderEdit() {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={["/goals/g/edit"]}>
      <Routes>
        <Route path="/goals/:goalId/edit" element={<GoalFormPage />} />
        <Route path="/goals/:goalId" element={<p>Saved goal</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("goal editing", () => {
  beforeEach(() => {
    mocks.update.mockReset();
    const today = new Date();
    const target = new Date(
      Date.UTC(today.getUTCFullYear() + 1, today.getUTCMonth(), 1),
    );
    mocks.goal = {
      id: "g",
      name: "Holiday",
      initialAmount: 100,
      currentAmount: 500,
      targetAmount: 1200,
      targetDate: target.toISOString().slice(0, 10),
      planStartMonth: today.toISOString().slice(0, 7),
      currency: "PLN",
    };
  });

  it("uses the current saved amount, including operations, in the preview", async () => {
    renderEdit();
    await waitFor(() =>
      expect(screen.getByLabelText("Goal name")).toHaveValue("Holiday"),
    );
    expect(screen.getByText(/700[.,]00/)).toBeInTheDocument();
  });

  it("allows editing the name without changing a past deadline", async () => {
    mocks.goal!.targetDate = "2020-01-01";
    mocks.update.mockResolvedValue({
      data: {
        id: "g",
        workspace_id: "w",
        name: "Trip",
        target_amount: 1200,
        initial_amount: 100,
        currency: "PLN",
        target_date: "2020-01-01",
        plan_start_month: "2019-01",
        current_amount: 500,
        remaining_amount: 700,
        progress_percentage: 41.67,
        remaining_months: 0,
        recommended_monthly_amount: null,
        status: "overdue",
      },
    });
    renderEdit();
    await waitFor(() =>
      expect(screen.getByLabelText("Goal name")).toHaveValue("Holiday"),
    );
    fireEvent.change(screen.getByLabelText("Goal name"), {
      target: { value: "Trip" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith("g", "w", { name: "Trip" }),
    );
    expect(await screen.findByText("Saved goal")).toBeInTheDocument();
  });
});
