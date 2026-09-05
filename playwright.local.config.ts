import { defineConfig } from "@playwright/test";
import path from "node:path";

export default defineConfig({
  testDir: "./tests/local",
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 12_000 },
  outputDir: "test-results/local-package",
  use: { baseURL: "http://127.0.0.1:4341", trace: "retain-on-failure" },
  webServer: {
    command: "npm run server",
    url: "http://127.0.0.1:4341/health",
    reuseExistingServer: false,
    env: { PORT: "4341", EMOTA_TRAIL_DATA_DIR: path.join(process.env.TEMP!, "opencode", `emota-package-${Date.now()}`) },
  },
});
