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
let recordId = "";

beforeAll(async () => {
  for (const [role, keep] of [
    ["alice", (id: string) => { aliceId = id; }],
    ["bob", (id: string) => { bobId = id; }],
    ["evelyn", (id: string) => { evelynId = id; }],
  ] as const) {
    const { data, error } = await admin.auth.admin.createUser({
      email: `${role}rrec+${STAMP}@test.local`,
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
      email: `${role}rrec+${STAMP}@test.local`,
      password: PWD,
    });
    return c;
  };
  aliceC = await mkClient("alice");
  bobC = await mkClient("bob");
  evelynC = await mkClient("evelyn");

  const { data: inv } = await aliceC.rpc("create_invite");
  await bobC.rpc("accept_invite", { p_invite_code: (inv as { invite_code: string }).invite_code });

  const r = await aliceC.rpc("create_trip", {
    p_title: "Record RLS",
    p_destination: "Nara",
    p_start_date: "2026-06-01",
    p_end_date: "2026-06-03",
    p_is_domestic: false,
    p_currencies: ["JPY"],
  });
  if (r.error) throw r.error;
  tripId = r.data as string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rec = await (aliceC as any).rpc("create_record", {
    p_trip_id: tripId,
    p_title: "Day 1 memo",
    p_content: "Arrived safely.",
    p_date: "2026-06-01",
  });
  if (rec.error) throw rec.error;
  recordId = rec.data as string;
}, 30_000);

afterAll(async () => {
  await admin.from("records").delete().eq("trip_id", tripId);
  await admin.from("trips").delete().eq("id", tripId);
  await admin
    .from("group_members")
    .delete()
    .or(`user_id.eq.${aliceId},user_id.eq.${bobId},user_id.eq.${evelynId}`);
  await admin.from("groups").delete().eq("created_by", aliceId);
  for (const id of [aliceId, bobId, evelynId]) await admin.auth.admin.deleteUser(id);
});

describe("records RLS (can_access_trip × CRUD)", () => {
  it("owner — SELECT OK", async () => {
    const { data, error } = await aliceC.from("records").select("*").eq("id", recordId);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
  });

  it("member — SELECT OK", async () => {
    const { data } = await bobC.from("records").select("*").eq("id", recordId);
    expect(data?.length).toBe(1);
  });

  it("stranger — SELECT 0 row", async () => {
    const { data } = await evelynC.from("records").select("*").eq("id", recordId);
    expect(data?.length).toBe(0);
  });

  it("stranger — INSERT via RPC 거부", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (evelynC as any).rpc("create_record", {
      p_trip_id: tripId,
      p_title: "Intruder",
      p_content: "x",
      p_date: "2026-06-01",
    });
    expect(error).not.toBeNull();
  });

  it("stranger — UPDATE via RPC 거부", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (evelynC as any).rpc("update_record", {
      p_record_id: recordId,
      p_title: "Hacked",
      p_content: "x",
      p_date: "2026-06-01",
    });
    expect(error).not.toBeNull();
  });

  it("stranger — DELETE via RPC 거부", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (evelynC as any).rpc("delete_record", { p_record_id: recordId });
    expect(error).not.toBeNull();
  });

  it("member — UPDATE OK (공동 편집)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (bobC as any).rpc("update_record", {
      p_record_id: recordId,
      p_title: "Day 1 memo (partner edit)",
      p_content: "Arrived safely. Updated by partner.",
      p_date: "2026-06-01",
    });
    expect(error).toBeNull();
  });
});
