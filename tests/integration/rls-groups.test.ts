import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const STAMP = Date.now();
const ALICE_EMAIL = `alice+${STAMP}@test.local`;
const BOB_EMAIL = `bob+${STAMP}@test.local`;
const PWD = "Test_Pwd_2026!";
let aliceId = "";
let bobId = "";
let aliceC: SupabaseClient<Database>;
let bobC: SupabaseClient<Database>;

async function makeClient(email: string): Promise<SupabaseClient<Database>> {
  const c = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password: PWD });
  if (error) throw error;
  return c;
}

beforeAll(async () => {
  const a = await admin.auth.admin.createUser({ email: ALICE_EMAIL, password: PWD, email_confirm: true });
  if (a.error) throw a.error;
  aliceId = a.data.user!.id;
  const b = await admin.auth.admin.createUser({ email: BOB_EMAIL, password: PWD, email_confirm: true });
  if (b.error) throw b.error;
  bobId = b.data.user!.id;
  aliceC = await makeClient(ALICE_EMAIL);
  bobC = await makeClient(BOB_EMAIL);
});

afterAll(async () => {
  await admin.from("group_members").delete().or(`user_id.eq.${aliceId},user_id.eq.${bobId}`);
  await admin.from("groups").delete().or(`created_by.eq.${aliceId},created_by.eq.${bobId}`);
  if (aliceId) await admin.auth.admin.deleteUser(aliceId);
  if (bobId) await admin.auth.admin.deleteUser(bobId);
});

describe("RLS — groups", () => {
  it("오너는 본인 그룹을 SELECT 할 수 있다", async () => {
    const { data: created } = await aliceC.rpc("create_invite");
    const groupId = (created as { group_id: string }).group_id;

    const { data, error } = await aliceC.from("groups").select("id, status").eq("id", groupId).single();
    expect(error).toBeNull();
    expect(data?.status).toBe("pending");

    await aliceC.rpc("cancel_invite");
  });

  it("타인은 관계없는 그룹을 SELECT 할 수 없다", async () => {
    const { data: created } = await aliceC.rpc("create_invite");
    const groupId = (created as { group_id: string }).group_id;

    const { data } = await bobC.from("groups").select("id").eq("id", groupId);
    expect(data).toHaveLength(0);

    await aliceC.rpc("cancel_invite");
  });

  it("group_members 직접 INSERT 는 RLS 차단", async () => {
    const { data: created } = await aliceC.rpc("create_invite");
    const groupId = (created as { group_id: string }).group_id;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (aliceC as any).from("group_members").insert({ group_id: groupId, user_id: aliceId, role: "member" });
    expect(error).not.toBeNull();

    await aliceC.rpc("cancel_invite");
  });

  it("오너는 invite_code 를 groups_with_invite 로 조회 가능", async () => {
    await aliceC.rpc("create_invite");

    // groups_with_invite 로 invite_code 조회 가능
    const { data: view, error } = await aliceC.from("groups_with_invite").select("invite_code").limit(1).single();
    expect(error).toBeNull();
    expect(view?.invite_code).toBeTruthy();

    await aliceC.rpc("cancel_invite");
  });
});
