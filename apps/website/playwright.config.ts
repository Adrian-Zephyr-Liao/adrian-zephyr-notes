import { defineConfig, devices } from "@playwright/test";

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 2,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3104",
    colorScheme: "light",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13 Mini"], browserName: "chromium" } },
  ],
  webServer: [
    {
      name: "Fixture API",
      command: "node e2e/backend-fixture.mjs",
      url: "http://127.0.0.1:4311/health",
      reuseExistingServer: false,
    },
    {
      name: "Website",
      command: "node scripts/start-standalone.mjs",
      url: "http://127.0.0.1:3104",
      env: { BACKEND_API_BASE_URL: "http://127.0.0.1:4311", HOSTNAME: "127.0.0.1", PORT: "3104" },
      reuseExistingServer: false,
    },
  ],
});
