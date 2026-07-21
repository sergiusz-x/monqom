import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("monqom-language", "en"));
});

test("opens public authentication journeys from the landing page", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Monqom helps you easily stay in control of your spending and everyday finances.",
    }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page.getByRole("link", { name: "Register" }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(
    page.getByRole("heading", { name: "Create account" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
});

test("offers the password recovery journey", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();

  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(
    page.getByRole("heading", { name: "Forgot password" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
});
