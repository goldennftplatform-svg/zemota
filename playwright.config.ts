import { defineConfig, devices } from "@playwright/test";

/**
 * Stress / stability harness for EMOTA (not run in CI by default).
 * After deploy: `npx playwright install chromium` then `npm run test:stress`
 * Local bigboard load: `npm run build && npm run server` → default base http://127.0.0.1:3333
 * Override with PLAYWRIGHT_BASE_URL for preview/deployed bundles.
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
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3333",
    trace: "off",
  },
  projects: [{ name: "chromium" }],
});
