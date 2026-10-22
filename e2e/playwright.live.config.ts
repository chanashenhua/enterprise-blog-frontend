import { defineConfig, devices } from "@playwright/test";

// Opt-in suite: actual Gateway + PostgreSQL; search-workflow also requires local Elasticsearch.
export default defineConfig({
  testDir: "./live",
  outputDir: "./test-results/live",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.E2E_PORTAL_URL ?? "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium-live", use: { ...devices["Desktop Chrome"], channel: "chrome" } }],
});
