import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let userId = "";
let auth: SupabaseClient<Database>;
let anon: SupabaseClient<Database>;

beforeAll(async () => {
  const r = await admin.auth.admin.createUser({
    email: `catrls+${STAMP}@test.local`,
    password: PWD,
    email_confirm: true,
  });
  if (r.error) throw r.error;
  userId = r.data.user!.id;

  auth = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await auth.auth.signInWithPassword({
    email: `catrls+${STAMP}@test.local`,
    password: PWD,
  });
  if (error) throw error;

  anon = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
});

afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId);
});

describe("categories RLS (0008_categories.sql)", () => {
  it("authenticated user reads all 6 seed rows in sort_order", async () => {
    const { data, error } = await auth
      .from("categories")
      .select("code, name, sort_order")
      .order("sort_order", { ascending: true });
    expect(error).toBeNull();
    expect(data?.map((r) => r.code)).toEqual([
      "transport",
      "sightseeing",
      "food",
      "lodging",
      "shopping",
      "other",
    ]);
  });

  it("anon (no session) cannot read categories", async () => {
    const { data, error } = await anon.from("categories").select("code");
    // RLS deny → empty result (PostgREST policy 위반은 row 0 + error null)
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it("authenticated INSERT is denied (read-only system table)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (auth as any)
      .from("categories")
      .insert({ code: "test_x", name: "테스트", color_token: "bg-ink-400", sort_order: 99 });
    expect(error).not.toBeNull();
  });
});
