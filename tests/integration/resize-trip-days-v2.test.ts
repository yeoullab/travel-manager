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

beforeAll(async () => {
  const a = await admin.auth.admin.createUser({
    email: `alice_resize+${STAMP}@test.local`,
    password: PWD,
    email_confirm: true,
  });
  if (a.error) throw a.error;
  aliceId = a.data.user!.id;
  aliceC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await aliceC.auth.signInWithPassword({
    email: `alice_resize+${STAMP}@test.local`,
    password: PWD,
  });
  if (error) throw error;
});

afterAll(async () => {
  await admin.from("trips").delete().eq("created_by", aliceId);
  await admin.auth.admin.deleteUser(aliceId);
});

async function mkTrip(days: number): Promise<{ tripId: string; dayIds: string[] }> {
  const end = new Date("2026-06-01");
  end.setDate(end.getDate() + days - 1);
  const r = await aliceC.rpc("create_trip", {
    p_title: `Resize ${days}d`,
    p_destination: "Seoul",
    p_start_date: "2026-06-01",
    p_end_date: end.toISOString().slice(0, 10),
    p_is_domestic: true,
    p_currencies: ["KRW"],
  });
  if (r.error) throw r.error;
  const tripId = r.data as string;
  const { data } = await aliceC
    .from("trip_days")
    .select("id")
    .eq("trip_id", tripId)
    .order("day_number");
  return { tripId, dayIds: (data ?? []).map((d) => d.id) };
}

