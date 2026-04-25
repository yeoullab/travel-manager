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
let anonC: SupabaseClient<Database>;
let tripId = "";
let activeToken = "";
let expiredToken = "";
let inactiveToken = "";

beforeAll(async () => {
  const { data: u, error } = await admin.auth.admin.createUser({
    email: `aliceggtd+${STAMP}@test.local`,
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
  await aliceC.auth.signInWithPassword({ email: `aliceggtd+${STAMP}@test.local`, password: PWD });
  anonC = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );

  const r = await aliceC.rpc("create_trip", {
    p_title: "Guest Trip",
    p_destination: "Jeju",
    p_start_date: "2026-06-01",
    p_end_date: "2026-06-03",
    p_is_domestic: true,
    p_currencies: ["KRW"],
  });
  if (r.error) throw r.error;
  tripId = r.data as string;

  // 데이터 시드
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (aliceC as any).rpc("create_expense", {
    p_trip_id: tripId,
    p_expense_date: "2026-06-01",
    p_title: "Lunch",
    p_amount: 15000,
    p_currency: "KRW",
    p_category_code: "food",
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (aliceC as any).rpc("create_todo", {
    p_trip_id: tripId,
    p_title: "Book hotel",
    p_memo: null,
    p_assigned_to: null,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (aliceC as any).rpc("create_record", {
    p_trip_id: tripId,
    p_title: "Day 1",
    p_content: "Went to Hallasan.",
    p_date: "2026-06-01",
  });

  // active / expired / inactive share 3종 — unique index (trip_id where is_active) 회피 필요
  // 1) expired: is_active=true 이지만 expires_at 과거
  const expired = await admin
    .from("guest_shares")
    .insert({
      trip_id: tripId,
      is_active: true,
      expires_at: "2020-01-01T00:00:00Z",
      show_schedule: true,
    })
    .select("token")
    .single();
  if (expired.error) throw expired.error;
  expiredToken = expired.data.token;

  // 2) inactive
  await admin.from("guest_shares").update({ is_active: false }).eq("token", expiredToken);
  const inactive = await admin
    .from("guest_shares")
    .insert({
      trip_id: tripId,
      is_active: false,
      show_schedule: true,
    })
    .select("token")
    .single();
  if (inactive.error) throw inactive.error;
  inactiveToken = inactive.data.token;

  // 3) active (show_expenses=true, show_todos=false, show_records=true)
  const active = await admin
    .from("guest_shares")
    .insert({
      trip_id: tripId,
      is_active: true,
      show_schedule: true,
      show_expenses: true,
      show_todos: false,
      show_records: true,
    })
    .select("token")
    .single();
  if (active.error) throw active.error;
  activeToken = active.data.token;

  // expired 도 다시 active=true 로 돌려놓기 (token 테스트용)
  await admin
    .from("guest_shares")
    .update({ is_active: true, expires_at: "2020-01-01T00:00:00Z" })
    .eq("token", expiredToken);
}, 30_000);

afterAll(async () => {
  await admin.from("expenses").delete().eq("trip_id", tripId);
  await admin.from("todos").delete().eq("trip_id", tripId);
  await admin.from("records").delete().eq("trip_id", tripId);
  await admin.from("guest_shares").delete().eq("trip_id", tripId);
  await admin.from("trips").delete().eq("id", tripId);
  if (aliceId) await admin.auth.admin.deleteUser(aliceId);
});

describe("get_guest_trip_data — token validation + section filter", () => {
  it("anon 이 active token 호출 시 data 반환", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (anonC as any).rpc("get_guest_trip_data", { p_token: activeToken });
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data.trip.title).toBe("Guest Trip");
    expect(data.share.showExpenses).toBe(true);
    expect(data.share.showTodos).toBe(false);
    expect(data.share.showRecords).toBe(true);
  });

  it("show_todos=false → todos 배열 빈 배열", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (anonC as any).rpc("get_guest_trip_data", { p_token: activeToken });
    expect(Array.isArray(data.todos)).toBe(true);
    expect(data.todos.length).toBe(0);
  });

  it("show_expenses=true → expenses 배열 데이터 있음", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (anonC as any).rpc("get_guest_trip_data", { p_token: activeToken });
    expect(data.expenses.length).toBe(1);
    expect(data.expenses[0].title).toBe("Lunch");
    // PII (paid_by) 미포함 확인
    expect(Object.keys(data.expenses[0])).not.toContain("paidBy");
    expect(Object.keys(data.expenses[0])).not.toContain("paid_by");
  });

  it("schedule 섹션은 camelCase (dayNumber, placeName)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (anonC as any).rpc("get_guest_trip_data", { p_token: activeToken });
    expect(data.scheduleByDay.length).toBeGreaterThan(0);
    const day = data.scheduleByDay[0];
    expect(Object.keys(day)).toContain("dayNumber");
    expect(Object.keys(day)).toContain("date");
    expect(Object.keys(day)).toContain("items");
  });

  it("expired token → null (에러 없음)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (anonC as any).rpc("get_guest_trip_data", { p_token: expiredToken });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("inactive token → null (에러 없음)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (anonC as any).rpc("get_guest_trip_data", { p_token: inactiveToken });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("존재하지 않는 랜덤 UUID → null (에러 없음, 존재 leak 방지)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (anonC as any).rpc("get_guest_trip_data", {
      p_token: "00000000-0000-0000-0000-000000000000",
    });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});
