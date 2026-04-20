import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().min(1),
  // Phase 3 (ADR-009) — Maps public keys. Pre-flight 전에도 부팅 가능하도록 optional.
  NEXT_PUBLIC_NAVER_MAP_CLIENT_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),
});

const serverOnlySchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Phase 3 — Maps server-only secrets (optional until Pre-flight complete)
  NAVER_SEARCH_CLIENT_ID: z.string().min(1).optional(),
  NAVER_SEARCH_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_MAPS_SERVER_KEY: z.string().min(1).optional(),
  // Phase 3 — E2E test sign-in flags. 'true' 문자열일 때만 활성화.
  ALLOW_TEST_SIGNIN: z.enum(["true", "false"]).optional(),
  TEST_SECRET: z.string().min(1).optional(),
});

export const envSchema = publicSchema.extend(serverOnlySchema.shape);
export type Env = z.infer<typeof envSchema>;

export const env = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  NEXT_PUBLIC_NAVER_MAP_CLIENT_ID: process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID,
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
});

let cachedServerEnv: z.infer<typeof serverOnlySchema> | null = null;

export function getServerEnv() {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv()는 서버에서만 호출해야 합니다");
  }
  if (!cachedServerEnv) {
    cachedServerEnv = serverOnlySchema.parse({
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      NAVER_SEARCH_CLIENT_ID: process.env.NAVER_SEARCH_CLIENT_ID,
      NAVER_SEARCH_CLIENT_SECRET: process.env.NAVER_SEARCH_CLIENT_SECRET,
      GOOGLE_MAPS_SERVER_KEY: process.env.GOOGLE_MAPS_SERVER_KEY,
      ALLOW_TEST_SIGNIN: process.env.ALLOW_TEST_SIGNIN,
      TEST_SECRET: process.env.TEST_SECRET,
    });
  }
  return cachedServerEnv;
}
