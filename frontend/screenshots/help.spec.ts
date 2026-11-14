import { resolve } from "node:path";
import { expect, test } from "./fixtures";
import type { Locator, Page } from "@playwright/test";

const labels = {
  pl: {
    goals: "Cele oszczędnościowe",
    newGoal: "Nowy cel",
    holiday: "Wakacje",
    add: "Odłóż pieniądze",
    budgets: "Budżety",
    budgetAdd: "Dodaj budżet",
    budgetScope: "Zastosuj do",
    transactions: "Transakcje",
    transactionAdd: "Dodaj transakcję",
    search: "Szukaj po opisie…",
    income: "Wpisz planowane wpływy",
    incomeDialog: "Planowane wpływy",
    editIncome: "Edytuj wpływy",
    planGoals: "Zaplanuj odkładanie",
    remaining: "Jeszcze do zaplanowania",
    review: "Przejrzyj transakcje",
    purchase: "Kawa i śniadanie",
    light: "Przełącz motyw na Jasny",
    goalName: "np. Ślub albo wakacje",
    sync: "Pobieraj z transakcji",
    details: "Szczegóły transakcji",
    assign: "Przypisz kategorię",
    category: "Zakupy spożywcze",
    save: "Zapisz",
  },
  en: {
    goals: "Savings goals",
    newGoal: "New goal",
    holiday: "Holiday",
    add: "Add savings",
    budgets: "Budgets",
    budgetAdd: "Add Budget",
    budgetScope: "Apply to",
    transactions: "Transactions",
    transactionAdd: "Add transaction",
    search: "Search by description…",
    income: "Enter planned income",
    incomeDialog: "Planned income",
    editIncome: "Edit income",
    planGoals: "Plan savings",
    remaining: "Still to plan",
    review: "Review transactions",
    purchase: "Coffee and breakfast",
    light: "Switch to Light theme",
    goalName: "e.g. Wedding or holiday",
    sync: "Use transactions",
    details: "Transaction details",
    assign: "Assign category",
    category: "Groceries",
    save: "Save",
  },
} as const;

