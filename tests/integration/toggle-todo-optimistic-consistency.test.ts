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
let todoId = "";

beforeAll(async () => {
  const { data: u, error } = await admin.auth.admin.createUser({
    email: `alicett+${STAMP}@test.local`,
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
    email: `alicett+${STAMP}@test.local`,
    password: PWD,
  });

  const r = await aliceC.rpc("create_trip", {
    p_title: "Toggle Test",
    p_destination: "Seoul",
    p_start_date: "2026-06-01",
    p_end_date: "2026-06-02",
    p_is_domestic: true,
    p_currencies: ["KRW"],
  });
  if (r.error) throw r.error;
  tripId = r.data as string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = await (aliceC as any).rpc("create_todo", {
    p_trip_id: tripId,
    p_title: "Pack bag",
    p_memo: null,
    p_assigned_to: null,
  });
  if (t.error) throw t.error;
  todoId = t.data as string;
}, 30_000);

afterAll(async () => {
  await admin.from("todos").delete().eq("trip_id", tripId);
  await admin.from("trips").delete().eq("id", tripId);
  if (aliceId) await admin.auth.admin.deleteUser(aliceId);
});

describe("toggle_todo — row 일관성 검증", () => {
  it("초기 is_completed = false", async () => {
    const { data } = await aliceC
      .from("todos")
      .select("is_completed")
      .eq("id", todoId)
      .single();
    expect(data?.is_completed).toBe(false);
  });

  it("toggle(true) 후 row 값 true", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (aliceC as any).rpc("toggle_todo", {
      p_todo_id: todoId,
      p_complete: true,
    });
    expect(error).toBeNull();
    const { data } = await aliceC
      .from("todos")
      .select("is_completed")
      .eq("id", todoId)
      .single();
    expect(data?.is_completed).toBe(true);
  });

  it("toggle(false) 후 row 값 false", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (aliceC as any).rpc("toggle_todo", {
      p_todo_id: todoId,
      p_complete: false,
    });
    expect(error).toBeNull();
    const { data } = await aliceC
      .from("todos")
      .select("is_completed")
      .eq("id", todoId)
      .single();
    expect(data?.is_completed).toBe(false);
  });

  it("존재하지 않는 todo_id → todo_not_found", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (aliceC as any).rpc("toggle_todo", {
      p_todo_id: "00000000-0000-0000-0000-000000000000",
      p_complete: true,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/todo_not_found/);
  });
});
