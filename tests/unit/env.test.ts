import { describe, expect, it } from "vitest";
import { envSchema } from "@/lib/env";

describe("envSchema", () => {
  it("키가 모두 채워지면 통과한다", () => {
    const result = envSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: "abc.apps.googleusercontent.com",
    });
    expect(result.success).toBe(true);
  });

  it("URL 형식이 아니면 실패한다", () => {
    const result = envSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "x",
      SUPABASE_SERVICE_ROLE_KEY: "x",
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: "x",
    });
    expect(result.success).toBe(false);
  });
});
