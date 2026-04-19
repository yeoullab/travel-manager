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
  const a = await admin.auth.admin.createUser({ email: `alice_dissolve+${STAMP}@test.local`, password: PWD, email_confirm: true });
  if (a.error) throw a.error; aliceId = a.data.user!.id;
  const b = await admin.auth.admin.createUser({ email: `bob_dissolve+${STAMP}@test.local`, password: PWD, email_confirm: true });
  if (b.error) throw b.error; bobId = b.data.user!.id;

  aliceC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: ae } = await aliceC.auth.signInWithPassword({ email: `alice_dissolve+${STAMP}@test.local`, password: PWD });
  if (ae) throw ae;
  bobC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: be } = await bobC.auth.signInWithPassword({ email: `bob_dissolve+${STAMP}@test.local`, password: PWD });
  if (be) throw be;
});
afterAll(async () => {
  await admin.from("trips").delete().or(`created_by.eq.${aliceId}`);
  await admin.from("group_members").delete().or(`user_id.eq.${aliceId},user_id.eq.${bobId}`);
  await admin.from("groups").delete().or(`created_by.eq.${aliceId}`);
  for (const id of [aliceId, bobId]) await admin.auth.admin.deleteUser(id);
});

describe("dissolve_group 캐스케이드", () => {
  it("dissolve 후 trips.group_id → null, partner는 해당 trip SELECT 불가", async () => {
    const { data: inv } = await aliceC.rpc("create_invite");
    const code = (inv as { invite_code: string }).invite_code;
    await bobC.rpc("accept_invite", { p_invite_code: code });

    const tripId: string = await aliceC.rpc("create_trip", {
      p_title: "Shared", p_destination: "Jeju", p_start_date: "2026-06-01", p_end_date: "2026-06-02",
      p_is_domestic: true, p_currencies: [],
    }).then((r) => r.data as string);

    const { data: before } = await bobC.from("trips").select("id").eq("id", tripId).single();
    expect(before?.id).toBe(tripId);

    await aliceC.rpc("dissolve_group");

    const { data: trip } = await admin.from("trips").select("group_id").eq("id", tripId).single();
    expect(trip?.group_id).toBeNull();

    const { data: after } = await bobC.from("trips").select("id").eq("id", tripId);
    expect(after).toHaveLength(0);

    await aliceC.from("trips").delete().eq("id", tripId);
  });

  it("dissolved → active 전이 차단 (트리거)", async () => {
    const { data: inv } = await aliceC.rpc("create_invite");
    const groupId = (inv as { group_id: string }).group_id;
    const code = (inv as { invite_code: string }).invite_code;
    await bobC.rpc("accept_invite", { p_invite_code: code });
    await aliceC.rpc("dissolve_group");

    // admin으로 직접 active 전이 시도 → 트리거 차단
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).from("groups").update({ status: "active" }).eq("id", groupId);
    expect(error).not.toBeNull();
  });
});
