import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { request } from "@playwright/test";
import type { Database } from "@/types/database";
import type { TestUser } from "../fixtures/users";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`E2E env missing: ${key}`);
  return value;
}

let adminClient: SupabaseClient<Database> | null = null;
function getAdmin(): SupabaseClient<Database> {
  if (!adminClient) {
    adminClient = createClient<Database>(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return adminClient;
}

/** 멱등. 유저 없으면 생성(email_confirm true), 있으면 password 리셋 후 id 반환. */
export async function ensureTestUser(user: TestUser): Promise<string> {
  const admin = getAdmin();

  const { data: page, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) throw new Error(`listUsers failed: ${listErr.message}`);

  const existing = page?.users.find((u) => u.email === user.email);
  if (existing) {
    const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
      password: user.password,
    });
    if (updErr) throw new Error(`updateUserById failed: ${updErr.message}`);
    return existing.id;
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { display_name: user.displayName },
  });
  if (createErr || !created.user) {
    throw new Error(`createUser failed: ${createErr?.message ?? "no user"}`);
  }
  return created.user.id;
}

/**
 * /api/test/sign-in 을 호출해 Supabase SSR 쿠키를 정상 경로로 세팅하고
 * storageState JSON 으로 덤프. 수동 cookie 조립은 하지 않는다.
 */
export async function buildStorageState(user: TestUser, outputPath: string): Promise<void> {
  const baseURL = requireEnv("PLAYWRIGHT_BASE_URL");
  const testSecret = requireEnv("TEST_SECRET");

  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post("/api/test/sign-in", {
    headers: { "X-Test-Secret": testSecret },
    data: { email: user.email, password: user.password },
  });
  if (!res.ok()) {
    const body = await res.text().catch(() => "");
    await ctx.dispose();
    throw new Error(`POST /api/test/sign-in → ${res.status()} ${body.slice(0, 200)}`);
  }
  await ctx.storageState({ path: outputPath });
  await ctx.dispose();
}
