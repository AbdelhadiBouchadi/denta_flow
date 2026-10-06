import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

/**
 * End-to-end checks of flows Vitest cannot see: URL state, pagination and
 * the hydrated UI. They run against a dev server and a seeded database —
 * `npm run db:seed` first — and sign in with E2E_EMAIL / E2E_PASSWORD,
 * falling back to the bootstrap admin from `.env`.
 *
 * Read-only by design: no spec creates, edits or deletes clinic data.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL,
    locale: "fr-FR",
    timezoneId: "Africa/Casablanca",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: `${baseURL}/connexion`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
