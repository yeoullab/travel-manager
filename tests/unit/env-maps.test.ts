import { describe, it, expect } from "vitest";

describe("env schema — maps (phase 3)", () => {
  it("Maps 5 키가 모두 optional — 미설정 환경에서도 import 성공", async () => {
    const mod = await import("@/lib/env");
    // 스키마가 .optional() 이라 env 객체에 key 가 없거나 undefined 여도 OK.
    // Pre-flight 전에도 부팅 가능해야 한다는 요구사항을 회귀 방지.
    expect(mod.env).toBeDefined();
    expect(mod.envSchema).toBeDefined();
  });

  it("envSchema 는 Maps 5 키 + test signin 2 키를 모두 optional 로 허용한다", async () => {
    const { envSchema } = await import("@/lib/env");
    // SUPABASE_SERVICE_ROLE_KEY 는 Phase 1 부터 필수 유지. 테스트 env 에서 이미 세팅됨.
    // Pre-flight 전에도 `pnpm build` / `pnpm test` 가 통과해야 하므로 나머지는 optional.
    const parsed = envSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: "g.apps",
      SUPABASE_SERVICE_ROLE_KEY: "svc",
      // Maps 5 + test signin 2 모두 생략
    });
    expect(parsed.success).toBe(true);
  });
});