// The outline is temporary and targets the real control, so it tracks layout and translation.
async function capture(
  page: Page,
  output: string,
  filename: string,
  target: Locator,
) {
  await expect(target).toBeVisible();
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box)
    throw new Error("Cannot highlight an element without a bounding box");
  const scroll = await page.evaluate(() => ({
    x: window.scrollX,
    y: window.scrollY,
  }));
  await page.evaluate(
    ({ box, scroll }) => {
      const marker = document.createElement("div");
      marker.id = "screenshot-highlight";
      Object.assign(marker.style, {
        position: "fixed",
        pointerEvents: "none",
        zIndex: "2147483647",
        left: `${box.x - scroll.x}px`,
        top: `${box.y - scroll.y}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
        border: "3px solid #10b981",
        borderRadius: "8px",
        boxShadow: "0 0 0 3px rgba(16,185,129,.2)",
        boxSizing: "border-box",
      });
      document.body.appendChild(marker);
    },
    { box, scroll },
  );
  await page.screenshot({
    path: resolve(output, filename),
    animations: "disabled",
  });
  await page.evaluate(() =>
    document.getElementById("screenshot-highlight")?.remove(),
  );
}

for (const locale of ["pl", "en"] as const) {
  test.describe(locale, () => {
    test.use({ locale });
    for (const [name, path] of [
      ["goals", "/goals"],
      ["plan", "/budgets"],
      ["review", "/transactions"],
      ["budget-guide", "/budgets"],
      ["transaction-guide", "/transactions"],
    ] as const) {
      test(`help ${name} @help-${name}`, async ({ page, output }) => {
        const text = labels[locale];
        await page.setViewportSize({ width: 1440, height: 900 });
        for (const theme of ["dark", "light"] as const) {
          await page.goto(path);
          await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            theme,
          );
          if (name === "goals") {
            await expect(
              page.getByRole("heading", { name: text.goals }),
            ).toBeVisible();
            await capture(
              page,
              output,
              `help-goal-create-${theme}.png`,
              page.getByRole("button", { name: text.newGoal }).first(),
            );
            await page
              .getByRole("button", { name: text.newGoal })
              .first()
              .click();
            await capture(
              page,
              output,
              `help-goal-form-${theme}.png`,
              page.getByPlaceholder(text.goalName),
            );
            await page.goBack();
            await page
              .getByRole("link", { name: new RegExp(text.holiday) })
              .first()
              .click();
            await capture(
              page,
              output,
              `help-goal-deposit-${theme}.png`,
              page.getByRole("button", { name: text.add }),
            );
            await page.getByRole("button", { name: text.add }).click();
            await capture(
              page,
              output,
              `help-goal-deposit-form-${theme}.png`,
              page.getByRole("dialog"),
            );
            await page.keyboard.press("Escape");
          } else if (name === "plan") {
            await expect(
              page.getByRole("heading", { name: text.budgets, exact: true }),
            ).toBeVisible();
            await capture(
              page,
              output,
              `help-plan-income-${theme}.png`,
              page.getByRole("button", { name: text.income }),
            );
            await page.getByRole("button", { name: text.income }).click();
            await expect(
              page.getByRole("dialog", { name: text.incomeDialog }),
            ).toBeVisible();
            await capture(
              page,
              output,
              `help-plan-dialog-${theme}.png`,
              page.getByRole("dialog", { name: text.incomeDialog }),
            );
            await page.getByText(text.sync, { exact: true }).click();
            await capture(
              page,
              output,
              `help-plan-transactions-${theme}.png`,
              page.getByRole("dialog", { name: text.incomeDialog }),
            );
            await page.keyboard.press("Escape");
          } else if (name === "budget-guide") {
            const button = page
              .getByRole("button", { name: text.budgetAdd })
              .first();
            await capture(page, output, `help-budget-add-${theme}.png`, button);
            await button.click();
            const dialog = page.getByRole("dialog", { name: text.budgetAdd });
            await capture(
              page,
              output,
              `help-budget-form-${theme}.png`,
              dialog,
            );
            await capture(
              page,
              output,
              `help-budget-scope-${theme}.png`,
              dialog.getByLabel(text.budgetScope),
            );
            await page.keyboard.press("Escape");
          } else if (name === "transaction-guide") {
            const button = page
              .getByRole("button", { name: text.transactionAdd })
              .first();
            await capture(
              page,
              output,
              `help-transaction-add-${theme}.png`,
              button,
            );
            await button.click();
            const dialog = page.getByRole("dialog", {
              name: text.transactionAdd,
            });
            await capture(
              page,
              output,
              `help-transaction-form-${theme}.png`,
              dialog,
            );
            await page.keyboard.press("Escape");
            await capture(
              page,
              output,
              `help-transaction-search-${theme}.png`,
              page.getByPlaceholder(text.search),
            );
          } else {
            await capture(
              page,
              output,
              `help-review-start-${theme}.png`,
              page.getByRole("button", { name: text.review }),
            );
            await page.getByRole("button", { name: text.review }).click();
            await capture(
              page,
              output,
              `help-review-list-${theme}.png`,
              page.getByRole("row").filter({ hasText: text.purchase }),
            );
            await page
              .getByRole("row")
              .filter({ hasText: text.purchase })
              .click();
            const dialog = page.getByRole("dialog", { name: text.details });
            await capture(
              page,
              output,
              `help-review-assign-${theme}.png`,
              dialog.getByRole("button", { name: text.assign }),
            );
            await dialog.getByRole("button", { name: text.assign }).click();
            await page.getByText(text.category, { exact: true }).last().click();
            await capture(
              page,
              output,
              `help-review-save-${theme}.png`,
              dialog.getByRole("button", { name: text.save }),
            );
            await page.keyboard.press("Escape");
          }
          if (theme === "dark") {
            await page
              .getByRole("button", { name: text.light, exact: true })
              .click();
            await expect(page.locator("html")).toHaveAttribute(
              "data-theme",
              "light",
            );
          }
        }
      });
    }
    test("help plan details @help-plan-details", async ({ page, output }) => {
      const text = labels[locale];
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/budgets");
      await page
        .getByRole("button", {
          name: new RegExp(`^(${text.income}|${text.editIncome})$`),
        })
        .click();
      const incomeDialog = page.getByRole("dialog", {
        name: text.incomeDialog,
      });
      await incomeDialog.locator("input").first().fill("500000");
      await incomeDialog
        .getByRole("button", { name: text.save, exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: text.planGoals }),
      ).toBeVisible();
      for (const theme of ["dark", "light"] as const) {
        await capture(
          page,
          output,
          `help-plan-allocate-${theme}.png`,
          page.getByRole("button", { name: text.planGoals }),
        );
        await page.getByRole("button", { name: text.planGoals }).click();
        const dialog = page.getByRole("dialog", { name: text.planGoals });
        await dialog.getByLabel(text.holiday).fill("50000");
        await capture(
          page,
          output,
          `help-plan-goals-${theme}.png`,
          dialog.getByLabel(text.holiday),
        );
        await dialog
          .getByRole("button", { name: text.save, exact: true })
          .click();
        await expect(dialog).not.toBeVisible();
        await capture(
          page,
          output,
          `help-plan-summary-${theme}.png`,
          page.getByText(text.remaining, { exact: true }).locator(".."),
        );
        if (theme === "dark")
          await page
            .getByRole("button", { name: text.light, exact: true })
            .click();
      }
    });
  });
}
