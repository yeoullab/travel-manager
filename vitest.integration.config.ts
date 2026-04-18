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
    env: {
      NEXT_PUBLIC_SUPABASE_URL: localEnv.NEXT_PUBLIC_SUPABASE_URL ?? "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      SUPABASE_SERVICE_ROLE_KEY: localEnv.SUPABASE_SERVICE_ROLE_KEY ?? "",
      NEXT_PUBLIC_GOOGLE_CLIENT_ID:
        localEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "test.apps.googleusercontent.com",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
