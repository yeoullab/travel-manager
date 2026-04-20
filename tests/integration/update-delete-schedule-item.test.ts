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

beforeAll(async () => {
  const u = await admin.auth.admin.createUser({
    email: `upd_si+${STAMP}@test.local`,
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
    email: `upd_si+${STAMP}@test.local`,
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

  const { data: ida } = await userC.rpc("create_schedule_item", {
    p_trip_day_id: dayId,
    p_title: "A",
    p_time_of_day: "09:00",
  });
  a = ida as string;
  const { data: idb } = await userC.rpc("create_schedule_item", {
    p_trip_day_id: dayId,
    p_title: "B",
    p_time_of_day: "10:00",
  });
  b = idb as string;
});

afterAll(async () => {
  await admin.from("trips").delete().eq("id", tripId);
  await admin.auth.admin.deleteUser(userId);
});

describe("update_schedule_item / delete_schedule_item", () => {
  it("title + time_of_day + memo 를 갱신한다 (trip_day_id 불변)", async () => {
    const { error } = await userC.rpc("update_schedule_item", {
      p_item_id: a,
      p_title: "A-updated",
      p_time_of_day: "11:30",
      p_memo: "m",
    });
    expect(error).toBeNull();
    const { data } = await userC.from("schedule_items").select("*").eq("id", a).single();
    expect(data?.title).toBe("A-updated");
    expect(data?.time_of_day).toBe("11:30:00");
    expect(data?.memo).toBe("m");
    expect(data?.trip_day_id).toBe(dayId);
  });

  it("delete 후 남은 items 의 sort_order 가 1-based gap-free 로 재번호된다", async () => {
    const { error } = await userC.rpc("delete_schedule_item", { p_item_id: a });
    expect(error).toBeNull();
    const { data } = await userC
      .from("schedule_items")
      .select("id, sort_order")
      .eq("trip_day_id", dayId)
      .order("sort_order");
    expect(data).toEqual([{ id: b, sort_order: 1 }]);
  });
});
