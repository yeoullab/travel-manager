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
let dayId = "";
let a = "";
let b = "";
let c = "";

beforeAll(async () => {
  const u = await admin.auth.admin.createUser({
    email: `reorder+${STAMP}@test.local`,
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
    email: `reorder+${STAMP}@test.local`,
    password: PWD,
  });

  const { data: tid } = await userC.rpc("create_trip", {
    p_title: "T",
    p_destination: "Seoul",
    p_start_date: "2026-06-01",
    p_end_date: "2026-06-02",
    p_is_domestic: true,
    p_currencies: [],
  });
  tripId = tid as string;
  const { data: d } = await userC
    .from("trip_days")
    .select("id")
    .eq("trip_id", tripId)
    .eq("day_number", 1)
    .single();
  dayId = d!.id;
  for (const t of ["A", "B", "C"]) {
    const { data: id } = await userC.rpc("create_schedule_item", {
      p_trip_day_id: dayId,
      p_title: t,
      p_time_of_day: "09:00",
    });
    if (t === "A") a = id as string;
    if (t === "B") b = id as string;
    if (t === "C") c = id as string;
  }
});

afterAll(async () => {
  await admin.from("trips").delete().eq("id", tripId);
  await admin.auth.admin.deleteUser(userId);
});

describe("reorder_schedule_items_in_day", () => {
  it("set 이 일치하면 1-based 로 재번호한다", async () => {
    const { error } = await userC.rpc("reorder_schedule_items_in_day", {
      p_trip_day_id: dayId,
      p_item_ids: [c, a, b],
    });
    expect(error).toBeNull();
    const { data } = await userC
      .from("schedule_items")
      .select("id, sort_order")
      .eq("trip_day_id", dayId)
      .order("sort_order");
    expect(data).toEqual([
      { id: c, sort_order: 1 },
      { id: a, sort_order: 2 },
      { id: b, sort_order: 3 },
    ]);
  });

  it("set mismatch (누락 id) → item_set_mismatch", async () => {
    const { error } = await userC.rpc("reorder_schedule_items_in_day", {
      p_trip_day_id: dayId,
      p_item_ids: [c, a],
    });
    expect(error?.message).toMatch(/item_set_mismatch/);
  });

  it("중복 id → duplicate_item_ids", async () => {
    const { error } = await userC.rpc("reorder_schedule_items_in_day", {
      p_trip_day_id: dayId,
      p_item_ids: [a, a, b],
    });
    expect(error?.message).toMatch(/duplicate_item_ids/);
  });
});
