import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PublicLayout from "@/components/layout/PublicLayout";
import { ThemeProvider } from "@/contexts/ThemeContext";
import i18n from "@/i18n";

function renderPublicLayout() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/login" element={<h1>Login screen</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe("PublicLayout preferences", () => {
  beforeEach(async () => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-color-scheme: dark)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    await i18n.changeLanguage("en");
    localStorage.removeItem("monqom-language");
  });

  afterEach(async () => {
    await i18n.changeLanguage("en");
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    vi.unstubAllGlobals();
  });

  it("uses the operating system theme for a fresh session", () => {
    renderPublicLayout();

    expect(screen.getByRole("button", { name: "System" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("monqom-theme")).toBe("system");
  });

  it("allows changing and persisting theme before sign in", async () => {
    const user = userEvent.setup();
    renderPublicLayout();

    await user.click(screen.getByRole("button", { name: "Light" }));

    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem("monqom-theme")).toBe("light");
  });

  it("allows changing and persisting language before sign in", async () => {
    const user = userEvent.setup();
    renderPublicLayout();

    await user.click(screen.getByRole("button", { name: "Change language" }));

    expect(localStorage.getItem("monqom-language")).toBe("pl");
    expect(
      screen.getByRole("button", { name: "Zmień język" }),
    ).toHaveTextContent("PL");
  });
});
