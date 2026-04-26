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
    email: `urlsi+${STAMP}@test.local`,
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
    email: `urlsi+${STAMP}@test.local`,
    password: PWD,
  });

  const { data: tid } = await userC.rpc("create_trip", {
    p_title: "UrlT",
    p_destination: "Tokyo",
    p_start_date: "2026-08-01",
    p_end_date: "2026-08-02",
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

describe("create_schedule_item with p_place_external_url (0020)", () => {
  it("persists place_external_url when provided", async () => {
    const placeUrl = "https://www.google.com/maps/place/?q=place_id:abc123";
    const { data: id, error } = await userC.rpc("create_schedule_item", {
      p_trip_day_id: day1Id,
      p_title: "Shibuya",
      p_place_external_url: placeUrl,
    });
    expect(error).toBeNull();
    const { data: row } = await userC
      .from("schedule_items")
      .select("place_external_url")
      .eq("id", id as string)
      .single();
    expect(row?.place_external_url).toBe(placeUrl);
  });

  it("defaults to null when p_place_external_url omitted (backward compat)", async () => {
    const { data: id, error } = await userC.rpc("create_schedule_item", {
      p_trip_day_id: day1Id,
      p_title: "no url",
    });
    expect(error).toBeNull();
    const { data: row } = await userC
      .from("schedule_items")
      .select("place_external_url")
      .eq("id", id as string)
      .single();
    expect(row?.place_external_url).toBeNull();
  });

  it("rejects non-https? URL via CHECK constraint (0019)", async () => {
    const { error } = await userC.rpc("create_schedule_item", {
      p_trip_day_id: day1Id,
      p_title: "deeplink",
      p_place_external_url: "nmap://place?id=42",
    });
    expect(error).not.toBeNull();
    // CHECK 위반 SQLSTATE 23514
    expect(error?.code === "23514" || /check/i.test(error?.message ?? "")).toBe(true);
  });
});

describe("update_schedule_item with p_place_external_url (0020)", () => {
  it("updates place_external_url", async () => {
    const { data: id } = await userC.rpc("create_schedule_item", {
      p_trip_day_id: day1Id,
      p_title: "to be updated",
    });
    const newUrl = "https://map.naver.com/v5/entry/place/789";
    const { error: updErr } = await userC.rpc("update_schedule_item", {
      p_item_id: id as string,
      p_title: "to be updated",
      p_place_external_url: newUrl,
    });
    expect(updErr).toBeNull();
    const { data: row } = await userC
      .from("schedule_items")
      .select("place_external_url")
      .eq("id", id as string)
      .single();
    expect(row?.place_external_url).toBe(newUrl);
  });

  it("clears place_external_url when null passed", async () => {
    const { data: id } = await userC.rpc("create_schedule_item", {
      p_trip_day_id: day1Id,
      p_title: "to be cleared",
      p_place_external_url: "https://example.com/p/1",
    });
    const { error: updErr } = await userC.rpc("update_schedule_item", {
      p_item_id: id as string,
      p_title: "to be cleared",
      p_place_external_url: undefined,
    });
    expect(updErr).toBeNull();
    const { data: row } = await userC
      .from("schedule_items")
      .select("place_external_url")
      .eq("id", id as string)
      .single();
    expect(row?.place_external_url).toBeNull();
  });
});
