import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
let userId = "";
let userC: SupabaseClient<Database>;
let tripId = "";
let day1 = "";
let day2 = "";
let a = "";
let b = "";

beforeAll(async () => {
  const u = await admin.auth.admin.createUser({
    email: `move+${STAMP}@test.local`,
    password: PWD,
    email_confirm: true,
  });
  if (u.error) throw u.error;
  userId = u.data.user!.id;
  userC = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  await userC.auth.signInWithPassword({
    email: `move+${STAMP}@test.local`,
    password: PWD,
  });

  const { data: tid } = await userC.rpc("create_trip", {
    p_title: "T",
    p_destination: "Seoul",
    p_start_date: "2026-06-01",
    p_end_date: "2026-06-03",
    p_is_domestic: true,
    p_currencies: [],
  });
  tripId = tid as string;
  const { data: days } = await userC
    .from("trip_days")
    .select("id, day_number")
    .eq("trip_id", tripId)
    .order("day_number");
  day1 = days![0].id;
  day2 = days![1].id;
  const { data: ida } = await userC.rpc("create_schedule_item", {
    p_trip_day_id: day1,
    p_title: "A",
  });
  a = ida as string;
  const { data: idb } = await userC.rpc("create_schedule_item", {
    p_trip_day_id: day1,
    p_title: "B",
  });
  b = idb as string;
});

afterAll(async () => {
  await admin.from("trips").delete().eq("id", tripId);
  await admin.auth.admin.deleteUser(userId);
});

describe("move_schedule_item_across_days", () => {
  it("day1 → day2 position=1 로 이동하면 양쪽 모두 재번호된다", async () => {
    const { error } = await userC.rpc("move_schedule_item_across_days", {
      p_item_id: b,
      p_target_day_id: day2,
      p_target_position: 1,
    });
    expect(error).toBeNull();
    const { data: d1 } = await userC
      .from("schedule_items")
      .select("id, sort_order")
      .eq("trip_day_id", day1)
      .order("sort_order");
    expect(d1).toEqual([{ id: a, sort_order: 1 }]);
    const { data: d2 } = await userC
      .from("schedule_items")
      .select("id, sort_order, trip_day_id")
      .eq("trip_day_id", day2);
    expect(d2).toEqual([{ id: b, sort_order: 1, trip_day_id: day2 }]);
  });

  it("same-day 호출 → use_reorder_for_same_day", async () => {
    const { error } = await userC.rpc("move_schedule_item_across_days", {
      p_item_id: a,
      p_target_day_id: day1,
      p_target_position: 1,
    });
    expect(error?.message).toMatch(/use_reorder_for_same_day/);
  });

  it("범위 밖 position → invalid_target_position", async () => {
    const { error } = await userC.rpc("move_schedule_item_across_days", {
      p_item_id: a,
      p_target_day_id: day2,
      p_target_position: 99,
    });
    expect(error?.message).toMatch(/invalid_target_position/);
  });
});
