import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`E2E env missing: ${key}`);
  return value;
}

export function assertSafeResetTarget({
  supabaseUrl,
  allowRemoteReset,
}: {
  supabaseUrl: string;
  allowRemoteReset: boolean;
}): void {
  const { hostname } = new URL(supabaseUrl);
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost");

  if (!isLocal && !allowRemoteReset) {
    throw new Error(
      "Refusing to reset remote Supabase database. Set E2E_ALLOW_REMOTE_DB_RESET=true only for disposable test projects.",
    );
  }
}

/**
 * Part A Task 4 에서 `supabase/seed/test.sql` 에 정의한 service_role-only RPC 호출.
 * public.* 테이블만 truncate cascade. auth.users 는 보존 → alice/bob 재생성 불필요.
 */
export async function truncateCascade(): Promise<void> {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  assertSafeResetTarget({
    supabaseUrl,
    allowRemoteReset: process.env.E2E_ALLOW_REMOTE_DB_RESET === "true",
  });

  const admin = createClient<Database>(
    supabaseUrl,
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await admin.rpc("test_truncate_cascade" as never);
  if (error) throw new Error(`test_truncate_cascade failed: ${error.message}`);
}
