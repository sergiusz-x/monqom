import { expect, test as base, type BrowserContext } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const sessions = new Map<
  string,
  Awaited<ReturnType<BrowserContext["storageState"]>>
>();

export const test = base.extend<{
  locale: "en" | "pl";
  theme: "light" | "dark";
  output: string;
}>({
  locale: ["en", { option: true }],
  theme: ["dark", { option: true }],
  output: async ({ locale }, runFixture) => {
    const root = process.env.SCREENSHOT_OUTPUT;
    if (!root) throw new Error("SCREENSHOT_OUTPUT is required");
    const output = resolve(root, locale);
    await mkdir(output, { recursive: true });
    await runFixture(output);
  },
  page: async ({ page, locale, theme }, runFixture) => {
    await page.addInitScript(
      ({ language, theme }) => {
        localStorage.setItem("monqom-language", language);
        if (!localStorage.getItem("monqom-theme")) {
          localStorage.setItem("monqom-theme", theme);
        }
      },
      { language: locale, theme },
    );
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    const session = sessions.get(locale);
    if (session) {
      await page.context().addCookies(session.cookies);
      await page.goto("/dashboard");
    } else {
      await page.goto("/login");
      await page.locator('input[type="email"]').fill(`${locale}@example.test`);
      await page
        .locator('input[type="password"]')
        .fill("Screenshot-demo-2026!");
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 120_000 });
      sessions.set(locale, await page.context().storageState());
    }
    await runFixture(page);
  },
});
export { expect };
