import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { renderWithQueryClient as render } from "@/test/query-test-utils";
import { MonthlyPlanPanel } from "@/components/budgets/MonthlyPlanPanel";
import api from "@/lib/api";
import { useOptionalAuth } from "@/contexts/AuthContext";

vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: vi.fn() }));
vi.mock("@/hooks/useGoals", () => ({
  useGoals: () => ({
    goals: [
      {
        id: "goal-1",
        name: "Holiday",
        currency: "PLN",
        archivedAt: null,
        status: "active",
      },
    ],
    isLoading: false,
    error: null,
    retry: vi.fn(),
  }),
}));
vi.mock("@/hooks/useCategories", () => ({
  useCategories: () => ({
    categories: [{ id: "income-1", name: "Salary", children: [] }],
    isLoading: false,
    error: null,
    retry: vi.fn(),
  }),
}));
vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), put: vi.fn() } }));
const get = api.get as ReturnType<typeof vi.fn>;
const put = api.put as ReturnType<typeof vi.fn>;
const auth = useOptionalAuth as ReturnType<typeof vi.fn>;
const base = {
  currency: "PLN",
  funds_cents: 800000,
  income_planned: true,
  confirmed_at: "2026-11-01T12:00:00Z",
  revision: 3,
  stale: false,
  expense_commitments_cents: 300000,
  goal_commitments_cents: 100000,
  unallocated_cents: 400000,
  overlaps: false,
  allocations: [],
};
const renderPanel = (currentMonth = "2026-11") =>
  render(
    <MemoryRouter>
      <MonthlyPlanPanel
        workspaceId="ws-1"
        month="2026-11"
        currentMonth={currentMonth}
        currency="PLN"
      />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockReturnValue(null);
  get.mockResolvedValue({ data: base });
  put.mockResolvedValue({ data: { ...base, revision: 4 } });
});

