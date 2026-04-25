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
let aliceC: SupabaseClient<Database>;
let tripId = "";
let scheduleId = "";
let expenseId = "";

beforeAll(async () => {
  const { data: u, error } = await admin.auth.admin.createUser({
    email: `aliceesl+${STAMP}@test.local`,
    password: PWD,
    email_confirm: true,
  });
  if (error) throw error;
  aliceId = u.user!.id;
  aliceC = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  await aliceC.auth.signInWithPassword({
    email: `aliceesl+${STAMP}@test.local`,
    password: PWD,
  });

  const r = await aliceC.rpc("create_trip", {
    p_title: "Schedule Link",
    p_destination: "Seoul",
    p_start_date: "2026-06-01",
    p_end_date: "2026-06-02",
    p_is_domestic: true,
    p_currencies: ["KRW"],
  });
  if (r.error) throw r.error;
  tripId = r.data as string;

  const { data: days } = await aliceC
    .from("trip_days")
    .select("id")
    .eq("trip_id", tripId)
    .order("day_number")
    .limit(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const si = await (aliceC as any).rpc("create_schedule_item", {
    p_trip_day_id: days![0].id,
    p_title: "Lunch at Namdaemun",
    p_time_of_day: "12:00",
    p_memo: null,
    p_url: null,
    p_place_name: null,
    p_place_address: null,
    p_place_lat: null,
    p_place_lng: null,
    p_place_provider: null,
    p_place_external_id: null,
  });
  if (si.error) throw si.error;
  scheduleId = si.data as string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ex = await (aliceC as any).rpc("create_expense", {
    p_trip_id: tripId,
    p_expense_date: "2026-06-01",
    p_title: "Lunch",
    p_amount: 12000,
    p_currency: "KRW",
    p_category_code: "food",
    p_schedule_item_id: scheduleId,
  });
  if (ex.error) throw ex.error;
  expenseId = ex.data as string;
}, 30_000);

afterAll(async () => {
  await admin.from("expenses").delete().eq("trip_id", tripId);
  await admin.from("trips").delete().eq("id", tripId);
  if (aliceId) await admin.auth.admin.deleteUser(aliceId);
});

describe("expenses.schedule_item_id ON DELETE SET NULL", () => {
  it("expense 가 schedule_item_id 를 보유한 상태로 생성됨", async () => {
    const { data } = await aliceC
      .from("expenses")
      .select("id, schedule_item_id")
      .eq("id", expenseId)
      .single();
    expect(data?.schedule_item_id).toBe(scheduleId);
  });

  it("schedule_item 삭제 시 expense.schedule_item_id → NULL (CASCADE 아님)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const del = await (aliceC as any).rpc("delete_schedule_item", { p_item_id: scheduleId });
    expect(del.error).toBeNull();

    const { data, error } = await aliceC
      .from("expenses")
      .select("id, schedule_item_id")
      .eq("id", expenseId)
      .single();
    expect(error).toBeNull();
    // expense 는 살아있다 (CASCADE 아님)
    expect(data?.id).toBe(expenseId);
    // schedule_item_id 는 null (SET NULL)
    expect(data?.schedule_item_id).toBeNull();
  });
});
