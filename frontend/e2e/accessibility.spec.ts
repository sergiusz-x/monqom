import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

const workspaceId = "workspace-1";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("monqom-language", "en"));

  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;

    if (path.endsWith("/auth/me")) {
      await route.fulfill({
        json: {
          id: "user-1",
          email: "test@example.com",
          name: "Test user",
          locale: "en",
          emailVerified: true,
          totpEnabled: false,
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-01T00:00:00.000Z",
        },
      });
      return;
    }

    if (path.endsWith("/workspaces")) {
      await route.fulfill({
        json: [
          {
            id: workspaceId,
            name: "Home",
            timezone: "Europe/Warsaw",
            baseCurrency: "PLN",
            lastPaymentSourceId: null,
            baseCurrencyLocked: false,
          },
        ],
      });
      return;
    }

    if (path.endsWith(`/workspaces/${workspaceId}/categories`)) {
      await route.fulfill({
        json: [
          {
            id: "groceries",
            name: "Groceries",
            system_key: null,
            icon: null,
            parent_id: null,
            sort_order: 0,
            children: [],
          },
          {
            id: "transport",
            name: "Transport",
            system_key: null,
            icon: null,
            parent_id: null,
            sort_order: 1,
            children: [],
          },
        ],
      });
      return;
    }

    if (path.endsWith(`/workspaces/${workspaceId}/tags`)) {
      await route.fulfill({ json: [] });
      return;
    }

    if (path.endsWith(`/workspaces/${workspaceId}/payment-sources`)) {
      await route.fulfill({ json: [] });
      return;
    }

    if (path.endsWith(`/workspaces/${workspaceId}/transactions`)) {
      await route.fulfill({
        json: { data: [], total: 0, limit: 20, offset: 0 },
      });
      return;
    }

    if (path.endsWith(`/workspaces/${workspaceId}/budgets/progress`)) {
      await route.fulfill({ json: [] });
      return;
    }

    if (path.endsWith(`/workspaces/${workspaceId}/budgets`)) {
      await route.fulfill({ json: [] });
      return;
    }

    if (path.endsWith(`/workspaces/${workspaceId}/dashboard`)) {
      await route.fulfill({
        json: {
          summary: {
            month: "2026-07",
            currency: "PLN",
            current_total: 126500,
            previous_total: 98000,
            change_amount: 28500,
            change_percentage: 29.1,
            direction: "up",
          },
          category_breakdown: {
            month: "2026-07",
            currency: "PLN",
            total_spending: 126500,
            categories: [
              {
                category_id: "groceries",
                category_name: "Groceries",
                category_system_key: null,
                category_color: "#4f46e5",
                amount: 74500,
                percentage: 58.9,
              },
              {
                category_id: "transport",
                category_name: "Transport",
                category_system_key: null,
                category_color: "#0f766e",
                amount: 52000,
                percentage: 41.1,
              },
            ],
          },
          spending_trend: [
            { month: "2026-02", total: 62000 },
            { month: "2026-03", total: 81000 },
            { month: "2026-04", total: 58000 },
            { month: "2026-05", total: 110000 },
            { month: "2026-06", total: 98000 },
            { month: "2026-07", total: 126500 },
          ],
          recent_transactions: [],
        },
      });
      return;
    }

    await route.fulfill({
      status: 404,
      json: { message: "Unexpected API request" },
    });
  });
});

test("dashboard page has no accessibility violations", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Spending trend" })).toBeVisible();

  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  expect(accessibilityScanResults.violations).toEqual([]);
});

test("transactions page has no accessibility violations", async ({ page }) => {
  await page.goto("/transactions");
  await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();

  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  expect(accessibilityScanResults.violations).toEqual([]);
});

test("budgets page has no accessibility violations", async ({ page }) => {
  await page.goto("/budgets");
  await expect(page.getByRole("heading", { name: "Budgets" })).toBeVisible();

  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  expect(accessibilityScanResults.violations).toEqual([]);
});

test("payment sources page has no accessibility violations", async ({ page }) => {
  await page.goto("/payment-sources");
  await expect(page.getByRole("heading", { name: "Payment sources" })).toBeVisible();

  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  expect(accessibilityScanResults.violations).toEqual([]);
});

test("settings page has no accessibility violations", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  expect(accessibilityScanResults.violations).toEqual([]);
});