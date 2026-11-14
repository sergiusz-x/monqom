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
        name: "Your spending and budgets, all in one place.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(
      screen.getByRole("link", { name: "Privacy notice" }),
    ).toHaveAttribute("href", "/privacy");
    expect(
      screen.getByRole("link", { name: "Terms of service" }),
    ).toHaveAttribute("href", "/terms");
    expect(
      screen
        .getAllByRole("link", { name: "Create account" })
        .some((link) => link.getAttribute("href") === "/register"),
    ).toBe(true);
    expect(
      screen.getByRole("link", { name: "Read self-hosting guide" }),
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
        name: "Twoje wydatki i budżety w jednym miejscu.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Zobacz, na co wydajesz pieniądze.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Dodawaj transakcje ręcznie")).toBeInTheDocument();
    expect(screen.getByText("Jak dodawać transakcje?")).toBeInTheDocument();
    expect(
      screen.getByText(/Możesz wyeksportować transakcje do pliku CSV lub JSON/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Załóż konto i zacznij śledzić wydatki bez konfiguracji/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Kontakt" })).toHaveAttribute(
      "href",
      "mailto:kontakt+monqom@sergiusz.dev",
    );
    expect(
      screen.getByRole("link", { name: "Zaloguj się" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Załóż konto" }).length,
    ).toBeGreaterThan(0);
  });

  it("shows screenshots that follow the selected language and theme", async () => {
    localStorage.setItem("monqom-theme", "dark");
    renderLanding();
    const dashboard = screen.getByRole("img", {
      name: "Dashboard with monthly spending trend and categories",
    });
    expect(dashboard).toHaveAttribute(
      "src",
      "/marketing/screenshots/en/dashboard-dark.png",
    );
    expect(
      screen.getByRole("img", {
        name: "Transaction list with filters, categories, and payment sources",
      }),
    ).toHaveAttribute("src", "/marketing/screenshots/en/transactions-dark.png");

    await userEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(dashboard).toHaveAttribute(
      "src",
      "/marketing/screenshots/en/dashboard-light.png",
    );

    await act(async () => {
      await i18n.changeLanguage("pl");
    });
    expect(dashboard).toHaveAttribute(
      "src",
      "/marketing/screenshots/pl/dashboard-light.png",
    );
    expect(
      screen.getByRole("img", {
        name: "Lista transakcji z filtrami, kategoriami i źródłami płatności",
      }),
    ).toHaveAttribute(
      "src",
      "/marketing/screenshots/pl/transactions-light.png",
    );
  });

  it("opens and dismisses the compact preferences", async () => {
    const user = userEvent.setup();
    renderLanding();
    const trigger = screen.getByRole("button", { name: "Display preferences" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    await user.click(
      screen.getByRole("heading", {
        name: "Your spending and budgets, all in one place.",
      }),
    );
    expect(trigger).toHaveAttribute("aria-expanded", "false");
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
