import { defineConfig, devices } from "@playwright/test";
import { APP_URL, E2E, laravelEnv } from "./e2e/env";

/**
 * `pnpm e2e`: builds Next, recreates the `landing_e2e` database and runs the six scenarios
 * against Laravel :8011 + Next :3100 (the dev servers on :8010 / :3000 are not used).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: APP_URL,
    locale: "ar-EG",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // Fresh database first (create → migrate:fresh + themes), then serve.
      command: [
        `"${E2E.php}" ../front/e2e/prepare-db.php ${E2E.database}`,
        `"${E2E.php}" artisan migrate:fresh --force --seed --seeder=ThemeSeeder`,
        `"${E2E.php}" artisan serve --host=127.0.0.1 --port=${E2E.laravelPort}`,
      ].join(" && "),
      cwd: E2E.backDir,
      env: laravelEnv,
      url: `http://127.0.0.1:${E2E.laravelPort}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `pnpm exec next start -p ${E2E.nextPort}`,
      cwd: E2E.frontDir,
      env: { LARAVEL_INTERNAL_URL: `http://127.0.0.1:${E2E.laravelPort}`, PUBLIC_SCHEME: "http", PUBLIC_PORT: String(E2E.nextPort) },
      url: `http://127.0.0.1:${E2E.nextPort}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
