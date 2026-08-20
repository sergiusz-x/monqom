import { expect, test } from "@playwright/test";

const workspaceId = "workspace-1";

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("monqom-language", "en"));

  await page.route("**/version.json", async (route) => {
    await route.fulfill({
      json: { version: "v1.4.0", sha: "1234567890abcdef" },
    });
  });

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

    if (path.endsWith("/auth/csrf-token")) {
      await route.fulfill({ json: { csrfToken: "test-csrf-token" } });
      return;
    }

    if (path.endsWith("/auth/logout")) {
      await route.fulfill({ json: {} });
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

    if (path.endsWith(`/workspaces/${workspaceId}/goals`)) {
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

test("renders a readable dashboard without duplicated chart series", async ({
  page,
}, testInfo) => {
  await page.goto("/dashboard");

  await expect(
    page.getByRole("heading", { name: "Spending trend" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Spending by category" }),
  ).toBeVisible();
  await expect(page.locator(".recharts-legend-wrapper")).toHaveCount(0);
  await expect(
    page.getByRole("list", { name: "Monthly spending amounts" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Spending by category" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("list", { name: "Monthly spending amounts" })
      .getByRole("listitem"),
  ).toHaveCount(6);

  await page.screenshot({
    path: testInfo.outputPath("dashboard.png"),
    fullPage: true,
  });
});

test("opens the transaction form from primary navigation", async ({ page }) => {
  await page.goto("/dashboard");

  await page.getByRole("button", { name: "Add transaction" }).click();

  await expect(
    page.getByRole("dialog", { name: "Add transaction" }),
  ).toBeVisible();
});

test("keeps an authenticated session after a page reload", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.reload();

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add transaction" }),
  ).toBeVisible();
});

test("opens savings goals inside the authenticated workspace shell", async ({
  page,
}) => {
  await page.goto("/dashboard");

  await page.getByRole("link", { name: "Goals" }).click();

  await expect(page).toHaveURL(/\/goals$/);
  await expect(
    page.getByRole("heading", { name: "Savings goals", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("No savings goals yet")).toBeVisible();
  if ((page.viewportSize()?.width ?? 1280) < 768) {
    await expect(
      page.getByRole("navigation", { name: "Mobile navigation" }),
    ).toBeVisible();
  } else {
    await expect(
      page.getByRole("complementary", { name: "Main navigation" }),
    ).toBeVisible();
  }
});

test("lets a mobile user change theme and log out from settings", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");

  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(
    page.getByRole("main").getByText("test@example.com"),
  ).toBeVisible();
  await expect(page.getByText("Version v1.4.0")).toBeVisible();

  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  const dismissNotification = page.getByRole("button", {
    name: "Dismiss notification",
  });
  if (await dismissNotification.isVisible()) {
    await dismissNotification.click();
  }

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("keeps iPhone form controls readable without Safari input zoom", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add transaction" }).click();

  const form = page.getByRole("dialog", { name: "Add transaction" });
  await expect(form).toBeVisible();

  for (const control of [
    form.getByLabel("Description"),
    form.getByLabel("Date"),
    form.getByLabel("Account or wallet"),
  ]) {
    await expect(control).toHaveCSS("font-size", "16px");
  }

  await form.getByLabel("Category").click();
  await expect(page.getByLabel("Search categories")).toHaveCSS(
    "font-size",
    "16px",
  );

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("keeps the dashboard usable on a narrow screen", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");

  await expect(
    page.getByRole("button", { name: "Previous month" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Next month" })).toBeVisible();

  const trend = page.getByRole("list", { name: "Monthly spending amounts" });
  await expect(trend).toBeVisible();
  await trend.getByRole("listitem").last().click();
  await expect(trend.getByRole("listitem").last()).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
  await page.screenshot({
    path: testInfo.outputPath("dashboard-mobile.png"),
    fullPage: true,
  });
});

test("keeps the remaining authenticated empty states usable on a narrow screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const [path, heading] of [
    ["/transactions", "Transactions"],
    ["/budgets", "Budgets"],
    ["/payment-sources", "Payment sources"],
    ["/settings", "Settings"],
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
  }
});
