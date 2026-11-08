import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MonthlySpendingSummary } from "@/components/dashboard/MonthlySpendingSummary";
import type { SpendingSummary } from "@/types/dashboard";

const summary: SpendingSummary = {
  month: "2026-11",
  currency: "USD",
  currentTotal: 120,
  previousTotal: 300,
  changeAmount: -180,
  changePercentage: -60,
  direction: "down",
  incomeTotal: 0,
  netTotal: -120,
};
const props = {
  summary,
  month: "2026-11",
  currentMonth: "2026-11",
  onSelectMonth: vi.fn(),
  onPreviousMonth: vi.fn(),
  onNextMonth: vi.fn(),
};

describe("monthly spending comparison", () => {
  it("shows the comparable period for the current month", () => {
    render(
      <MonthlySpendingSummary
        {...props}
        spendingPace={{ changePercentage: 20, direction: "up" }}
      />,
    );
    expect(
      screen.getByText("20.0% up compared with this point last month"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/vs previous month/)).not.toBeInTheDocument();
  });
  it("does not compare incomplete data to a full month", () => {
    render(<MonthlySpendingSummary {...props} spendingPace={null} />);
    expect(screen.queryByText(/vs previous month/)).not.toBeInTheDocument();
    expect(screen.queryByText(/last month/)).not.toBeInTheDocument();
  });
  it("keeps the full-month comparison for completed months", () => {
    render(<MonthlySpendingSummary {...props} currentMonth="2026-12" />);
    expect(
      screen.getByText("60.0% down vs previous month"),
    ).toBeInTheDocument();
  });
});
