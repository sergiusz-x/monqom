import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AuthContext,
  type AuthContextValue,
  type User,
} from "@/contexts/AuthContext";
import { SensitiveTransactionAmount } from "@/components/privacy/SensitiveTransactionAmount";
import { SalaryPrivacyProvider } from "@/contexts/SalaryPrivacyContext";
import { SALARY_CATEGORY_SYSTEM_KEY } from "@/lib/category-system-keys";
import { formatCurrency } from "@/lib/money";

const salaryTransaction = {
  id: "salary-1",
  workspaceId: "workspace-1",
  categoryId: "salary-category",
  paymentSourceId: "bank-1",
  type: "income" as const,
  amount: 2500,
  currency: "USD",
  date: "2026-08-01T00:00:00.000Z",
  description: "August salary",
  notes: null,
  tags: [],
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

function renderAmount(
  hideSalaryAmounts: boolean,
  systemKey = SALARY_CATEGORY_SYSTEM_KEY,
) {
  const user: User = {
    id: "user-1",
    email: "ada@example.com",
    name: "Ada",
    hideSalaryAmounts,
    emailVerified: true,
    totpEnabled: false,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
  const authValue: AuthContextValue = {
    user,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    setUser: vi.fn(),
  };

  return render(
    <AuthContext.Provider value={authValue}>
      <SalaryPrivacyProvider>
        <SensitiveTransactionAmount
          transaction={salaryTransaction}
          categorySystemKeys={{ "salary-category": systemKey }}
        />
      </SalaryPrivacyProvider>
    </AuthContext.Provider>,
  );
}

describe("SensitiveTransactionAmount", () => {
  it("keeps the salary amount visible when privacy mode is disabled", () => {
    renderAmount(false);

    expect(screen.getByText("+" + formatCurrency(2500, "USD"))).toHaveAttribute(
      "data-sensitive-amount",
      "visible",
    );
  });

  it("masks only the built-in salary category and reveals it on demand", async () => {
    const user = userEvent.setup();
    renderAmount(true);
    expect(
      screen.getByRole("button", { name: "Reveal salary amount" }),
    ).toHaveClass("blur-[8px]");

    await user.click(
      screen.getByRole("button", { name: "Reveal salary amount" }),
    );

    expect(screen.getByText("+" + formatCurrency(2500, "USD"))).toHaveAttribute(
      "data-sensitive-amount",
      "revealed",
    );
  });

  it("shares a temporary reveal across views of the same transaction", async () => {
    const user = userEvent.setup();
    const sharedUser: User = {
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      hideSalaryAmounts: true,
      emailVerified: true,
      totpEnabled: false,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    };

    render(
      <AuthContext.Provider
        value={{
          user: sharedUser,
          isLoading: false,
          login: vi.fn(),
          logout: vi.fn(),
          setUser: vi.fn(),
        }}
      >
        <SalaryPrivacyProvider>
          <SensitiveTransactionAmount
            transaction={salaryTransaction}
            categorySystemKeys={{
              "salary-category": SALARY_CATEGORY_SYSTEM_KEY,
            }}
          />
          <SensitiveTransactionAmount
            transaction={salaryTransaction}
            categorySystemKeys={{
              "salary-category": SALARY_CATEGORY_SYSTEM_KEY,
            }}
          />
        </SalaryPrivacyProvider>
      </AuthContext.Provider>,
    );

    await user.click(
      screen.getAllByRole("button", { name: "Reveal salary amount" })[0],
    );

    expect(
      document.querySelectorAll('[data-sensitive-amount="revealed"]'),
    ).toHaveLength(2);
  });
  it("does not hide a custom category that only shares the Salary name", () => {
    renderAmount(true, "categories.income.custom-salary");

    expect(screen.getByText("+" + formatCurrency(2500, "USD"))).toHaveAttribute(
      "data-sensitive-amount",
      "visible",
    );
  });
});
