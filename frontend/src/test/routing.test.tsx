import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithQueryClient as render } from "@/test/query-test-utils";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import DashboardPage from "@/pages/DashboardPage";
import TransactionsPage from "@/pages/TransactionsPage";
import TransactionDetailPage from "@/pages/TransactionDetailPage";
import BudgetsPage from "@/pages/BudgetsPage";
import SettingsPage from "@/pages/SettingsPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import { AuthContext } from "@/contexts/AuthContext";
import type { User } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/hooks/useWorkspace";
import { ToastProvider } from "@/contexts/ToastContext";
import { RouteLoadingFallback } from "@/components/RouteLoadingFallback";

const mockAuthValue = {
  user: null as User | null,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  setUser: vi.fn(),
};

function renderAt(path: string, element: React.ReactNode, withAuth = false) {
  const content = withAuth ? (
    <AuthContext.Provider value={mockAuthValue}>{element}</AuthContext.Provider>
  ) : (
    element
  );
  return render(
    <ToastProvider>
      <WorkspaceProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={path} element={content} />
          </Routes>
        </MemoryRouter>
      </WorkspaceProvider>
    </ToastProvider>,
  );
}

describe("page routing", () => {
  it("provides an accessible and layout-stable route loading fallback", () => {
    render(<RouteLoadingFallback />);
    expect(
      screen.getByRole("status", { name: /loading/i }),
    ).toBeInTheDocument();
  });

  it("renders DashboardPage at /dashboard", () => {
    renderAt("/dashboard", <DashboardPage />);
    expect(
      screen.getByRole("heading", { name: /dashboard/i }),
    ).toBeInTheDocument();
  });

  it("renders TransactionsPage at /transactions", () => {
    renderAt("/transactions", <TransactionsPage />);
    expect(
      screen.getByRole("heading", { name: /transactions/i }),
    ).toBeInTheDocument();
  });

  it("renders TransactionDetailPage at /transactions/:transactionId", () => {
    render(
      <ToastProvider>
        <WorkspaceProvider>
          <MemoryRouter initialEntries={["/transactions/tx-1"]}>
            <Routes>
              <Route
                path="/transactions/:transactionId"
                element={<TransactionDetailPage />}
              />
            </Routes>
          </MemoryRouter>
        </WorkspaceProvider>
      </ToastProvider>,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(
      screen.getByText(/loading transaction details/i),
    ).toBeInTheDocument();
  });

  it("renders BudgetsPage at /budgets", () => {
    renderAt("/budgets", <BudgetsPage />);
    expect(
      screen.getByRole("heading", { name: /budgets/i }),
    ).toBeInTheDocument();
  });

  it("renders SettingsPage at /settings", () => {
    renderAt("/settings", <SettingsPage />, true);
    expect(
      screen.getByRole("heading", { name: /settings/i }),
    ).toBeInTheDocument();
  });

  it("renders LoginPage at /login", () => {
    renderAt("/login", <LoginPage />, true);
    expect(
      screen.getByRole("heading", { name: /sign in/i }),
    ).toBeInTheDocument();
  });

  it("renders RegisterPage at /register", () => {
    renderAt("/register", <RegisterPage />);
    expect(
      screen.getByRole("heading", { name: /create account/i }),
    ).toBeInTheDocument();
  });

  it("renders VerifyEmailPage at /verify-email (no token)", () => {
    renderAt("/verify-email", <VerifyEmailPage />);
    expect(
      screen.getByRole("heading", { name: /check your email/i }),
    ).toBeInTheDocument();
  });

  it("renders ForgotPasswordPage at /forgot-password", () => {
    renderAt("/forgot-password", <ForgotPasswordPage />);
    expect(
      screen.getByRole("heading", { name: /forgot password/i }),
    ).toBeInTheDocument();
  });

  it("renders ResetPasswordPage at /reset-password (no token)", () => {
    renderAt("/reset-password", <ResetPasswordPage />);
    expect(
      screen.getByRole("heading", { name: /invalid link/i }),
    ).toBeInTheDocument();
  });
});
