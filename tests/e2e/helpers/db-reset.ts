import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`E2E env missing: ${key}`);
  return value;
}

/**
 * Part A Task 4 에서 `supabase/seed/test.sql` 에 정의한 service_role-only RPC 호출.
 * public.* 테이블만 truncate cascade. auth.users 는 보존 → alice/bob 재생성 불필요.
 */
export async function truncateCascade(): Promise<void> {
  const admin = createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await admin.rpc("test_truncate_cascade" as never);
  if (error) throw new Error(`test_truncate_cascade failed: ${error.message}`);
}
