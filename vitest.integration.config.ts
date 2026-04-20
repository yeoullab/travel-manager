import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

const localEnv = loadEnv("", process.cwd(), "");

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 20_000,
    fileParallelism: false,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: localEnv.NEXT_PUBLIC_SUPABASE_URL ?? "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      SUPABASE_SERVICE_ROLE_KEY: localEnv.SUPABASE_SERVICE_ROLE_KEY ?? "",
      NEXT_PUBLIC_GOOGLE_CLIENT_ID:
        localEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "test.apps.googleusercontent.com",
      NEXT_PUBLIC_NAVER_MAP_CLIENT_ID: localEnv.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID ?? "test-naver-map",
      NAVER_SEARCH_CLIENT_ID: localEnv.NAVER_SEARCH_CLIENT_ID ?? "test-naver-search",
      NAVER_SEARCH_CLIENT_SECRET: localEnv.NAVER_SEARCH_CLIENT_SECRET ?? "test-naver-search-secret",
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: localEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "test-google-public",
      GOOGLE_MAPS_SERVER_KEY: localEnv.GOOGLE_MAPS_SERVER_KEY ?? "test-google-server",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
