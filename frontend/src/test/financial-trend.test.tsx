import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthContext, type AuthContextValue } from "@/contexts/AuthContext";
import { FinancialTrend } from "@/components/dashboard/FinancialTrend";

const trend = Array.from({ length: 12 }, (_, index) => ({
  month: `2026-${String(index + 1).padStart(2, "0")}`,
  income: index === 9 ? null : 1000,
  spending: index === 9 ? null : 600,
}));
function InteractiveTrend() {
  const [revealed, setRevealed] = useState(false);
  const [month, setMonth] = useState("2026-12");
  const [range, setRange] = useState<6 | 12>(6);
  return (
    <FinancialTrend
      trend={trend}
      currency="USD"
      currentMonth="2026-12"
      selectedMonth={month}
      onSelectMonth={setMonth}
      range={range}
      onRangeChange={setRange}
      revealed={revealed}
      onReveal={() => setRevealed(true)}
    />
  );
}
function renderTrend(hideSalaryAmounts: boolean) {
  const auth: AuthContextValue = {
    user: {
      id: "user-1",
      email: "test@example.com",
      name: "Test",
      hideSalaryAmounts,
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
  return render(
    <AuthContext.Provider value={auth}>
      <InteractiveTrend />
    </AuthContext.Provider>,
  );
}
describe("FinancialTrend", () => {
  it("shows recorded months, handles gaps and switches the range", async () => {
    const user = userEvent.setup();
    renderTrend(false);
    expect(screen.getAllByText(/month in progress/)).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "October 2026" }));
    expect(screen.getByText("No recorded transactions")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "12 months" }));
    expect(
      screen.getByRole("button", { name: "January 2026" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "January 2026" }));
    expect(screen.getByText(/January 2026/)).toBeInTheDocument();
  });
  it("tracks the selected dashboard month and rounds the axis up", () => {
    const data = trend.map((item) => ({
      ...item,
      income: item.income === null ? null : 16800,
    }));
    const { rerender } = render(
      <FinancialTrend
        trend={data}
        currency="USD"
        currentMonth="2026-12"
        selectedMonth="2026-12"
        onSelectMonth={vi.fn()}
        range={6}
        onRangeChange={vi.fn()}
        revealed={false}
        onReveal={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "December 2026" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("18K")).toBeInTheDocument();
    rerender(
      <FinancialTrend
        trend={data}
        currency="USD"
        currentMonth="2026-12"
        selectedMonth="2026-09"
        onSelectMonth={vi.fn()}
        range={6}
        onRangeChange={vi.fn()}
        revealed={false}
        onReveal={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "September 2026" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/September 2026/)).toBeInTheDocument();
  });

  it("does not render financial data until the whole section is revealed", async () => {
    const user = userEvent.setup();
    renderTrend(true);
    expect(screen.queryByText("$1,000.00")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "12 months" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reveal chart" }));
    expect(screen.getByText("$1,000.00")).toBeInTheDocument();
  });
});
