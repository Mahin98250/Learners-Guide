import { defineConfig, devices } from "@playwright/test";
import { assertLocalE2ETargets } from "./tests/e2e/helpers/environment";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";

if (process.env.E2E_MODE === "local") {
  assertLocalE2ETargets();
} else {
  const url = new URL(baseURL);
  if (!(url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost"))) {
    throw new Error(`[E2E safety] Public smoke must run against localhost/127.0.0.1, received ${url.origin}`);
  }
}

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  outputDir: "test-results",
  reportSlowTests: { max: 10, threshold: 5_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    navigationTimeout: 15_000,
    actionTimeout: 10_000,
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
});
