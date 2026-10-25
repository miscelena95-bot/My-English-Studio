import { defineConfig, devices } from "@playwright/test";

/**
 * Two app instances from the same production build:
 *  - "no-ai": no API key — verifies every non-AI feature and the honest fallbacks.
 *  - "ai": wired to a local test double of the Messages API (e2e/mock-anthropic.mjs).
 *  - "gemini": the same AI specs, through the Gemini provider and the same test double.
 * Run `npm run build` first (npm run test:e2e does this).
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { trace: "retain-on-failure" },
  webServer: [
    { command: "node e2e/mock-anthropic.mjs", port: 4010, reuseExistingServer: false, env: { MOCK_AI_PORT: "4010" } },
    { command: "npx next start -p 3201", port: 3201, reuseExistingServer: false, env: { DATABASE_PATH: "./data/e2e-noai.db", ANTHROPIC_API_KEY: "", GUARDIAN_API_KEY: "" } },
    { command: "npx next start -p 3202", port: 3202, reuseExistingServer: false, env: { DATABASE_PATH: "./data/e2e-ai.db", ANTHROPIC_API_KEY: "test-key", AI_BASE_URL: "http://127.0.0.1:4010", GUARDIAN_API_KEY: "" } },
    { command: "npx next start -p 3203", port: 3203, reuseExistingServer: false, env: { DATABASE_PATH: "./data/e2e-gemini.db", ANTHROPIC_API_KEY: "", GEMINI_API_KEY: "test-key", AI_BASE_URL: "http://127.0.0.1:4010", GUARDIAN_API_KEY: "" } },
  ],
  projects: [
    { name: "no-ai", testMatch: /\.noai\.spec\.ts$/, use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3201" } },
    { name: "mobile", testMatch: /\.mobile\.spec\.ts$/, use: { ...devices["Pixel 7"], baseURL: "http://localhost:3201" } },
    { name: "ai", testMatch: /\.withai\.spec\.ts$/, use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3202" } },
    { name: "gemini", testMatch: /\.withai\.spec\.ts$/, use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3203" } },
  ],
});
