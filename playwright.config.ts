import { defineConfig, devices } from "@playwright/test";
import bcrypt from "bcryptjs";

const PORT = 3100;
export const E2E_USER = "admin";
export const E2E_PASSWORD = "e2e-password";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "vi-VN",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      ADMIN_USERNAME: E2E_USER,
      ADMIN_PASSWORD_HASH: bcrypt.hashSync(E2E_PASSWORD, 4),
      SESSION_SECRET: "e2e-session-secret-at-least-32-characters-long",
      ROUTE_SERVICE_MODE: "mock",
      NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY: "",
    },
  },
});
