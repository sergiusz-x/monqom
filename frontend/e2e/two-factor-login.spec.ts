import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("keeps credential autofill separate from the 2FA token", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("monqom-language", "en"));

  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;

    if (path.endsWith("/auth/me")) {
      await route.fulfill({ status: 401, json: { message: "Unauthorized" } });
      return;
    }

    if (path.endsWith("/auth/csrf-token")) {
      await route.fulfill({ json: { csrfToken: "test-csrf-token" } });
      return;
    }

    if (path.endsWith("/auth/login")) {
      await route.fulfill({
        json: { requiresTwoFactor: true, message: "2FA required" },
      });
      return;
    }

    if (path.endsWith("/auth/2fa/verify")) {
      await route.fulfill({
        json: {
          id: "user-1",
          email: "test@example.com",
          name: "Test user",
          emailVerified: true,
          totpEnabled: true,
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-01T00:00:00.000Z",
        },
      });
      return;
    }

    await route.fulfill({
      status: 404,
      json: { message: "Unexpected API request" },
    });
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill("test@example.com");
  await page.locator('input[type="password"]').fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();

  const otp = page.getByLabel("Authentication code");
  await expect(otp).toBeVisible();
  await expect(otp).toHaveAttribute("name", "otp");
  await expect(otp).toHaveAttribute("type", "tel");
  await expect(otp).toHaveAttribute("autocomplete", "one-time-code");
  await expect(otp).toHaveAttribute("inputmode", "numeric");
  await expect(otp).toHaveAttribute("data-1p-ignore", "true");
  await expect(otp).toHaveValue("");

  const username = page.locator('input[name="username"]');
  await expect(username).toHaveAttribute("autocomplete", "username");
  await expect(username).toHaveValue("test@example.com");

  await otp.fill("123456");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
