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
let day1Id = "";

beforeAll(async () => {
  const u = await admin.auth.admin.createUser({
    email: `create_si+${STAMP}@test.local`,
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
    email: `create_si+${STAMP}@test.local`,
    password: PWD,
  });

  const { data: tid } = await userC.rpc("create_trip", {
    p_title: "T",
    p_destination: "Tokyo",
    p_start_date: "2026-06-01",
    p_end_date: "2026-06-02",
    p_is_domestic: false,
    p_currencies: [],
  });
  tripId = tid as string;
  const { data: d } = await userC
    .from("trip_days")
    .select("id")
    .eq("trip_id", tripId)
    .eq("day_number", 1)
    .single();
  day1Id = d!.id;
});

afterAll(async () => {
  await admin.from("trips").delete().eq("id", tripId);
  await admin.auth.admin.deleteUser(userId);
});

describe("create_schedule_item RPC", () => {
  it("sort_order 를 1 부터 자동 배정한다", async () => {
    const { data: id1, error: e1 } = await userC.rpc("create_schedule_item", {
      p_trip_day_id: day1Id,
      p_title: "A",
      p_time_of_day: "09:00",
    });
    expect(e1).toBeNull();
    const { data: id2, error: e2 } = await userC.rpc("create_schedule_item", {
      p_trip_day_id: day1Id,
      p_title: "B",
      p_time_of_day: "10:00",
    });
    expect(e2).toBeNull();

    const { data: rows } = await userC
      .from("schedule_items")
      .select("id, title, sort_order")
      .in("id", [id1 as string, id2 as string])
      .order("sort_order");
    expect(rows).toEqual([
      expect.objectContaining({ id: id1, title: "A", sort_order: 1 }),
      expect.objectContaining({ id: id2, title: "B", sort_order: 2 }),
    ]);
  });

  it("해외 여행인데 place_provider='naver' 면 거절한다 (Patch H)", async () => {
    const { error } = await userC.rpc("create_schedule_item", {
      p_trip_day_id: day1Id,
      p_title: "X",
      p_place_name: "bogus",
      p_place_lat: 35.6,
      p_place_lng: 139.7,
      p_place_provider: "naver",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/place_provider_mismatch/);
  });
});
