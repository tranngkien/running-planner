import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      ADMIN_USERNAME: "admin",
      // bcrypt của "e2e-password"
      ADMIN_PASSWORD_HASH: process.env.E2E_ADMIN_PASSWORD_HASH ?? "",
      SESSION_SECRET: "e2e-session-secret-at-least-32-characters-long",
      ROUTE_SERVICE_MODE: "mock",
      NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY: "",
    },
  },
});
