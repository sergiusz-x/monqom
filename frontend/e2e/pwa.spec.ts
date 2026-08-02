import { expect, test } from "@playwright/test";

test("exposes installable PWA metadata and a service worker", async ({
  page,
}) => {
  await page.goto("/");

  const manifestResponse = await page.request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );

  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({
    name: "Monqom",
    display: "standalone",
    start_url: "/",
  });
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ src: "/pwa-192-v3.png", sizes: "192x192" }),
      expect.objectContaining({ src: "/pwa-512-v3.png", sizes: "512x512" }),
    ]),
  );

  await expect
    .poll(() =>
      page.evaluate(async () =>
        Boolean(await navigator.serviceWorker.getRegistration()),
      ),
    )
    .toBe(true);
  await page.context().setOffline(true);
  await expect(
    page.getByText(
      "You are offline. Connect to the internet to access current data.",
    ),
  ).toBeVisible();
  await page.context().setOffline(false);
  await expect(
    page.getByText(
      "You are offline. Connect to the internet to access current data.",
    ),
  ).toBeHidden();
});
