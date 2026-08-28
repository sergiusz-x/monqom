import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
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
  hideSalaryAmounts: false,
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
  cleanup();
  await act(async () => {
    await i18n.changeLanguage("en");
  });
});

describe("public landing page", () => {
  it("shows the product message and authentication actions to guests", () => {
    renderLanding();

    expect(
      screen.getByRole("heading", {
        name: "Understand your money without the complexity.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(
      screen
        .getAllByRole("link", { name: "Create account" })
        .some((link) => link.getAttribute("href") === "/register"),
    ).toBe(true);
    expect(
      screen.getByRole("link", { name: "Self-host Monqom" }),
    ).toHaveAttribute(
      "href",
      "https://github.com/sergiusz-x/monqom/blob/main/docs/self-hosting.md",
    );
  });

  it("renders the Polish copy", async () => {
    await act(async () => {
      await i18n.changeLanguage("pl");
    });
    renderLanding();

    expect(
      screen.getByRole("heading", {
        name: "Zrozum swoje finanse bez zbędnych komplikacji.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Zaloguj się" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Załóż konto" }).length,
    ).toBeGreaterThan(0);
  });

  it("opens a full-size product screenshot preview", async () => {
    const user = userEvent.setup();
    renderLanding();

    await user.click(
      screen.getByRole("button", {
        name: "Open full preview: Monqom dashboard in dark mode",
      }),
    );

    expect(
      screen.getByRole("dialog", { name: "Monqom dashboard in dark mode" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close preview" }));

    expect(
      screen.queryByRole("dialog", { name: "Monqom dashboard in dark mode" }),
    ).not.toBeInTheDocument();
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
