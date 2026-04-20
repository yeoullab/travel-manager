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
let evelynId = "";
let aliceC: SupabaseClient<Database>;
let bobC: SupabaseClient<Database>;
let evelynC: SupabaseClient<Database>;
let tripId = "";
let day1Id = "";
let itemId = "";

beforeAll(async () => {
  for (const [role, keep] of [
    ["alice", (id: string) => { aliceId = id; }],
    ["bob", (id: string) => { bobId = id; }],
    ["evelyn", (id: string) => { evelynId = id; }],
  ] as const) {
    const { data, error } = await admin.auth.admin.createUser({
      email: `${role}rsched+${STAMP}@test.local`,
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
    const { error } = await c.auth.signInWithPassword({
      email: `${role}rsched+${STAMP}@test.local`,
      password: PWD,
    });
    if (error) throw error;
    return c;
  };
  aliceC = await mkClient("alice");
  bobC = await mkClient("bob");
  evelynC = await mkClient("evelyn");

  // Alice → Bob 그룹 결성 → trip 생성
  const { data: inv } = await aliceC.rpc("create_invite");
  const code = (inv as { invite_code: string }).invite_code;
  await bobC.rpc("accept_invite", { p_invite_code: code });

  const r = await aliceC.rpc("create_trip", {
    p_title: "RLS Test",
    p_destination: "Tokyo",
    p_start_date: "2026-06-01",
    p_end_date: "2026-06-03",
    p_is_domestic: false,
    p_currencies: ["JPY"],
  });
  if (r.error) throw r.error;
  tripId = r.data as string;

  const { data: days, error: dErr } = await aliceC
    .from("trip_days")
    .select("id")
    .eq("trip_id", tripId)
    .order("day_number")
    .limit(1);
  if (dErr || !days?.[0]) throw dErr ?? new Error("no trip_days");
  day1Id = days[0].id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ins = await (aliceC as any).rpc("create_schedule_item", {
    p_trip_day_id: day1Id,
    p_title: "Visit Senso-ji",
    p_time_of_day: "09:00",
    p_memo: null,
    p_url: null,
    p_place_name: null,
    p_place_address: null,
    p_place_lat: null,
    p_place_lng: null,
    p_place_provider: null,
    p_place_external_id: null,
  });
  if (ins.error) throw ins.error;
  itemId = ins.data as string;
}, 30_000);

afterAll(async () => {
  await admin.from("schedule_items").delete().eq("trip_day_id", day1Id);
  await admin.from("trips").delete().eq("id", tripId);
  await admin
    .from("group_members")
    .delete()
    .or(`user_id.eq.${aliceId},user_id.eq.${bobId},user_id.eq.${evelynId}`);
  await admin.from("groups").delete().eq("created_by", aliceId);
  for (const id of [aliceId, bobId, evelynId]) await admin.auth.admin.deleteUser(id);
});

describe("schedule_items RLS (Spec §2.5 + can_access_trip 재사용)", () => {
  it("owner alice — SELECT OK", async () => {
    const { data, error } = await aliceC.from("schedule_items").select("*").eq("id", itemId);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
  });

  it("member bob — SELECT OK", async () => {
    const { data, error } = await bobC.from("schedule_items").select("*").eq("id", itemId);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
  });

  it("stranger evelyn — SELECT 0 row (RLS 차단)", async () => {
    const { data, error } = await evelynC.from("schedule_items").select("*").eq("id", itemId);
    expect(error).toBeNull();
    expect(data?.length).toBe(0);
  });

  it("stranger evelyn — INSERT 거부", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (evelynC as any).rpc("create_schedule_item", {
      p_trip_day_id: day1Id,
      p_title: "Intruder",
      p_time_of_day: "10:00",
      p_memo: null,
      p_url: null,
      p_place_name: null,
      p_place_address: null,
      p_place_lat: null,
      p_place_lng: null,
      p_place_provider: null,
      p_place_external_id: null,
    });
    expect(error).not.toBeNull();
  });

  it("stranger evelyn — UPDATE 거부", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (evelynC as any).rpc("update_schedule_item", {
      p_item_id: itemId,
      p_title: "Hacked",
      p_time_of_day: null,
      p_memo: null,
      p_url: null,
      p_place_name: null,
      p_place_address: null,
      p_place_lat: null,
      p_place_lng: null,
      p_place_provider: null,
      p_place_external_id: null,
    });
    expect(error).not.toBeNull();
  });

  it("stranger evelyn — DELETE 거부", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (evelynC as any).rpc("delete_schedule_item", { p_item_id: itemId });
    expect(error).not.toBeNull();
  });

  it("member bob — UPDATE OK (CRUD 공유)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (bobC as any).rpc("update_schedule_item", {
      p_item_id: itemId,
      p_title: "Visit Senso-ji (partner edit)",
      p_time_of_day: null,
      p_memo: null,
      p_url: null,
      p_place_name: null,
      p_place_address: null,
      p_place_lat: null,
      p_place_lng: null,
      p_place_provider: null,
      p_place_external_id: null,
    });
    expect(error).toBeNull();
  });
});
