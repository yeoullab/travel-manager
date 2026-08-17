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

function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
}

let aliceId = "", malloryId = "";
let alice: SupabaseClient<Database>, mallory: SupabaseClient<Database>;
let aliceTripId = "", aliceDay1Id = "";
let malloryTripId = "";

beforeAll(async () => {
  for (const [name, setId, setClient] of [
    ["alice", (v: string) => (aliceId = v), (c: SupabaseClient<Database>) => (alice = c)],
    ["mallory", (v: string) => (malloryId = v), (c: SupabaseClient<Database>) => (mallory = c)],
  ] as const) {
    const email = `cand_${name}+${STAMP}@test.local`;
    const u = await admin.auth.admin.createUser({ email, password: PWD, email_confirm: true });
    if (u.error) throw u.error;
    setId(u.data.user!.id);
    const c = anonClient();
    await c.auth.signInWithPassword({ email, password: PWD });
    setClient(c);
  }

  const { data: at } = await alice.rpc("create_trip", {
    p_title: "AliceT", p_destination: "Jeju",
    p_start_date: "2026-09-01", p_end_date: "2026-09-04",
    p_is_domestic: true, p_currencies: [],
  });
  aliceTripId = at as string;
  const { data: ad } = await alice
    .from("trip_days").select("id").eq("trip_id", aliceTripId).eq("day_number", 1).single();
  aliceDay1Id = ad!.id;

  const { data: mt } = await mallory.rpc("create_trip", {
    p_title: "MalT", p_destination: "Busan",
    p_start_date: "2026-09-01", p_end_date: "2026-09-02",
    p_is_domestic: true, p_currencies: [],
  });
  malloryTripId = mt as string;
});

afterAll(async () => {
  await admin.from("trips").delete().eq("id", aliceTripId);
  await admin.from("trips").delete().eq("id", malloryTripId);
  await admin.auth.admin.deleteUser(aliceId);
  await admin.auth.admin.deleteUser(malloryId);
});

describe("RLS: trip_id 위조 삽입 차단", () => {
  it("남의 trip_day_id + 내 trip_id 직접 insert 는 거부된다", async () => {
    const { error } = await mallory.from("schedule_items").insert({
      trip_day_id: aliceDay1Id,   // 남(alice)의 day
      trip_id: malloryTripId,     // 자기 trip — OR 정책이면 뚫리는 조합
      title: "forged",
      sort_order: 999,
      is_candidate: false,
    });
    expect(error).not.toBeNull(); // RLS 또는 복합 FK 위반 — 어느 쪽이든 거부
  });

  it("남의 trip_id 로 풀 후보 직접 insert 도 거부된다", async () => {
    const { error } = await mallory.from("schedule_items").insert({
      trip_day_id: null,
      trip_id: aliceTripId,
      title: "forged-pool",
      sort_order: 999,
      is_candidate: true,
    });
    expect(error).not.toBeNull();
  });
});

describe("resize 축소: 일자 후보 → 풀", () => {
  it("삭제되는 날의 후보는 풀로, 본 일정은 마지막 유지일로 간다", async () => {
    const { data: days } = await alice
      .from("trip_days").select("id, day_number")
      .eq("trip_id", aliceTripId).order("day_number");
    const day4 = days![3].id;
    await alice.rpc("create_schedule_item", { p_trip_day_id: day4, p_title: "d4-main" });
    await alice.rpc("create_schedule_item", {
      p_trip_day_id: day4, p_title: "d4-cand", p_is_candidate: true,
    });

    const { error } = await alice.rpc("resize_trip_days", {
      p_trip_id: aliceTripId,
      p_new_start: "2026-09-01",
      p_new_end: "2026-09-03", // 4일 → 3일
    });
    expect(error).toBeNull();

    const { data: pool } = await alice
      .from("schedule_items").select("title, sort_order, is_candidate")
      .eq("trip_id", aliceTripId).is("trip_day_id", null).order("sort_order");
    expect(pool!.map((r) => r.title)).toContain("d4-cand");
    expect(pool!.every((r) => r.is_candidate)).toBe(true);
    expect(pool!.map((r) => r.sort_order)).toEqual(pool!.map((_, i) => i + 1));

    const day3 = days![2].id;
    const { data: kept } = await alice
      .from("schedule_items").select("title")
      .eq("trip_day_id", day3).eq("is_candidate", false);
    expect(kept!.map((r) => r.title)).toContain("d4-main");
  });
});

describe("게스트 공유: 후보 제외", () => {
  it("get_guest_trip_data 는 후보를 반환하지 않는다", async () => {
    await alice.rpc("create_schedule_item", {
      p_trip_day_id: aliceDay1Id, p_title: "guest-visible",
    });
    await alice.rpc("create_schedule_item", {
      p_trip_day_id: aliceDay1Id, p_title: "guest-hidden-cand", p_is_candidate: true,
    });
    const { data: share, error: shareError } = await alice
      .from("guest_shares")
      .insert({
        trip_id: aliceTripId,
        show_schedule: true,
        show_expenses: false,
        show_todos: false,
        show_records: false,
      })
      .select("token")
      .single();
    expect(shareError).toBeNull();
    const token = share!.token;
    const guest = anonClient();
    const { data } = await guest.rpc("get_guest_trip_data", { p_token: token });
    const json = JSON.stringify(data);
    expect(json).toContain("guest-visible");
    expect(json).not.toContain("guest-hidden-cand");
  });
});
