import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
let aliceId = "";

beforeAll(async () => {
  const a = await admin.auth.admin.createUser({ email: `alice_xss+${STAMP}@test.local`, password: PWD, email_confirm: true });
  if (a.error) throw a.error; aliceId = a.data.user!.id;
});
afterAll(async () => { await admin.auth.admin.deleteUser(aliceId); });

describe("display_name XSS — DB 는 literal 저장", () => {
  it("<script> 태그는 literal 그대로 저장된다", async () => {
    const c = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await c.auth.signInWithPassword({ email: `alice_xss+${STAMP}@test.local`, password: PWD });

    const xssName = '<script>alert("xss")</script>';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (c as any).from("profiles").update({ display_name: xssName }).eq("id", aliceId);

    const { data } = await c.from("profiles").select("display_name").eq("id", aliceId).single();
    expect(data?.display_name).toBe(xssName);
  });

  it("41자 display_name → CHECK 위반 거부", async () => {
    const c = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await c.auth.signInWithPassword({ email: `alice_xss+${STAMP}@test.local`, password: PWD });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (c as any).from("profiles").update({ display_name: "A".repeat(41) }).eq("id", aliceId);
    expect(error).not.toBeNull();
  });
});
