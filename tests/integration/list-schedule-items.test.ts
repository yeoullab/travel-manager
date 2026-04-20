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
let ownerId = "";
let outsiderId = "";
let ownerC: SupabaseClient<Database>;
let outsiderC: SupabaseClient<Database>;
let tripId = "";
let day1Id = "";

beforeAll(async () => {
  const o = await admin.auth.admin.createUser({
    email: `list_owner+${STAMP}@test.local`,
    password: PWD,
    email_confirm: true,
  });
  if (o.error) throw o.error;
  ownerId = o.data.user!.id;
  const x = await admin.auth.admin.createUser({
    email: `list_outsider+${STAMP}@test.local`,
    password: PWD,
    email_confirm: true,
  });
  if (x.error) throw x.error;
  outsiderId = x.data.user!.id;

  ownerC = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  await ownerC.auth.signInWithPassword({
    email: `list_owner+${STAMP}@test.local`,
    password: PWD,
  });

  outsiderC = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  await outsiderC.auth.signInWithPassword({
    email: `list_outsider+${STAMP}@test.local`,
    password: PWD,
  });

  const { data: newTripId, error: e1 } = await ownerC.rpc("create_trip", {
    p_title: "List test",
    p_destination: "Seoul",
    p_start_date: "2026-06-01",
    p_end_date: "2026-06-02",
    p_is_domestic: true,
    p_currencies: [],
  });
  if (e1) throw e1;
  tripId = newTripId as string;

  const { data: day } = await ownerC
    .from("trip_days")
    .select("id")
    .eq("trip_id", tripId)
    .eq("day_number", 1)
    .single();
  day1Id = day!.id;

  const { error: e2 } = await ownerC.rpc("create_schedule_item", {
    p_trip_day_id: day1Id,
    p_title: "Breakfast",
    p_time_of_day: "09:00",
  });
  if (e2) throw e2;
});

afterAll(async () => {
  await admin.from("trips").delete().eq("id", tripId);
  for (const id of [ownerId, outsiderId]) await admin.auth.admin.deleteUser(id);
});

describe("schedule_items 읽기 경로 — RLS", () => {
  it("owner 는 본인 trip 의 items 를 읽을 수 있다", async () => {
    const { data, error } = await ownerC
      .from("schedule_items")
      .select("id, title, sort_order, time_of_day, trip_day_id")
      .eq("trip_day_id", day1Id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].title).toBe("Breakfast");
    expect(data![0].sort_order).toBe(1);
    expect(data![0].time_of_day).toBe("09:00:00");
  });

  it("outsider 는 타인 trip 의 items 를 읽을 수 없다 (0행)", async () => {
    const { data, error } = await outsiderC
      .from("schedule_items")
      .select("*")
      .eq("trip_day_id", day1Id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
