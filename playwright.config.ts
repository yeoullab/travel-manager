import { defineConfig, devices } from "@playwright/test";

// Playwright 는 .env* 를 자동 로드하지 않으므로 Node 20.12+ process.loadEnvFile 로 주입
try {
  process.loadEnvFile(".env.local");
} catch {
  // CI 환경 등 파일 없을 때 무시
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  globalSetup: require.resolve("./tests/e2e/global-setup"),
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "anonymous",
      use: { ...devices["Desktop Chrome"] },
      testMatch: ["login.spec.ts"],
    },
    {
      name: "alice",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/alice.json",
      },
      testMatch: [
        "schedule-crud.spec.ts",
        "schedule-category-flow.spec.ts",
        "drag-same-day.spec.ts",
        "drag-cross-day.spec.ts",
        "resize-with-items.spec.ts",
        "place-search.spec.ts",
      ],
    },
    {
      name: "partner-dual",
      use: { ...devices["Desktop Chrome"] },
      testMatch: ["partner-realtime.spec.ts", "share-toggle.spec.ts"],
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ALLOW_TEST_SIGNIN: "true",
    },
  },
});
