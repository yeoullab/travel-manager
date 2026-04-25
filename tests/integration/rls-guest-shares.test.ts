import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
let aliceId = "";
let bobId = "";
let aliceC: SupabaseClient<Database>;
let bobC: SupabaseClient<Database>;
let anonC: SupabaseClient<Database>;
let tripId = "";
let shareId = "";

beforeAll(async () => {
  for (const [role, keep] of [
    ["alice", (id: string) => { aliceId = id; }],
    ["bob", (id: string) => { bobId = id; }],
  ] as const) {
    const { data, error } = await admin.auth.admin.createUser({
      email: `${role}gs+${STAMP}@test.local`,
      password: PWD,
      email_confirm: true,
    });
    if (error) throw error;
    keep(data.user!.id);
  }
  const mkClient = async (role: string) => {
    const c = createClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false } },
    );
    await c.auth.signInWithPassword({
      email: `${role}gs+${STAMP}@test.local`,
      password: PWD,
    });
    return c;
  };
  aliceC = await mkClient("alice");
  bobC = await mkClient("bob");
  anonC = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );

  const { data: inv } = await aliceC.rpc("create_invite");
  await bobC.rpc("accept_invite", { p_invite_code: (inv as { invite_code: string }).invite_code });

  const r = await aliceC.rpc("create_trip", {
    p_title: "Share RLS",
    p_destination: "Seoul",
    p_start_date: "2026-06-01",
    p_end_date: "2026-06-02",
    p_is_domestic: true,
    p_currencies: ["KRW"],
  });
  if (r.error) throw r.error;
  tripId = r.data as string;

  // owner INSERT (admin 으로 바로 — 초기 share row)
  const { data, error } = await admin
    .from("guest_shares")
    .insert({ trip_id: tripId, is_active: true })
    .select("id")
    .single();
  if (error) throw error;
  shareId = data.id;
}, 30_000);

afterAll(async () => {
  await admin.from("guest_shares").delete().eq("trip_id", tripId);
  await admin.from("trips").delete().eq("id", tripId);
  await admin
    .from("group_members")
    .delete()
    .or(`user_id.eq.${aliceId},user_id.eq.${bobId}`);
  await admin.from("groups").delete().eq("created_by", aliceId);
  for (const id of [aliceId, bobId]) await admin.auth.admin.deleteUser(id);
});

describe("guest_shares RLS (owner only for write, members for read)", () => {
  it("owner alice — SELECT OK", async () => {
    const { data, error } = await aliceC.from("guest_shares").select("*").eq("id", shareId);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
  });

  it("member bob — SELECT OK (can_access_trip)", async () => {
    const { data } = await bobC.from("guest_shares").select("*").eq("id", shareId);
    expect(data?.length).toBe(1);
  });

  it("owner alice — UPDATE OK (show_expenses 토글)", async () => {
    const { error, count } = await aliceC
      .from("guest_shares")
      .update({ show_expenses: true }, { count: "exact" })
      .eq("id", shareId);
    expect(error).toBeNull();
    expect(count).toBe(1);
  });

  it("member bob — UPDATE 거부 (owner only)", async () => {
    // Partner 는 trips.created_by != auth.uid() 이므로 with_check 실패 → count 0
    const { error, count } = await bobC
      .from("guest_shares")
      .update({ show_expenses: false }, { count: "exact" })
      .eq("id", shareId);
    expect(error).toBeNull();
    expect(count).toBe(0);
  });

  it("anon — SELECT 직접 거부 (RLS authenticated-only)", async () => {
    const { data } = await anonC.from("guest_shares").select("*").eq("id", shareId);
    expect(data?.length ?? 0).toBe(0);
  });

  it("member bob — INSERT 거부 (owner only)", async () => {
    const { error } = await bobC
      .from("guest_shares")
      .insert({ trip_id: tripId, is_active: false });
    expect(error).not.toBeNull();
  });

  it("member bob — DELETE 거부 (owner only)", async () => {
    const { error, count } = await bobC
      .from("guest_shares")
      .delete({ count: "exact" })
      .eq("id", shareId);
    expect(error).toBeNull();
    expect(count).toBe(0);
  });
});
