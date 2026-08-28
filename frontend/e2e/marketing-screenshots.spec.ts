import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const workspaceId = "marketing-workspace";
const outputDirectory = resolve(
  import.meta.dirname,
  "../public/marketing/screenshots",
);
const createdAt = "2026-08-01T09:00:00.000Z";
const transactions = [
  [
    "transaction-1",
    "groceries",
    "card",
    286.4,
    "2026-08-24",
    "Weekly groceries",
    ["home"],
  ],
  [
    "transaction-2",
    "transport",
    "card",
    82,
    "2026-08-23",
    "City transport",
    ["commute"],
  ],
  [
    "transaction-3",
    "restaurants",
    "cash",
    64.5,
    "2026-08-22",
    "Dinner with friends",
    ["social"],
  ],
  [
    "transaction-4",
    "subscriptions",
    "card",
    39.99,
    "2026-08-21",
    "Music subscription",
    ["recurring"],
  ],
  [
    "transaction-5",
    "health",
    "card",
    118,
    "2026-08-20",
    "Pharmacy",
    ["health"],
  ],
].map(([id, categoryId, paymentSourceId, amount, date, description, tags]) => ({
  id,
  workspace_id: workspaceId,
  category_id: categoryId,
  payment_source_id: paymentSourceId,
  type: "expense",
  amount,
  currency: "PLN",
  date,
  description,
  notes: null,
  tags,
  created_at: createdAt,
  updated_at: createdAt,
}));

test.skip(
  !process.env.MARKETING_SCREENSHOTS,
  "Marketing assets are generated only by the explicit local command.",
);

test.beforeEach(async ({ page }) => {
  await mkdir(outputDirectory, { recursive: true });
  await page.addInitScript(() => {
    localStorage.setItem("monqom-language", "en");
    localStorage.setItem("monqom-theme", "dark");
  });
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/me"))
      return route.fulfill({
        json: {
          id: "marketing-user",
          email: "alex@example.test",
          name: "Alex Morgan",
          locale: "en",
          emailVerified: true,
          totpEnabled: false,
          createdAt,
          updatedAt: createdAt,
        },
      });
    if (path.endsWith("/workspaces"))
      return route.fulfill({
        json: [
          {
            id: workspaceId,
            name: "Personal",
            timezone: "Europe/Warsaw",
            baseCurrency: "PLN",
            lastPaymentSourceId: "card",
            baseCurrencyLocked: false,
          },
        ],
      });
    if (path.endsWith(`/workspaces/${workspaceId}/categories`))
      return route.fulfill({
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
          {
            id: "restaurants",
            name: "Restaurants",
            system_key: null,
            icon: null,
            parent_id: null,
            sort_order: 2,
            children: [],
          },
          {
            id: "subscriptions",
            name: "Subscriptions",
            system_key: null,
            icon: null,
            parent_id: null,
            sort_order: 3,
            children: [],
          },
          {
            id: "health",
            name: "Health",
            system_key: null,
            icon: null,
            parent_id: null,
            sort_order: 4,
            children: [],
          },
        ],
      });
    if (path.endsWith(`/workspaces/${workspaceId}/tags`))
      return route.fulfill({
        json: ["home", "commute", "social", "recurring", "health"],
      });
    if (path.endsWith(`/workspaces/${workspaceId}/payment-sources`))
      return route.fulfill({
        json: [
          {
            id: "card",
            workspace_id: workspaceId,
            name: "Daily card",
            type: "debit_card",
            system_key: null,
            is_archived: false,
            archived_at: null,
            created_at: createdAt,
            updated_at: createdAt,
          },
          {
            id: "cash",
            workspace_id: workspaceId,
            name: "Cash",
            type: "cash",
            system_key: "cash",
            is_archived: false,
            archived_at: null,
            created_at: createdAt,
            updated_at: createdAt,
          },
        ],
      });
    if (path.endsWith(`/workspaces/${workspaceId}/transactions`))
      return route.fulfill({
        json: {
          data: transactions,
          total: transactions.length,
          limit: 20,
          offset: 0,
        },
      });
    if (path.endsWith(`/workspaces/${workspaceId}/budgets/progress`))
      return route.fulfill({
        json: [
          {
            category_id: "groceries",
            category_name: "Groceries",
            category_system_key: null,
            budget_amount: 600,
            limit: 600,
            spent: 486,
            remaining: 114,
            percentage: 81,
          },
          {
            category_id: "transport",
            category_name: "Transport",
            category_system_key: null,
            budget_amount: 220,
            limit: 220,
            spent: 198,
            remaining: 22,
            percentage: 90,
          },
          {
            category_id: "restaurants",
            category_name: "Restaurants",
            category_system_key: null,
            budget_amount: 180,
            limit: 180,
            spent: 217,
            remaining: -37,
            percentage: 120,
          },
        ],
      });
    if (path.endsWith(`/workspaces/${workspaceId}/budgets`))
      return route.fulfill({
        json: [
          {
            id: "budget-1",
            category_id: "groceries",
            amount: 600,
            currency: "PLN",
            year: 2026,
            month: 8,
          },
          {
            id: "budget-2",
            category_id: "transport",
            amount: 220,
            currency: "PLN",
            year: 2026,
            month: 8,
          },
          {
            id: "budget-3",
            category_id: "restaurants",
            amount: 180,
            currency: "PLN",
            year: 2026,
            month: 8,
          },
        ],
      });
    if (path.endsWith(`/workspaces/${workspaceId}/dashboard`))
      return route.fulfill({
        json: {
          summary: {
            month: "2026-08",
            currency: "PLN",
            current_total: 1268,
            previous_total: 1094,
            change_amount: 174,
            change_percentage: 15.9,
            direction: "up",
          },
          category_breakdown: {
            month: "2026-08",
            currency: "PLN",
            total_spending: 1268,
            categories: [
              {
                category_id: "groceries",
                category_name: "Groceries",
                category_system_key: null,
                category_color: "#8b5cf6",
                amount: 486,
                percentage: 38.3,
              },
              {
                category_id: "transport",
                category_name: "Transport",
                category_system_key: null,
                category_color: "#14b8a6",
                amount: 198,
                percentage: 15.6,
              },
              {
                category_id: "restaurants",
                category_name: "Restaurants",
                category_system_key: null,
                category_color: "#f59e0b",
                amount: 217,
                percentage: 17.1,
              },
            ],
          },
          spending_trend: [
            { month: "2026-03", total: 890 },
            { month: "2026-04", total: 1040 },
            { month: "2026-05", total: 940 },
            { month: "2026-06", total: 1180 },
            { month: "2026-07", total: 1094 },
            { month: "2026-08", total: 1268 },
          ],
          recent_transactions: transactions,
        },
      });
    return route.fulfill({
      status: 404,
      json: { message: "Unexpected marketing fixture request" },
    });
  });
});

test("@marketing captures reproducible product screenshots", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [route, name, heading] of [
    ["/dashboard", "dashboard-dark.png", "Dashboard"],
    ["/transactions", "transactions-dark.png", "Transactions"],
    ["/budgets", "budgets-dark.png", "Budgets"],
  ] as const) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await page.addStyleTag({
      content:
        "aside { display: none !important; } main { width: 100% !important; }",
    });
    await page.screenshot({ path: resolve(outputDirectory, name) });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: resolve(outputDirectory, "mobile-dashboard-dark.png"),
  });
});
