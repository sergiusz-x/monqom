import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });
const token = "mqic_browser_fixture_secret_not_a_real_credential";
const workspaceId = "workspace-1";
type Credential = {
  id: string;
  token_prefix: string;
  status: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  scopes: string[];
  category_allowlist_enabled: boolean;
  category_ids: string[];
  payment_source_allowlist_enabled: boolean;
  payment_source_ids: string[];
  cidr_allowlist_enabled: boolean;
  allowed_cidrs: string[];
};

async function setup(page: Page, role = "owner") {
  let credentials: Credential[] = [];
  const mutations: Array<{
    path: string;
    body: Record<string, unknown>;
    csrf?: string;
  }> = [];
  await page.addInitScript(() => localStorage.setItem("monqom-language", "en"));
  await page.route("**/version.json", (route) =>
    route.fulfill({ json: { version: "v1.4.0", sha: "fixture" } }),
  );
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/auth/me"))
      return route.fulfill({
        json: {
          id: "user-1",
          name: "Ada",
          email: "ada@example.com",
          locale: "en",
          emailVerified: true,
          totpEnabled: false,
          hideSalaryAmounts: false,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      });
    if (path.endsWith("/auth/csrf-token"))
      return route.fulfill({ json: { csrfToken: "csrf-fixture" } });
    if (path.endsWith("/workspaces"))
      return route.fulfill({
        json: [
          {
            id: workspaceId,
            name: "Home",
            timezone: "UTC",
            baseCurrency: "PLN",
            role,
            lastPaymentSourceId: null,
            baseCurrencyLocked: false,
          },
        ],
      });
    if (path.endsWith("/categories"))
      return route.fulfill({
        json:
          new URL(request.url()).searchParams.get("type") === "income"
            ? []
            : [
                {
                  id: "cat-1",
                  name: "Food",
                  system_key: null,
                  parent_id: null,
                  icon: null,
                  color: null,
                  sort_order: 0,
                  children: [],
                },
              ],
      });
    if (path.endsWith("/payment-sources"))
      return route.fulfill({
        json: [
          {
            id: "source-1",
            name: "Bank",
            type: "bank",
            system_key: null,
            currency: "PLN",
          },
        ],
      });
    if (path.endsWith("/integrations") && request.method() === "GET")
      return route.fulfill({
        json: credentials.length
          ? [
              {
                id: "integration-1",
                name: "expense-importer",
                status: "active",
                created_at: "2026-01-01T00:00:00Z",
                created_by: { id: "user-1", name: "Ada" },
                credentials,
              },
            ]
          : [],
      });
    if (path.includes("/integrations") && request.method() !== "GET") {
      const body = request.postDataJSON() as Record<string, unknown> | null;
      mutations.push({
        path,
        body: body ?? {},
        csrf: request.headers()["x-csrf-token"],
      });
      if (path.endsWith("/revoke")) {
        credentials = credentials.map((item) => ({
          ...item,
          status: "revoked",
          revoked_at: "2026-09-04T12:00:00Z",
        }));
        return route.fulfill({ json: { revoked: true } });
      }
      if (request.method() === "DELETE") {
        credentials = [];
        return route.fulfill({ json: { deleted: true } });
      }
      const id = path.endsWith("/rotate") ? "credential-2" : "credential-1";
      if (id === "credential-2")
        credentials = credentials.map((item) => ({
          ...item,
          status: "revoked",
          revoked_at: "2026-09-04T12:00:00Z",
        }));
      credentials.unshift({
        id,
        token_prefix: id,
        status: "active",
        created_at: "2026-09-04T12:00:00Z",
        expires_at: body?.expires_at as string,
        revoked_at: null,
        last_used_at: null,
        scopes: (body?.scopes as string[]) ?? [],
        category_allowlist_enabled: Boolean(body?.category_allowlist_enabled),
        category_ids: (body?.category_ids as string[]) ?? [],
        payment_source_allowlist_enabled: Boolean(
          body?.payment_source_allowlist_enabled,
        ),
        payment_source_ids: (body?.payment_source_ids as string[]) ?? [],
        cidr_allowlist_enabled: Boolean(body?.cidr_allowlist_enabled),
        allowed_cidrs: (body?.allowed_cidrs as string[]) ?? [],
      });
      return route.fulfill({
        status: id === "credential-1" ? 201 : 200,
        json: {
          integration_id: "integration-1",
          credential_id: id,
          token,
          token_prefix: id,
          expires_at: body?.expires_at,
        },
      });
    }
    return route.fulfill({
      status: 404,
      json: { message: "Unexpected fixture route" },
    });
  });
  await page.goto("/settings");
  return mutations;
}

async function fillCreate(page: Page) {
  await page.getByRole("button", { name: "Integrations", exact: true }).click();
  await page.getByRole("button", { name: "Add integration" }).click();
  await page.getByLabel("Integration name").fill("expense-importer");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("checkbox", { checked: false })).toHaveCount(6);
  await page.getByRole("checkbox", { name: /^Create transactions/ }).check();
  for (let count = 0; count < 4; count++)
    await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Current password").fill("synthetic-password");
  await page.getByRole("button", { name: "Create key", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Save your integration key" }),
  ).toBeVisible();
}

