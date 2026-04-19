import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
let aliceId = "";
let aliceC: SupabaseClient<Database>;

beforeAll(async () => {
  const a = await admin.auth.admin.createUser({ email: `alice_updat+${STAMP}@test.local`, password: PWD, email_confirm: true });
  if (a.error) throw a.error; aliceId = a.data.user!.id;
  aliceC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: ae } = await aliceC.auth.signInWithPassword({ email: `alice_updat+${STAMP}@test.local`, password: PWD });
  if (ae) throw ae;
});
afterAll(async () => {
  await admin.from("trips").delete().eq("created_by", aliceId);
  await admin.auth.admin.deleteUser(aliceId);
});

describe("trips updated_at 트리거", () => {
  it("UPDATE 시 updated_at 이 갱신된다", async () => {
    const tripId: string = await aliceC.rpc("create_trip", {
      p_title: "T", p_destination: "S", p_start_date: "2026-06-01", p_end_date: "2026-06-02",
      p_is_domestic: true, p_currencies: [],
    }).then((r) => r.data as string);

    const { data: before } = await aliceC.from("trips").select("updated_at").eq("id", tripId).single();
    await new Promise((r) => setTimeout(r, 1100));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (aliceC as any).from("trips").update({ title: "T2" }).eq("id", tripId);
    const { data: after } = await aliceC.from("trips").select("updated_at").eq("id", tripId).single();

    expect(new Date(after!.updated_at).getTime()).toBeGreaterThan(new Date(before!.updated_at).getTime());
    await aliceC.from("trips").delete().eq("id", tripId);
  });
});
