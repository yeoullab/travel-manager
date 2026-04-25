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
let expenseId = "";

beforeAll(async () => {
  for (const [role, keep] of [
    ["alice", (id: string) => { aliceId = id; }],
    ["bob", (id: string) => { bobId = id; }],
    ["evelyn", (id: string) => { evelynId = id; }],
  ] as const) {
    const { data, error } = await admin.auth.admin.createUser({
      email: `${role}rexp+${STAMP}@test.local`,
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
      email: `${role}rexp+${STAMP}@test.local`,
      password: PWD,
    });
    if (error) throw error;
    return c;
  };
  aliceC = await mkClient("alice");
  bobC = await mkClient("bob");
  evelynC = await mkClient("evelyn");

  const { data: inv } = await aliceC.rpc("create_invite");
  const code = (inv as { invite_code: string }).invite_code;
  await bobC.rpc("accept_invite", { p_invite_code: code });

  const r = await aliceC.rpc("create_trip", {
    p_title: "Expense RLS Test",
    p_destination: "Osaka",
    p_start_date: "2026-06-01",
    p_end_date: "2026-06-03",
    p_is_domestic: false,
    p_currencies: ["JPY"],
  });
  if (r.error) throw r.error;
  tripId = r.data as string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ins = await (aliceC as any).rpc("create_expense", {
    p_trip_id: tripId,
    p_expense_date: "2026-06-01",
    p_title: "Dinner",
    p_amount: 3500,
    p_currency: "JPY",
    p_category_code: "food",
  });
  if (ins.error) throw ins.error;
  expenseId = ins.data as string;
}, 30_000);

afterAll(async () => {
  await admin.from("expenses").delete().eq("trip_id", tripId);
  await admin.from("trips").delete().eq("id", tripId);
  await admin
    .from("group_members")
    .delete()
    .or(`user_id.eq.${aliceId},user_id.eq.${bobId},user_id.eq.${evelynId}`);
  await admin.from("groups").delete().eq("created_by", aliceId);
  for (const id of [aliceId, bobId, evelynId]) await admin.auth.admin.deleteUser(id);
});

describe("expenses RLS (can_access_trip × CRUD)", () => {
  it("owner alice — SELECT OK", async () => {
    const { data, error } = await aliceC.from("expenses").select("*").eq("id", expenseId);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
  });

  it("member bob — SELECT OK", async () => {
    const { data, error } = await bobC.from("expenses").select("*").eq("id", expenseId);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
  });

  it("stranger evelyn — SELECT 0 row", async () => {
    const { data, error } = await evelynC.from("expenses").select("*").eq("id", expenseId);
    expect(error).toBeNull();
    expect(data?.length).toBe(0);
  });

  it("stranger evelyn — INSERT via RPC 거부 (forbidden)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (evelynC as any).rpc("create_expense", {
      p_trip_id: tripId,
      p_expense_date: "2026-06-02",
      p_title: "Intruder",
      p_amount: 100,
      p_currency: "JPY",
      p_category_code: "other",
    });
    expect(error).not.toBeNull();
  });

  it("member bob — INSERT via RPC OK", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (bobC as any).rpc("create_expense", {
      p_trip_id: tripId,
      p_expense_date: "2026-06-02",
      p_title: "Partner add",
      p_amount: 200,
      p_currency: "JPY",
      p_category_code: "transport",
    });
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    await admin.from("expenses").delete().eq("id", data as string);
  });

  it("member bob — UPDATE via RPC OK", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (bobC as any).rpc("update_expense", {
      p_expense_id: expenseId,
      p_expense_date: "2026-06-01",
      p_title: "Dinner (edited by partner)",
      p_amount: 3800,
      p_currency: "JPY",
      p_category_code: "food",
    });
    expect(error).toBeNull();
  });

  it("stranger evelyn — UPDATE via RPC 거부", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (evelynC as any).rpc("update_expense", {
      p_expense_id: expenseId,
      p_expense_date: "2026-06-01",
      p_title: "Hacked",
      p_amount: 1,
      p_currency: "JPY",
      p_category_code: "food",
    });
    expect(error).not.toBeNull();
  });

  it("stranger evelyn — DELETE via RPC 거부", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (evelynC as any).rpc("delete_expense", { p_expense_id: expenseId });
    expect(error).not.toBeNull();
  });

  it("member bob — DELETE via RPC OK (공동 편집)", async () => {
    // 먼저 bob 이 지울 expense 하나 더 생성
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newId } = await (aliceC as any).rpc("create_expense", {
      p_trip_id: tripId,
      p_expense_date: "2026-06-03",
      p_title: "For partner delete",
      p_amount: 500,
      p_currency: "JPY",
      p_category_code: "other",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (bobC as any).rpc("delete_expense", { p_expense_id: newId });
    expect(error).toBeNull();
  });
});
