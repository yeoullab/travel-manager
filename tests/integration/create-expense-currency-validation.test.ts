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
let domTripId = "";
let ovsTripId = "";
let otherTripId = "";
let otherScheduleId = "";

beforeAll(async () => {
  const { data: u, error } = await admin.auth.admin.createUser({
    email: `alicecurr+${STAMP}@test.local`,
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
  await aliceC.auth.signInWithPassword({ email: `alicecurr+${STAMP}@test.local`, password: PWD });

  // 국내 trip (KRW 고정)
  const d = await aliceC.rpc("create_trip", {
    p_title: "Domestic",
    p_destination: "Seoul",
    p_start_date: "2026-06-01",
    p_end_date: "2026-06-02",
    p_is_domestic: true,
    p_currencies: ["KRW"],
  });
  if (d.error) throw d.error;
  domTripId = d.data as string;

  // 해외 trip (JPY, EUR 허용)
  const o = await aliceC.rpc("create_trip", {
    p_title: "Overseas",
    p_destination: "Tokyo",
    p_start_date: "2026-07-01",
    p_end_date: "2026-07-02",
    p_is_domestic: false,
    p_currencies: ["JPY", "EUR"],
  });
  if (o.error) throw o.error;
  ovsTripId = o.data as string;

  // 다른 trip (schedule_trip_mismatch 테스트용)
  const x = await aliceC.rpc("create_trip", {
    p_title: "Other",
    p_destination: "Busan",
    p_start_date: "2026-08-01",
    p_end_date: "2026-08-02",
    p_is_domestic: true,
    p_currencies: ["KRW"],
  });
  if (x.error) throw x.error;
  otherTripId = x.data as string;

  const { data: days } = await aliceC
    .from("trip_days")
    .select("id")
    .eq("trip_id", otherTripId)
    .order("day_number")
    .limit(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const si = await (aliceC as any).rpc("create_schedule_item", {
    p_trip_day_id: days![0].id,
    p_title: "Other trip event",
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
  if (si.error) throw si.error;
  otherScheduleId = si.data as string;
}, 30_000);

afterAll(async () => {
  for (const t of [domTripId, ovsTripId, otherTripId]) {
    await admin.from("expenses").delete().eq("trip_id", t);
    await admin.from("trips").delete().eq("id", t);
  }
  if (aliceId) await admin.auth.admin.deleteUser(aliceId);
});

describe("create_expense — 통화/스케줄 일치 검증", () => {
  it("국내 trip + KRW → OK", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (aliceC as any).rpc("create_expense", {
      p_trip_id: domTripId,
      p_expense_date: "2026-06-01",
      p_title: "Lunch",
      p_amount: 12000,
      p_currency: "KRW",
      p_category_code: "food",
    });
    expect(error).toBeNull();
    expect(data).toBeTruthy();
  });

  it("국내 trip + JPY → currency_not_allowed", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (aliceC as any).rpc("create_expense", {
      p_trip_id: domTripId,
      p_expense_date: "2026-06-01",
      p_title: "Bad",
      p_amount: 1000,
      p_currency: "JPY",
      p_category_code: "food",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/currency_not_allowed/);
  });

  it("해외 trip + 리스트 내 통화 (JPY) → OK", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (aliceC as any).rpc("create_expense", {
      p_trip_id: ovsTripId,
      p_expense_date: "2026-07-01",
      p_title: "Dinner",
      p_amount: 2500,
      p_currency: "JPY",
      p_category_code: "food",
    });
    expect(error).toBeNull();
  });

  it("해외 trip + KRW → OK (항상 허용)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (aliceC as any).rpc("create_expense", {
      p_trip_id: ovsTripId,
      p_expense_date: "2026-07-01",
      p_title: "Snack",
      p_amount: 5000,
      p_currency: "KRW",
      p_category_code: "food",
    });
    expect(error).toBeNull();
  });

  it("해외 trip + 리스트 외 통화 (USD) → currency_not_allowed", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (aliceC as any).rpc("create_expense", {
      p_trip_id: ovsTripId,
      p_expense_date: "2026-07-01",
      p_title: "Bad",
      p_amount: 10,
      p_currency: "USD",
      p_category_code: "food",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/currency_not_allowed/);
  });

  it("schedule_item_id 가 다른 trip 소속 → schedule_trip_mismatch", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (aliceC as any).rpc("create_expense", {
      p_trip_id: domTripId,
      p_expense_date: "2026-06-01",
      p_title: "Mismatch",
      p_amount: 1000,
      p_currency: "KRW",
      p_category_code: "other",
      p_schedule_item_id: otherScheduleId,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/schedule_trip_mismatch/);
  });
});
