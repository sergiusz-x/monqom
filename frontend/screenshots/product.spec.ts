import { resolve } from "node:path";
import { expect, test } from "./fixtures";

type Locale = "en" | "pl";
type Theme = "dark" | "light";

const labels = {
  en: {
    dashboard: "Dashboard",
    transactions: "Transactions",
    budgets: "Budgets",
    goalsNav: "Goals",
    goalsHeading: "Savings goals",
    groceries: "Groceries",
    holiday: "Holiday",
    addTransaction: "Add transaction",
    description: "Description",
    formDescription: "Weekly groceries",
    groceriesBudget: "60%",
    transportBudget: "84%",
    exceededBudget: "119%",
    switchToLight: "Switch to Light theme",
  },
  pl: {
    dashboard: "Pulpit",
    transactions: "Transakcje",
    budgets: "Budżety",
    goalsNav: "Cele",
    goalsHeading: "Cele oszczędnościowe",
    groceries: "Zakupy spożywcze",
    holiday: "Wakacje",
    addTransaction: "Dodaj transakcję",
    description: "Opis",
    formDescription: "Zakupy na tydzień",
    groceriesBudget: "60%",
    transportBudget: "84%",
    exceededBudget: "119%",
    switchToLight: "Przełącz motyw na Jasny",
  },
} satisfies Record<Locale, Record<string, string>>;

for (const locale of ["en", "pl"] as const) {
  test.describe(locale, () => {
    test.use({ locale });

    test("dashboard @dashboard", async ({ page, output }) => {
      const text = labels[locale];
      await page.setViewportSize({ width: 1440, height: 900 });

      for (const theme of ["dark", "light"] as const) {
        await expect(
          page.getByRole("heading", { name: text.dashboard }),
        ).toBeVisible();
        await expect(page.getByText(text.groceries).first()).toBeVisible();
        await saveMain(page, output, `dashboard-${theme}.png`);

        await page.setViewportSize({ width: 390, height: 844 });
        await savePage(page, output, `mobile-dashboard-${theme}.png`);
        await page.setViewportSize({ width: 1440, height: 900 });

        if (theme === "dark") await switchToLight(page, text.switchToLight);
      }
    });

    test("transactions @transactions", async ({ page, output }) => {
      const text = labels[locale];
      await navigate(
        page,
        "/transactions",
        text.transactions,
        text.transactions,
      );
      await expect(page.getByText(text.groceries).first()).toBeVisible();
      await captureBothThemes(
        page,
        output,
        text.switchToLight,
        async (theme) => {
          await saveMain(page, output, `transactions-${theme}.png`);
        },
      );
    });

    test("transaction form @transaction-form", async ({ page, output }) => {
      const text = labels[locale];
      await navigate(
        page,
        "/transactions",
        text.transactions,
        text.transactions,
      );
      await page
        .getByRole("button", { name: text.addTransaction })
        .first()
        .click();
      const dialog = page.getByRole("dialog", { name: text.addTransaction });
      await expect(dialog).toBeVisible();
      await dialog.getByLabel(text.description).fill(text.formDescription);
      await savePage(page, output, "transaction-form-dark.png");
      await page.keyboard.press("Escape");
      await switchToLight(page, text.switchToLight);
      await page
        .getByRole("button", { name: text.addTransaction })
        .first()
        .click();
      const lightDialog = page.getByRole("dialog", {
        name: text.addTransaction,
      });
      await expect(lightDialog).toBeVisible();
      await lightDialog.getByLabel(text.description).fill(text.formDescription);
      await page.screenshot({
        path: resolve(output, "transaction-form-light.png"),
        animations: "disabled",
      });
    });

    test("budgets @budgets", async ({ page, output }) => {
      const text = labels[locale];
      await navigate(page, "/budgets", text.budgets, text.budgets);
      await expect(page.getByText(text.groceries).first()).toBeVisible();
      for (const percentage of [
        text.groceriesBudget,
        text.transportBudget,
        text.exceededBudget,
      ]) {
        await expect(page.getByText(percentage, { exact: true })).toBeVisible();
      }
      await captureBothThemes(
        page,
        output,
        text.switchToLight,
        async (theme) => {
          await saveMain(page, output, `budgets-${theme}.png`);
        },
      );
    });

    test("goals @goals", async ({ page, output }) => {
      const text = labels[locale];
      await navigate(page, "/goals", text.goalsNav, text.goalsHeading);
      await expect(page.getByText(text.holiday).first()).toBeVisible();
      await captureBothThemes(
        page,
        output,
        text.switchToLight,
        async (theme) => {
          await saveMain(page, output, `goals-${theme}.png`);
        },
      );
    });
  });
}

async function navigate(
  page: import("@playwright/test").Page,
  path: string,
  linkName: string,
  heading: string,
) {
  if (new URL(page.url()).pathname !== path) {
    await page.getByRole("link", { name: linkName, exact: true }).click();
  }
  await expect(
    page.getByRole("heading", { name: heading, exact: true }),
  ).toBeVisible();
}

async function saveMain(
  page: import("@playwright/test").Page,
  output: string,
  filename: string,
) {
  const style = await page.addStyleTag({
    content:
      "aside { display: none !important; } main { width: 100% !important; }",
  });
  await savePage(page, output, filename);
  await style.evaluate((element) => element.remove());
}

async function savePage(
  page: import("@playwright/test").Page,
  output: string,
  filename: string,
) {
  await page.screenshot({
    path: resolve(output, filename),
    animations: "disabled",
  });
}

async function switchToLight(
  page: import("@playwright/test").Page,
  buttonName: string,
) {
  await page.getByRole("button", { name: buttonName, exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
}

async function captureBothThemes(
  page: import("@playwright/test").Page,
  output: string,
  switchButtonName: string,
  capture: (theme: Theme) => Promise<void>,
) {
  await capture("dark");
  await switchToLight(page, switchButtonName);
  await capture("light");
}
