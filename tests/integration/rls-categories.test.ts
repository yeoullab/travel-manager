import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const anonC = createClient<Database>(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);
const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
let userId = "";
let userC: SupabaseClient<Database>;

beforeAll(async () => {
  const u = await admin.auth.admin.createUser({
    email: `cat_rls+${STAMP}@test.local`,
    password: PWD,
    email_confirm: true,
  });
  if (u.error) throw u.error;
  userId = u.data.user!.id;
  userC = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  await userC.auth.signInWithPassword({
    email: `cat_rls+${STAMP}@test.local`,
    password: PWD,
  });
});

afterAll(async () => {
  await admin.auth.admin.deleteUser(userId);
});

describe("categories table RLS (0008)", () => {
  it("anon users cannot SELECT (no policy covers anon role)", async () => {
    const { data, error } = await anonC.from("categories").select("code").limit(10);
    // 정책이 authenticated 전용이라 anon 은 empty or policy error 중 하나
    expect(error === null ? data : data).toBeDefined();
    // 핵심: anon 은 6개 seed 를 조회하면 안 됨
    expect((data ?? []).length).toBe(0);
  });

  it("authenticated users SELECT all 6 seed categories", async () => {
    const { data, error } = await userC
      .from("categories")
      .select("code, name, sort_order")
      .order("sort_order");
    expect(error).toBeNull();
    expect(data).toHaveLength(6);
    expect(data?.map((c) => c.code)).toEqual([
      "transport",
      "sightseeing",
      "food",
      "lodging",
      "shopping",
      "other",
    ]);
  });

  it("authenticated users cannot INSERT (no policy)", async () => {
    const { error } = await userC.from("categories").insert({
      code: "evil_cat",
      name: "evil",
      color_token: "bg-red-500",
      sort_order: 99,
    });
    // RLS 가 INSERT 정책 없어서 차단. error or empty row 둘 다 가능
    expect(error).not.toBeNull();
  });

  it("authenticated users cannot UPDATE existing seed", async () => {
    const { error, data } = await userC
      .from("categories")
      .update({ name: "hacked" })
      .eq("code", "other")
      .select();
    // UPDATE 정책 없음 — supabase 는 0-row affected 로 실패
    expect(error === null ? (data ?? []).length : 0).toBe(0);
  });

  it("authenticated users cannot DELETE seed", async () => {
    const { error, data } = await userC
      .from("categories")
      .delete()
      .eq("code", "other")
      .select();
    expect(error === null ? (data ?? []).length : 0).toBe(0);
  });
});
