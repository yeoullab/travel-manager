import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
let aliceId = ""; let bobId = "";
let aliceC: SupabaseClient<Database>;
let bobC: SupabaseClient<Database>;

beforeAll(async () => {
  const a = await admin.auth.admin.createUser({ email: `alice_resize+${STAMP}@test.local`, password: PWD, email_confirm: true });
  if (a.error) throw a.error; aliceId = a.data.user!.id;
  const b = await admin.auth.admin.createUser({ email: `bob_resize+${STAMP}@test.local`, password: PWD, email_confirm: true });
  if (b.error) throw b.error; bobId = b.data.user!.id;

  aliceC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: ae } = await aliceC.auth.signInWithPassword({ email: `alice_resize+${STAMP}@test.local`, password: PWD });
  if (ae) throw ae;
  bobC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: be } = await bobC.auth.signInWithPassword({ email: `bob_resize+${STAMP}@test.local`, password: PWD });
  if (be) throw be;
});
afterAll(async () => {
  await admin.from("trips").delete().or(`created_by.eq.${aliceId}`);
  for (const id of [aliceId, bobId]) await admin.auth.admin.deleteUser(id);
});

async function createTestTrip(c: SupabaseClient<Database>, start: string, end: string) {
  return c.rpc("create_trip", { p_title: "T", p_destination: "S", p_start_date: start, p_end_date: end, p_is_domestic: true, p_currencies: [] }).then((r) => r.data as string);
}

describe("resize_trip_days", () => {
  it("확장 — trip_days 수 증가", async () => {
    const id = await createTestTrip(aliceC, "2026-06-01", "2026-06-03");
    await aliceC.rpc("resize_trip_days", { p_trip_id: id, p_new_start: "2026-06-01", p_new_end: "2026-06-05" });
    const { data } = await aliceC.from("trip_days").select("id").eq("trip_id", id);
    expect(data).toHaveLength(5);
    await aliceC.from("trips").delete().eq("id", id);
  });

  it("축소 — trip_days 수 감소", async () => {
    const id = await createTestTrip(aliceC, "2026-07-01", "2026-07-05");
    await aliceC.rpc("resize_trip_days", { p_trip_id: id, p_new_start: "2026-07-01", p_new_end: "2026-07-02" });
    const { data } = await aliceC.from("trip_days").select("id").eq("trip_id", id);
    expect(data).toHaveLength(2);
    await aliceC.from("trips").delete().eq("id", id);
  });

  it("동일 날짜 — trip_days 수 불변", async () => {
    const id = await createTestTrip(aliceC, "2026-08-01", "2026-08-03");
    await aliceC.rpc("resize_trip_days", { p_trip_id: id, p_new_start: "2026-08-01", p_new_end: "2026-08-03" });
    const { data } = await aliceC.from("trip_days").select("id").eq("trip_id", id);
    expect(data).toHaveLength(3);
    await aliceC.from("trips").delete().eq("id", id);
  });

  it("단일 일 — 1개", async () => {
    const id = await createTestTrip(aliceC, "2026-09-01", "2026-09-01");
    await aliceC.rpc("resize_trip_days", { p_trip_id: id, p_new_start: "2026-09-01", p_new_end: "2026-09-01" });
    const { data } = await aliceC.from("trip_days").select("id").eq("trip_id", id);
    expect(data).toHaveLength(1);
    await aliceC.from("trips").delete().eq("id", id);
  });

  it("비소유자 호출 → trip_not_found_or_forbidden", async () => {
    const id = await createTestTrip(aliceC, "2026-10-01", "2026-10-03");
    const { error } = await bobC.rpc("resize_trip_days", { p_trip_id: id, p_new_start: "2026-10-01", p_new_end: "2026-10-02" });
    expect(error?.message).toBe("trip_not_found_or_forbidden");
    await aliceC.from("trips").delete().eq("id", id);
  });

  it("범위 반전 (start > end) → invalid_date_range", async () => {
    const id = await createTestTrip(aliceC, "2026-11-01", "2026-11-03");
    const { error } = await aliceC.rpc("resize_trip_days", { p_trip_id: id, p_new_start: "2026-11-05", p_new_end: "2026-11-01" });
    expect(error?.message).toBe("invalid_date_range");
    await aliceC.from("trips").delete().eq("id", id);
  });

  it("연속 2회 호출 idempotent", async () => {
    const id = await createTestTrip(aliceC, "2026-12-01", "2026-12-03");
    await aliceC.rpc("resize_trip_days", { p_trip_id: id, p_new_start: "2026-12-01", p_new_end: "2026-12-05" });
    await aliceC.rpc("resize_trip_days", { p_trip_id: id, p_new_start: "2026-12-01", p_new_end: "2026-12-05" });
    const { data } = await aliceC.from("trip_days").select("id").eq("trip_id", id);
    expect(data).toHaveLength(5);
    await aliceC.from("trips").delete().eq("id", id);
  });
});