async function addItem(dayId: string, title: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await (aliceC as any).rpc("create_schedule_item", {
    p_trip_day_id: dayId,
    p_title: title,
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
  if (r.error) throw r.error;
  return r.data as string;
}

describe("resize_trip_days v2 — day 보존 + items 합병", () => {
  it("C1: 3→5 확장, items 보존, day_number 재할당", async () => {
    const { tripId, dayIds } = await mkTrip(3);
    const it1 = await addItem(dayIds[0], "D1 item");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (aliceC as any).rpc("resize_trip_days", {
      p_trip_id: tripId,
      p_new_start: "2026-06-01",
      p_new_end: "2026-06-05",
    });
    expect(error).toBeNull();
    const { data } = await aliceC.from("schedule_items").select("id").eq("id", it1);
    expect(data?.length).toBe(1);
  });

  it("C2: 5→3 축소, Day 4·5 items → Day 3 합병, sort_order 연속 번호", async () => {
    const { tripId, dayIds } = await mkTrip(5);
    await addItem(dayIds[2], "D3 item A");
    await addItem(dayIds[3], "D4 item B");
    await addItem(dayIds[4], "D5 item C");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (aliceC as any).rpc("resize_trip_days", {
      p_trip_id: tripId,
      p_new_start: "2026-06-01",
      p_new_end: "2026-06-03",
    });
    expect(error).toBeNull();

    const { data: newDays } = await aliceC
      .from("trip_days")
      .select("id, day_number")
      .eq("trip_id", tripId)
      .order("day_number");
    expect(newDays?.length).toBe(3);
    const day3Id = newDays![2].id;

    const { data: merged } = await aliceC
      .from("schedule_items")
      .select("title, sort_order")
      .eq("trip_day_id", day3Id)
      .order("sort_order");
    expect(merged?.length).toBe(3);
    expect(merged!.map((m) => m.sort_order)).toEqual([1, 2, 3]);
    expect(merged!.map((m) => m.title)).toEqual(["D3 item A", "D4 item B", "D5 item C"]);
  });

  it("C3: 3→3 동일 길이 (no-op) — 실패 없이 통과, 스키마 불변", async () => {
    const { tripId, dayIds } = await mkTrip(3);
    const it1 = await addItem(dayIds[0], "D1");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (aliceC as any).rpc("resize_trip_days", {
      p_trip_id: tripId,
      p_new_start: "2026-06-01",
      p_new_end: "2026-06-03",
    });
    expect(error).toBeNull();
    const { data: days } = await aliceC
      .from("trip_days")
      .select("id, day_number")
      .eq("trip_id", tripId)
      .order("day_number");
    expect(days?.length).toBe(3);
    const { data: stillHere } = await aliceC
      .from("schedule_items")
      .select("id")
      .eq("id", it1);
    expect(stillHere?.length).toBe(1);
  });

  it("C4: 3→3 date shift (시작일 하루 이동) — trip_day.id 보존, date 만 UPDATE", async () => {
    const { tripId, dayIds } = await mkTrip(3);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (aliceC as any).rpc("resize_trip_days", {
      p_trip_id: tripId,
      p_new_start: "2026-06-02",
      p_new_end: "2026-06-04",
    });
    expect(error).toBeNull();
    const { data: days } = await aliceC
      .from("trip_days")
      .select("id, date")
      .eq("trip_id", tripId)
      .order("day_number");
    expect(days?.length).toBe(3);
    expect(days![0].id).toBe(dayIds[0]);
    expect(days![0].date).toBe("2026-06-02");
    expect(days![2].date).toBe("2026-06-04");
  });

  it("C5: 7→1 극단 축소 — 모든 items 가 Day 1 에 합쳐짐 + sort_order 재번호", async () => {
    const { tripId, dayIds } = await mkTrip(7);
    await addItem(dayIds[0], "A");
    await addItem(dayIds[2], "B");
    await addItem(dayIds[4], "C");
    await addItem(dayIds[6], "D");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (aliceC as any).rpc("resize_trip_days", {
      p_trip_id: tripId,
      p_new_start: "2026-06-01",
      p_new_end: "2026-06-01",
    });
    expect(error).toBeNull();

    const { data: days } = await aliceC.from("trip_days").select("id").eq("trip_id", tripId);
    expect(days?.length).toBe(1);

    const { data: merged } = await aliceC
      .from("schedule_items")
      .select("title, sort_order")
      .eq("trip_day_id", days![0].id)
      .order("sort_order");
    expect(merged?.length).toBe(4);
    expect(merged!.map((m) => m.title)).toEqual(["A", "B", "C", "D"]);
    expect(merged!.map((m) => m.sort_order)).toEqual([1, 2, 3, 4]);
  });

  it("C6: new_end < new_start → 예외 거부", async () => {
    const { tripId } = await mkTrip(3);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (aliceC as any).rpc("resize_trip_days", {
      p_trip_id: tripId,
      p_new_start: "2026-06-05",
      p_new_end: "2026-06-01",
    });
    expect(error).not.toBeNull();
  });

  it("C7: 91일 초과 → CHECK 위반 거부", async () => {
    const { tripId } = await mkTrip(3);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (aliceC as any).rpc("resize_trip_days", {
      p_trip_id: tripId,
      p_new_start: "2026-06-01",
      p_new_end: "2026-10-01",
    });
    expect(error).not.toBeNull();
  });

  it("C8: 비멤버가 호출 → RLS/권한 차단", async () => {
    const { tripId } = await mkTrip(3);
    const { data: stranger, error: sErr } = await admin.auth.admin.createUser({
      email: `stranger_resize+${STAMP}@test.local`,
      password: PWD,
      email_confirm: true,
    });
    if (sErr) throw sErr;
    const strangerC = createClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false } },
    );
    await strangerC.auth.signInWithPassword({
      email: `stranger_resize+${STAMP}@test.local`,
      password: PWD,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (strangerC as any).rpc("resize_trip_days", {
      p_trip_id: tripId,
      p_new_start: "2026-06-01",
      p_new_end: "2026-06-05",
    });
    expect(error).not.toBeNull();
    await admin.auth.admin.deleteUser(stranger.user!.id);
  });

  it("C9: 축소 시 합병 day 의 sort_order 가 compound key 로 연속", async () => {
    const { tripId, dayIds } = await mkTrip(5);
    await addItem(dayIds[2], "D3 base");
    await addItem(dayIds[3], "D4 merge-1");
    await addItem(dayIds[3], "D4 merge-2");
    await addItem(dayIds[4], "D5 merge");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (aliceC as any).rpc("resize_trip_days", {
      p_trip_id: tripId,
      p_new_start: "2026-06-01",
      p_new_end: "2026-06-03",
    });
    expect(error).toBeNull();

    const { data: days } = await aliceC
      .from("trip_days")
      .select("id, day_number")
      .eq("trip_id", tripId)
      .order("day_number");
    expect(days?.length).toBe(3);
    const lastDayId = days![2].id;
    const { data: merged } = await aliceC
      .from("schedule_items")
      .select("title, sort_order")
      .eq("trip_day_id", lastDayId)
      .order("sort_order");
    expect(merged?.length).toBe(4);
    expect(merged!.map((m) => m.title)).toEqual([
      "D3 base",
      "D4 merge-1",
      "D4 merge-2",
      "D5 merge",
    ]);
    expect(merged!.map((m) => m.sort_order)).toEqual([1, 2, 3, 4]);
  });

  it("C10: 확장 시 새 day (Day 4, 5) 는 items 없음", async () => {
    const { tripId } = await mkTrip(3);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (aliceC as any).rpc("resize_trip_days", {
      p_trip_id: tripId,
      p_new_start: "2026-06-01",
      p_new_end: "2026-06-05",
    });
    expect(error).toBeNull();

    const { data: days } = await aliceC
      .from("trip_days")
      .select("id, day_number")
      .eq("trip_id", tripId)
      .order("day_number");
    expect(days?.length).toBe(5);
    const newDayIds = days!.slice(3).map((d) => d.id);
    const { data: empty } = await aliceC
      .from("schedule_items")
      .select("id")
      .in("trip_day_id", newDayIds);
    expect(empty?.length).toBe(0);
  });
});
