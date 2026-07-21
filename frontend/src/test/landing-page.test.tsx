import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LandingRoute from "@/components/LandingRoute";
import MarketingLayout from "@/components/layout/MarketingLayout";
import LandingPage from "@/pages/LandingPage";
import {
  AuthContext,
  type AuthContextValue,
  type User,
} from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import i18n from "@/i18n";

const user: User = {
  id: "user-1",
  email: "user@example.com",
  name: "User",
  emailVerified: true,
  totpEnabled: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderLanding(overrides: Partial<AuthContextValue> = {}) {
  const authValue: AuthContextValue = {
    user: null,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    setUser: vi.fn(),
    ...overrides,
  };

  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/"]}>
        <AuthContext.Provider value={authValue}>
          <Routes>
            <Route element={<LandingRoute />}>
              <Route element={<MarketingLayout />}>
                <Route path="/" element={<LandingPage />} />
              </Route>
            </Route>
            <Route path="/dashboard" element={<h1>Dashboard destination</h1>} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

afterEach(async () => {
  await i18n.changeLanguage("en");
});

describe("public landing page", () => {
  it("shows the product message and authentication actions to guests", () => {
    renderLanding();

    expect(
      screen.getByRole("heading", {
        name: "Monqom helps you easily stay in control of your spending and everyday finances.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(
      screen.getByRole("link", { name: "Create account" }),
    ).toHaveAttribute("href", "/register");
  });

  it("renders the Polish copy", async () => {
    await i18n.changeLanguage("pl");
    renderLanding();

    expect(
      screen.getByRole("heading", {
        name: "Monqom pomaga prosto kontrolować wydatki i codzienne finanse.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Zaloguj się" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Załóż konto" }),
    ).toBeInTheDocument();
  });

  it("redirects an authenticated user from root to the dashboard", () => {
    renderLanding({ user });

    expect(
      screen.getByRole("heading", { name: "Dashboard destination" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Sign in" }),
    ).not.toBeInTheDocument();
  });

  it("waits for session resolution before rendering the landing page", () => {
    renderLanding({ isLoading: true });

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Sign in" }),
    ).not.toBeInTheDocument();
  });
});
