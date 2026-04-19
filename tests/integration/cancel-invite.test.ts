import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
let aliceId = ""; let bobId = "";
let aliceC: SupabaseClient<Database>;
let bobC: SupabaseClient<Database>;

beforeAll(async () => {
  const a = await admin.auth.admin.createUser({ email: `alice_cancel+${STAMP}@test.local`, password: PWD, email_confirm: true });
  if (a.error) throw a.error; aliceId = a.data.user!.id;
  const b = await admin.auth.admin.createUser({ email: `bob_cancel+${STAMP}@test.local`, password: PWD, email_confirm: true });
  if (b.error) throw b.error; bobId = b.data.user!.id;

  aliceC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: ae } = await aliceC.auth.signInWithPassword({ email: `alice_cancel+${STAMP}@test.local`, password: PWD });
  if (ae) throw ae;
  bobC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: be } = await bobC.auth.signInWithPassword({ email: `bob_cancel+${STAMP}@test.local`, password: PWD });
  if (be) throw be;
});
afterAll(async () => {
  await admin.from("group_members").delete().or(`user_id.eq.${aliceId},user_id.eq.${bobId}`);
  await admin.from("groups").delete().or(`created_by.eq.${aliceId}`);
  for (const id of [aliceId, bobId]) await admin.auth.admin.deleteUser(id);
});

describe("cancel_invite", () => {
  it("취소 후 같은 code 재수락 → invite_invalid_or_consumed", async () => {
    const { data: inv } = await aliceC.rpc("create_invite");
    const code = (inv as { invite_code: string }).invite_code;
    await aliceC.rpc("cancel_invite");

    const { error } = await bobC.rpc("accept_invite", { p_invite_code: code });
    expect(error?.message).toBe("invite_invalid_or_consumed");
  });

  it("cancelled 상태 그룹은 active 로 전이 불가 (트리거 차단)", async () => {
    const { data: inv } = await aliceC.rpc("create_invite");
    const groupId = (inv as { group_id: string }).group_id;
    await aliceC.rpc("cancel_invite");

    // admin으로 직접 active 전이 시도 → 트리거 차단
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).from("groups").update({ status: "active" }).eq("id", groupId);
    expect(error).not.toBeNull();
  });
});
