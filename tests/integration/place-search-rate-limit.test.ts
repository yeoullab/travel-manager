import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
let aliceId = "";

beforeAll(async () => {
  const r = await admin.auth.admin.createUser({
    email: `alice_ratelimit+${STAMP}@test.local`,
    password: PWD,
    email_confirm: true,
  });
  if (r.error) throw r.error;
  aliceId = r.data.user!.id;
});

afterAll(async () => {
  await admin.auth.admin.deleteUser(aliceId);
  vi.restoreAllMocks();
});

// vi.mock 은 hoist — getServerClient auth bypass
vi.mock("@/lib/supabase/server-client", () => ({
  getServerClient: () => ({
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: (globalThis as unknown as { __TEST_USER_ID__?: string }).__TEST_USER_ID__ ??
              "mock-user-id",
          },
        },
        error: null,
      }),
    },
  }),
}));

// 실 네트워크 미사용 — route.ts 의 실 import 이름과 일치
vi.mock("@/lib/maps/search/naver-search", () => ({
  searchNaver: async () => [],
}));
vi.mock("@/lib/maps/search/google-search", () => ({
  searchGoogle: async () => [],
}));

describe("/api/maps/search rate limit (30/min/user, Spec §6.1)", () => {
  it(
    "31번째 요청은 429",
    async () => {
      (globalThis as unknown as { __TEST_USER_ID__?: string }).__TEST_USER_ID__ = aliceId;

      // 매 테스트 시작 전 rate-limit 버킷 초기화
      const { __resetRateLimitForTest } = await import("@/lib/maps/rate-limit");
      __resetRateLimitForTest();

      const mod = await import("@/app/api/maps/search/route");
      const handler = mod.POST;

      const build = () =>
        new Request("http://localhost/api/maps/search", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: "cafe", provider: "naver" }),
        });

      for (let i = 0; i < 30; i += 1) {
        const res = await handler(build() as unknown as Parameters<typeof handler>[0]);
        expect(res.status, `request #${i + 1}`).toBe(200);
      }

      const throttled = await handler(build() as unknown as Parameters<typeof handler>[0]);
      expect(throttled.status).toBe(429);
      const body = await throttled.json() as Record<string, unknown>;
      expect(body).toMatchObject({ error: expect.stringMatching(/rate|limit|too many/i) });
    },
    30_000,
  );
});