test("creates, inspects, replaces and revokes with no secret in browser storage or query caches", async ({
  page,
}, testInfo) => {
  const mutations = await setup(page);
  const diagnostics: string[] = [];
  page.on("console", (message) => diagnostics.push(message.text()));
  page.on("pageerror", (error) => diagnostics.push(error.message));
  await fillCreate(page);
  const secret = page.getByRole("dialog", {
    name: "Save your integration key",
  });
  await expect(secret).not.toContainText(token);
  await page.screenshot({
    path: testInfo.outputPath("secret-dialog.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Show key" }).click();
  await expect(secret).toContainText(token);
  expect(mutations[0]?.body.scopes).toEqual(["transactions:create"]);
  expect(mutations[0]?.csrf).toBe("csrf-fixture");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByText(token)).toHaveCount(0);
  await page.getByRole("button", { name: "View details" }).click();
  await expect(page.getByRole("dialog")).toContainText("Key version history");
  await expect(page.getByRole("dialog")).not.toContainText(token);
  await page.getByRole("button", { name: "Close details" }).click();
  await page.getByRole("button", { name: "Replace key" }).click();
  for (let count = 0; count < 5; count++)
    await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Current password").fill("synthetic-password");
  await page.getByRole("button", { name: "Replace key", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Save your integration key" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const active = page
    .locator("li")
    .filter({ has: page.getByText("credential-2", { exact: true }) });
  await active.getByRole("button", { name: "Revoke", exact: true }).click();
  await page.getByLabel("Current password").fill("synthetic-password");
  await page.getByRole("button", { name: "Revoke key" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(mutations.map((item) => item.csrf)).toEqual([
    "csrf-fixture",
    "csrf-fixture",
    "csrf-fixture",
  ]);
  const retained = await page.evaluate(async () => {
    // The running application's own singleton proves that neither cache retained issuance data.
    const modulePath = "/src/lib/query-client.ts";
    const module = await import(modulePath);
    return JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
      queries: module.queryClient
        .getQueryCache()
        .getAll()
        .map((query: { state: unknown }) => query.state),
      mutations: module.queryClient
        .getMutationCache()
        .getAll()
        .map((mutation: { state: unknown }) => mutation.state),
    });
  });
  expect(retained).not.toContain(token);
  expect(diagnostics.join("\n")).not.toContain(token);
  expect(page.url()).not.toContain(token);
});

test("keeps dialogs within mobile screens and supports keyboard focus, labels and Escape", async ({
  page,
  isMobile,
}, testInfo) => {
  await setup(page);
  await page.getByRole("button", { name: "Integrations", exact: true }).click();
  const add = page.getByRole("button", { name: "Add integration" });
  await add.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("credential-form.png"),
    fullPage: true,
  });
  await expect(page.getByLabel("Integration name")).toBeVisible();
  await expect(page.getByLabel("Valid until")).toHaveAttribute("type", "date");
  for (let index = 0; index < 9; index++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  if (isMobile)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(add).toBeFocused();
  await fillCreate(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(token)).toHaveCount(0);
});

test("hides settings from workspace members", async ({ page }) => {
  const calls = await setup(page, "member");
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Integrations", exact: true }),
  ).toHaveCount(0);
  expect(calls).toEqual([]);
});

test("keeps every setup step usable on a small screen and sends a local end-of-day expiry", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const mutations = await setup(page);
  await page.getByRole("button", { name: "Integrations", exact: true }).click();
  await page.getByRole("button", { name: "Add integration" }).click();
  const dialog = page.getByRole("dialog");
  const date = await page.evaluate(() => {
    const value = new Date();
    value.setDate(value.getDate() + 30);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  });
  await page.getByLabel("Integration name").fill("expense-importer");
  await page.getByLabel("Valid until").fill(date);
  for (let step = 0; step < 6; step++) {
    const button = page.getByRole("button", {
      name: step === 5 ? "Create key" : "Next",
      exact: true,
    });
    const bounds = await dialog.boundingBox();
    const footer = await button.boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(568);
    expect(footer!.y + footer!.height).toBeLessThanOrEqual(568);
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    if (step === 1) {
      const header = await dialog.locator("header").boundingBox();
      await dialog
        .locator(".overflow-y-auto")
        .evaluate((el) => (el.scrollTop = el.scrollHeight));
      expect(await dialog.locator("header").boundingBox()).toEqual(header);
    }
    if (step === 2 || step === 3) {
      await page
        .getByRole("radio", { name: "Only selected resources" })
        .check();
      await page
        .getByLabel("Search by name")
        .fill(step === 2 ? "food" : "bank");
      await page
        .getByRole("checkbox", {
          name: step === 2 ? "Food" : "Bank",
          exact: true,
        })
        .check();
      await expect(dialog).not.toContainText(step === 2 ? "cat-1" : "source-1");
    }
    await page.screenshot({
      path: testInfo.outputPath(`setup-step-${step + 1}.png`),
    });
    if (step < 5) await button.click();
    else {
      await page.getByLabel("Current password").fill("synthetic-password");
      await button.click();
    }
  }
  await expect(
    page.getByRole("dialog", { name: "Save your integration key" }),
  ).toBeVisible();
  const closeSecret = await page
    .getByRole("button", { name: "Close", exact: true })
    .boundingBox();
  expect(closeSecret!.y + closeSecret!.height).toBeLessThanOrEqual(568);
  await page.screenshot({
    path: testInfo.outputPath("small-secret-dialog.png"),
  });
  expect(
    await page.evaluate((value) => {
      const expiry = new Date(value);
      return [
        expiry.getHours(),
        expiry.getMinutes(),
        expiry.getSeconds(),
        expiry.getMilliseconds(),
      ];
    }, mutations[0]!.body.expires_at as string),
  ).toEqual([23, 59, 59, 999]);
});
