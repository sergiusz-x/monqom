import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { SpendingTrendChart } from "@/components/dashboard/SpendingTrendChart";
import type { SpendingTrendItem } from "@/types/dashboard";

const trend: SpendingTrendItem[] = [
  { month: "2025-12", total: 0 },
  { month: "2026-01", total: 25 },
  { month: "2026-02", total: 50 },
  { month: "2026-03", total: 0 },
  { month: "2026-04", total: 75 },
  { month: "2026-05", total: 100 },
];

function renderChart(data = trend) {
  return render(
    <MemoryRouter>
      <SpendingTrendChart trend={data} currency="USD" currentMonth="2026-05" />
    </MemoryRouter>,
  );
}

describe("SpendingTrendChart", () => {
  it("renders one accessible bar for each month", () => {
    renderChart();

    const chart = screen.getByRole("list", {
      name: "Monthly spending amounts",
    });
    expect(chart).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
  });

  it("selects a month on click", async () => {
    const user = userEvent.setup();
    renderChart();

    const april = screen.getByRole("listitem", {
      name: "April 2026 spending $75.00",
    });
    await user.click(april);

    expect(april).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("April 2026: $75.00")).toBeInTheDocument();
  });

  it("shows an empty state when all monthly totals are zero", () => {
    renderChart(trend.map((item) => ({ ...item, total: 0 })));

    expect(
      screen.queryByRole("list", { name: "Monthly spending amounts" }),
    ).toBeNull();
    expect(screen.getByText("No spending trend yet")).toBeInTheDocument();
  });
});
