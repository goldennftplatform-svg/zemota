import { defineConfig, devices } from "@playwright/test";

/**
 * Stress / stability harness for EMOTA (not run in CI by default).
 * After deploy: `npx playwright install chromium` then `npm run test:stress`
 * Set PLAYWRIGHT_BASE_URL to your deployed origin if not using local preview.
 */
export default defineConfig({
  testDir: "./tests/stress",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 900_000,
  expect: { timeout: 20_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173",
    trace: "off",
  },
  projects: [{ name: "chromium" }],
});
