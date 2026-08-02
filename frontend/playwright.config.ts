import { defineConfig, devices } from "@playwright/test";

const port = 4173;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  workers: 4,
  use: {
    baseURL: "http://127.0.0.1:" + port,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port " + port,
    url: "http://127.0.0.1:" + port,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "iphone-13-chromium",
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
  ],
});
