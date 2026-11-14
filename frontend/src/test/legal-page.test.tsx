import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { ThemeProvider } from "@/contexts/ThemeContext";
import LegalPage from "@/pages/LegalPage";
import i18n from "@/i18n";

afterEach(async () => {
  cleanup();
  await act(async () => i18n.changeLanguage("en"));
});

describe("legal pages", () => {
  it("shows Polish copy and navigates between the documents", async () => {
    await act(async () => i18n.changeLanguage("pl"));
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/privacy"]}>
          <Routes>
            <Route path="/privacy" element={<LegalPage document="privacy" />} />
            <Route path="/terms" element={<LegalPage document="terms" />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Polityka prywatności" }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("link", { name: "Regulamin" }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Regulamin" }),
    ).toBeInTheDocument();
  });

  it("updates the language using the shared preference", async () => {
    await act(async () => i18n.changeLanguage("en"));
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/privacy"]}>
          <Routes>
            <Route path="/privacy" element={<LegalPage document="privacy" />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Privacy notice" }),
    ).toBeInTheDocument();
    await act(async () => i18n.changeLanguage("pl"));
    expect(
      screen.getByRole("heading", { level: 1, name: "Polityka prywatności" }),
    ).toBeInTheDocument();
  });
});
