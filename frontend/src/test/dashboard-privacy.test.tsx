import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthContext, type AuthContextValue } from "@/contexts/AuthContext";
import { MonthlySpendingSummary } from "@/components/dashboard/MonthlySpendingSummary";

function summaryView(hideSalaryAmounts: boolean) {
  const auth: AuthContextValue = {
    user: {
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
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
  return (
    <AuthContext.Provider value={auth}>
      <MonthlySpendingSummary
        summary={{
          month: "2026-04",
          currency: "USD",
          currentTotal: 300,
          previousTotal: 100,
          changeAmount: 200,
          changePercentage: 200,
          direction: "up",
          incomeTotal: 1000,
          netTotal: 700,
        }}
        month="2026-04"
        currentMonth="2026-04"
        onSelectMonth={vi.fn()}
        onPreviousMonth={vi.fn()}
        onNextMonth={vi.fn()}
      />
    </AuthContext.Provider>
  );
}

function renderSummary(hideSalaryAmounts: boolean) {
  return render(summaryView(hideSalaryAmounts));
}

describe("dashboard privacy", () => {
  it("masks revealed amounts again when privacy is re-enabled", async () => {
    const user = userEvent.setup();
    const { rerender } = renderSummary(true);
    await user.click(screen.getByRole("button", { name: "Reveal income" }));
    await user.click(
      screen.getByRole("button", { name: "Reveal monthly balance" }),
    );
    rerender(summaryView(false));
    rerender(summaryView(true));
    expect(
      screen.getByRole("button", { name: "Reveal income" }),
    ).toHaveAttribute("data-sensitive-amount", "masked");
    expect(
      screen.getByRole("button", { name: "Reveal monthly balance" }),
    ).toHaveAttribute("data-sensitive-amount", "masked");
  });
  it("shows income and balance when privacy is off", () => {
    renderSummary(false);
    expect(screen.getByText("$1,000.00")).not.toHaveAttribute(
      "data-sensitive-amount",
      "masked",
    );
    expect(screen.getByText("$700.00")).not.toHaveAttribute(
      "data-sensitive-amount",
      "masked",
    );
  });
  it("masks income and balance independently while leaving spending visible", async () => {
    const user = userEvent.setup();
    renderSummary(true);
    expect(
      screen.getByRole("button", { name: "Reveal income" }),
    ).toHaveAttribute("data-sensitive-amount", "masked");
    expect(screen.getByRole("button", { name: "Reveal income" })).toHaveClass(
      "text-emerald-600",
    );
    expect(
      screen.getByRole("button", { name: "Reveal monthly balance" }),
    ).toHaveAttribute("data-sensitive-amount", "masked");
    expect(screen.getByText("$300.00")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Reveal income" }));
    expect(screen.getByText("$1,000.00")).toHaveAttribute(
      "data-sensitive-amount",
      "revealed",
    );
    expect(
      screen.getByRole("button", { name: "Reveal monthly balance" }),
    ).toHaveAttribute("data-sensitive-amount", "masked");
    await user.click(
      screen.getByRole("button", { name: "Reveal monthly balance" }),
    );
    expect(screen.getByText("$700.00")).toHaveAttribute(
      "data-sensitive-amount",
      "revealed",
    );
  });
});