describe("MonthlyPlanPanel", () => {
  it("can replace inherited income with a manual amount for this month", async () => {
    get.mockResolvedValue({
      data: {
        ...base,
        revision: 0,
        income_mode: "transactions",
        category_ids: [],
        manual_funds_cents: 0,
      },
    });
    const user = userEvent.setup();
    renderPanel();
    await user.click(
      await screen.findByRole("button", { name: "Edit income" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Planned income" });
    await user.click(
      within(dialog).getByRole("tab", { name: "Enter an amount" }),
    );
    const input = within(dialog).getByLabelText("Planned income");
    await user.clear(input);
    await user.type(input, "50000");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(expect.stringContaining("/funds"), {
        funds_cents: 50000,
        income_mode: "manual",
        category_ids: [],
      }),
    );
  });
  it("saves transaction income for selected categories and keeps the manual amount", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(
      await screen.findByRole("button", { name: "Edit income" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Planned income" });
    await user.click(
      within(dialog).getByRole("tab", { name: "Use transactions" }),
    );
    await user.click(within(dialog).getByRole("tab", { name: "Selected" }));
    await user.click(within(dialog).getByRole("checkbox", { name: "Salary" }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(expect.stringContaining("/funds"), {
        funds_cents: 800000,
        income_mode: "transactions",
        category_ids: ["income-1"],
        expected_revision: 3,
      }),
    );
  });
  it("does not calculate across currencies", async () => {
    get.mockResolvedValue({
      data: { ...base, stale: true, unallocated_cents: null },
    });
    renderPanel();
    expect(await screen.findByRole("status")).toHaveTextContent(/currency/i);
    expect(screen.queryByText("Still to plan")).not.toBeInTheDocument();
  });

  it("does not treat a legacy available balance as planned income", async () => {
    get.mockResolvedValue({
      data: { ...base, income_planned: false, unallocated_cents: null },
    });
    const user = userEvent.setup();
    renderPanel();
    await user.click(
      await screen.findByRole("button", { name: "Enter planned income" }),
    );
    expect(
      within(screen.getByRole("dialog")).getByLabelText("Planned income"),
    ).toHaveValue("");
    expect(screen.queryByText("Still to plan")).not.toBeInTheDocument();
  });

  it("clearly shows when the plan exceeds income", async () => {
    get.mockResolvedValue({
      data: {
        ...base,
        expense_commitments_cents: 750000,
        unallocated_cents: -50000,
      },
    });
    renderPanel();
    const warning = await screen.findByRole("status");
    expect(warning).toHaveTextContent("Planned above income");
    expect(warning).toHaveTextContent("500");
  });

  it("shows the income breakdown and progress toward each planned goal", async () => {
    get.mockResolvedValue({
      data: {
        ...base,
        allocations: [
          {
            id: "allocation-1",
            goal_id: "goal-1",
            name: "Holiday",
            amount_cents: 100000,
            deposited_cents: 30000,
            withdrawn_cents: 0,
            remaining_cents: 70000,
          },
        ],
      },
    });
    renderPanel();
    expect(await screen.findByText("Still to plan")).toBeInTheDocument();
    expect(screen.getByText("Planned expenses")).toBeInTheDocument();
    expect(screen.getByText("Planned savings")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Savings progress for Holiday" }),
    ).toHaveAttribute("aria-valuenow", "30");
  });

  it("highlights matching segments and labels on hover", async () => {
    const user = userEvent.setup();
    const { container } = renderPanel();
    const label = (await screen.findByText("Planned expenses")).closest(
      ".rounded-md",
    )!;
    const expenseSegment = container.querySelector(
      '[data-segment="expenses"]',
    )!;
    const savingsSegment = container.querySelector('[data-segment="savings"]')!;
    await user.hover(expenseSegment);
    expect(label).toHaveClass("bg-muted/60");
    expect(savingsSegment).toHaveClass("opacity-40");
    await user.unhover(expenseSegment);
    await user.hover(screen.getByText("Planned savings"));
    expect(expenseSegment).toHaveClass("opacity-40");
    expect(savingsSegment).toHaveClass("opacity-100");
  });

  it("explains why synchronized income can be zero in a future month", async () => {
    get.mockResolvedValue({
      data: {
        ...base,
        income_mode: "transactions",
        funds_cents: 0,
        unallocated_cents: -400000,
      },
    });
    renderPanel("2026-10");
    expect(
      await screen.findByText(
        /Income for this future month is currently zero/i,
      ),
    ).toBeInTheDocument();
  });

  it("shows goal deposits net of withdrawals, including a negative balance", async () => {
    get.mockResolvedValue({
      data: {
        ...base,
        allocations: [
          {
            id: "allocation-1",
            goal_id: "goal-1",
            name: "Holiday",
            amount_cents: 100000,
            deposited_cents: 30000,
            withdrawn_cents: 50000,
            remaining_cents: 70000,
          },
        ],
      },
    });
    renderPanel();
    expect(await screen.findByText(/Net deposits:.*200/)).toHaveTextContent(
      /-.*200/,
    );
    expect(
      screen.getByRole("progressbar", { name: "Savings progress for Holiday" }),
    ).toHaveAttribute("aria-valuenow", "0");
  });

  it.each([
    [100000, "100%"],
    [150000, "150%"],
  ])(
    "shows %s deposited as %s without a progress bar",
    async (deposited, percent) => {
      get.mockResolvedValue({
        data: {
          ...base,
          allocations: [
            {
              id: "allocation-1",
              goal_id: "goal-1",
              name: "Holiday",
              amount_cents: 100000,
              deposited_cents: deposited,
              withdrawn_cents: 0,
              remaining_cents: 0,
            },
          ],
        },
      });
      renderPanel();
      expect(await screen.findByText(`(${percent})`)).toBeInTheDocument();
      expect(
        screen.queryByRole("progressbar", {
          name: "Savings progress for Holiday",
        }),
      ).not.toBeInTheDocument();
    },
  );

  it("requires an explicit reveal when the privacy setting is enabled", async () => {
    auth.mockReturnValue({ user: { hideSalaryAmounts: true } });
    const user = userEvent.setup();
    renderPanel();
    await user.click(
      await screen.findByRole("button", { name: "Show monthly plan" }),
    );
    expect(screen.getByText("Still to plan")).toBeInTheDocument();
  });

  it("confirms funds with a revision and submits planned goal savings separately", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(
      await screen.findByRole("button", { name: "Edit income" }),
    );
    let dialog = screen.getByRole("dialog", { name: "Planned income" });
    const input = within(dialog).getByLabelText("Planned income");
    await user.clear(input);
    await user.type(input, "750000");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(expect.stringContaining("/funds"), {
        funds_cents: 750000,
        income_mode: "manual",
        category_ids: [],
        expected_revision: 3,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Plan savings" }));
    dialog = screen.getByRole("dialog", { name: "Plan savings" });
    await user.type(within(dialog).getByLabelText("Holiday"), "50000");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(expect.stringContaining("/goals"), {
        expected_revision: 4,
        allocations: [{ goal_id: "goal-1", amount_cents: 50000 }],
      }),
    );
  });
});
