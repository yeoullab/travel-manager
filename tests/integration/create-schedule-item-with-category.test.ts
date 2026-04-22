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
let userId = "";
let userC: SupabaseClient<Database>;
let tripId = "";
let day1Id = "";

beforeAll(async () => {
  const u = await admin.auth.admin.createUser({
    email: `cat_si+${STAMP}@test.local`,
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
    email: `cat_si+${STAMP}@test.local`,
    password: PWD,
  });

  const { data: tid } = await userC.rpc("create_trip", {
    p_title: "CatT",
    p_destination: "Tokyo",
    p_start_date: "2026-07-01",
    p_end_date: "2026-07-02",
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

describe("create_schedule_item with p_category_code (0009)", () => {
  it("defaults to 'other' when p_category_code omitted", async () => {
    const { data: id, error } = await userC.rpc("create_schedule_item", {
      p_trip_day_id: day1Id,
      p_title: "no category",
    });
    expect(error).toBeNull();
    const { data: row } = await userC
      .from("schedule_items")
      .select("category_code")
      .eq("id", id as string)
      .single();
    expect(row?.category_code).toBe("other");
  });

  it("persists explicit category_code", async () => {
    const { data: id, error } = await userC.rpc("create_schedule_item", {
      p_trip_day_id: day1Id,
      p_title: "with category",
      p_category_code: "sightseeing",
    });
    expect(error).toBeNull();
    const { data: row } = await userC
      .from("schedule_items")
      .select("category_code")
      .eq("id", id as string)
      .single();
    expect(row?.category_code).toBe("sightseeing");
  });

  it("rejects invalid category_code with foreign key violation", async () => {
    const { error } = await userC.rpc("create_schedule_item", {
      p_trip_day_id: day1Id,
      p_title: "bad cat",
      p_category_code: "nonexistent_cat",
    });
    expect(error).not.toBeNull();
    // Postgres FK violation SQLSTATE 23503
    expect(error?.code === "23503" || /foreign key/i.test(error?.message ?? "")).toBe(true);
  });
});

describe("update_schedule_item with p_category_code (0009)", () => {
  it("updates category_code", async () => {
    const { data: id } = await userC.rpc("create_schedule_item", {
      p_trip_day_id: day1Id,
      p_title: "to be updated",
      p_category_code: "other",
    });
    const { error: updErr } = await userC.rpc("update_schedule_item", {
      p_item_id: id as string,
      p_title: "to be updated",
      p_category_code: "food",
    });
    expect(updErr).toBeNull();
    const { data: row } = await userC
      .from("schedule_items")
      .select("category_code")
      .eq("id", id as string)
      .single();
    expect(row?.category_code).toBe("food");
  });
});
