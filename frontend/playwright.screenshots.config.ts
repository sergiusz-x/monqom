import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./screenshots",
  outputDir: resolve(
    process.env.SCREENSHOT_OUTPUT ?? ".",
    ".playwright-output",
  ),
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.SCREENSHOT_BASE_URL ?? "http://127.0.0.1:5179",
    trace: "retain-on-failure",
  },
});
