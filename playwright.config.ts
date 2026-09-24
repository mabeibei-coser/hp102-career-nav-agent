import { defineConfig, devices } from "@playwright/test";

const PORT = 3102;
const BASE_URL = `http://localhost:${PORT}`;
const FAIL_PORT = 3103;
const FAIL_BASE_URL = `http://localhost:${FAIL_PORT}`;

const E2E_ENV: Record<string, string> = {
  ...(process.env as Record<string, string>),
  E2E_MOCK_MODE: "true",
  DB_PATH: "./data/e2e.db",
  RESUME_DIR: "./data/e2e-resumes",
  SESSION_SECRET: "e2e-test-session-secret-32chars-min",
  BANANAROUTER_API_KEY: "test-key",
  BANANAROUTER_BASE_URL: "http://127.0.0.1:9",
  BANANAROUTER_MODEL: "mock",
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  reporter: [["html", { open: "never" }], ["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",

  use: {
    baseURL: BASE_URL,
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "Desktop Chrome",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /ui-report-fail\.spec\.ts/,
    },
    {
      name: "iPhone 14",
      use: { ...devices["iPhone 14"] },
      testIgnore: /ui-report-fail\.spec\.ts/,
    },
    {
      name: "Pixel 7",
      use: {
        ...devices["Pixel 7"],
        permissions: ["microphone"],
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
          ],
        },
      },
      testIgnore: /ui-report-fail\.spec\.ts/,
    },
    {
      name: "report-fail",
      use: { ...devices["Desktop Chrome"], baseURL: FAIL_BASE_URL },
      testMatch: /ui-report-fail\.spec\.ts/,
    },
  ],

  webServer: [
    {
      command: `npm run dev -- -p ${PORT}`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: E2E_ENV,
    },
    {
      command: `npm run dev -- -p ${FAIL_PORT}`,
      url: FAIL_BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...E2E_ENV,
        NEXT_DIST_DIR: ".next-e2e-fail",
        E2E_MOCK_REPORT_FAIL: "true",
        DB_PATH: "./data/e2e-fail.db",
        RESUME_DIR: "./data/e2e-fail-resumes",
      },
    },
  ],
});
