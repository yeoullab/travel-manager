import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: [],
    include: ["tests/unit/**/*.test.ts"],
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: "test.apps.googleusercontent.com",
    },
    coverage: {
      provider: "v8",
      include: [
        "lib/auth/nonce.ts",
        "lib/profile/color-schema.ts",
        "lib/profile/colors.ts",
        "lib/schedule/apply-local-reorder.ts",
        "lib/schedule/apply-local-move.ts",
        "lib/schedule/schema.ts",
        "lib/maps/tm128.ts",
        "lib/maps/strip-html.ts",
        "lib/maps/rate-limit.ts",
        "lib/maps/provider.ts",
      ],
      exclude: ["lib/mocks/**", "**/*.d.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
