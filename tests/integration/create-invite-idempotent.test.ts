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
  const { data, error } = await admin.auth.admin.createUser({ email: `alice_idem+${STAMP}@test.local`, password: PWD, email_confirm: true });
  if (error) throw error;
  aliceId = data.user!.id;
});
afterAll(async () => {
  await admin.from("group_members").delete().eq("user_id", aliceId);
  await admin.from("groups").delete().eq("created_by", aliceId);
  await admin.auth.admin.deleteUser(aliceId);
});

describe("create_invite 멱등성", () => {
  it("두 번 호출 시 같은 invite_code 와 reused:true 반환", async () => {
    const c = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await c.auth.signInWithPassword({ email: `alice_idem+${STAMP}@test.local`, password: PWD });

    const { data: first } = await c.rpc("create_invite");
    const { data: second } = await c.rpc("create_invite");
    const f = first as { invite_code: string; reused: boolean };
    const s = second as { invite_code: string; reused: boolean };

    expect(f.invite_code).toBe(s.invite_code);
    expect(s.reused).toBe(true);

    await c.rpc("cancel_invite");
  });
});
