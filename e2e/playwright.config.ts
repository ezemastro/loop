import { defineConfig, devices } from "@playwright/test";

/**
 * E2E Test Configuration for Loop
 *
 * How to run locally:
 * 1. Start the dev server: cd server/api && npm run dev
 * 2. (Optional) Start admin dev server: cd adminClient && npm run dev
 * 3. (Optional) Start landing dev server: cd landing && npm run dev
 * 4. Run tests: npx playwright test
 *
 * All tests use the API directly for setup/teardown.
 * Database is cleaned between test files via global teardown.
 */

const API_URL = process.env.API_URL || "http://localhost:3000";
const ADMIN_URL = process.env.ADMIN_URL || "http://localhost:5173";
const LANDING_URL = process.env.LANDING_URL || "http://localhost:4321";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // DB tests must run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for DB isolation
  reporter: [["list"], ["html", { outputFolder: "playwright-report" }]],
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: API_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "api",
      testMatch: /.*\.api\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: API_URL,
      },
    },
    {
      name: "admin",
      testMatch: /.*\.admin\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: ADMIN_URL,
      },
      dependencies: process.env.CI ? [] : [],
    },
    {
      name: "landing",
      testMatch: /.*\.landing\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: LANDING_URL,
      },
    },
    {
      name: "fullstack",
      testMatch: /.*\.fullstack\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: API_URL,
      },
    },
  ],
});
