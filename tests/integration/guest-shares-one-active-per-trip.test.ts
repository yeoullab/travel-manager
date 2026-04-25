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
let tripId = "";

beforeAll(async () => {
  const { data: u, error } = await admin.auth.admin.createUser({
    email: `alicegso+${STAMP}@test.local`,
    password: PWD,
    email_confirm: true,
  });
  if (error) throw error;
  aliceId = u.user!.id;
  aliceC = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  await aliceC.auth.signInWithPassword({
    email: `alicegso+${STAMP}@test.local`,
    password: PWD,
  });

  const r = await aliceC.rpc("create_trip", {
    p_title: "Unique Test",
    p_destination: "Seoul",
    p_start_date: "2026-06-01",
    p_end_date: "2026-06-02",
    p_is_domestic: true,
    p_currencies: ["KRW"],
  });
  if (r.error) throw r.error;
  tripId = r.data as string;
}, 30_000);

afterAll(async () => {
  await admin.from("guest_shares").delete().eq("trip_id", tripId);
  await admin.from("trips").delete().eq("id", tripId);
  if (aliceId) await admin.auth.admin.deleteUser(aliceId);
});

describe("guest_shares — 1 trip = 1 active share (unique index)", () => {
  it("첫 active share INSERT → OK", async () => {
    const { error } = await aliceC
      .from("guest_shares")
      .insert({ trip_id: tripId, is_active: true });
    expect(error).toBeNull();
  });

  it("두 번째 active share INSERT → unique violation (23505)", async () => {
    const { error } = await aliceC
      .from("guest_shares")
      .insert({ trip_id: tripId, is_active: true });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("23505");
  });

  it("inactive share 는 여러 row 가능 (partial unique index WHERE is_active)", async () => {
    // 첫 inactive
    const r1 = await aliceC
      .from("guest_shares")
      .insert({ trip_id: tripId, is_active: false });
    expect(r1.error).toBeNull();
    // 둘째 inactive
    const r2 = await aliceC
      .from("guest_shares")
      .insert({ trip_id: tripId, is_active: false });
    expect(r2.error).toBeNull();
  });

  it("활성 → 비활성 토글 후 새 active INSERT → OK (재활성화 경로)", async () => {
    // 모든 active row 비활성화
    await aliceC.from("guest_shares").update({ is_active: false }).eq("trip_id", tripId);
    // 새 active 생성
    const { error } = await aliceC
      .from("guest_shares")
      .insert({ trip_id: tripId, is_active: true });
    expect(error).toBeNull();
  });
});
