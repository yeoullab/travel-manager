import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const STAMP = Date.now();
const ALICE_EMAIL = `alice_trips+${STAMP}@test.local`;
const BOB_EMAIL = `bob_trips+${STAMP}@test.local`;
const PWD = "Test_Pwd_2026!";
let aliceId = "";
let bobId = "";
let aliceC: SupabaseClient<Database>;
let bobC: SupabaseClient<Database>;

beforeAll(async () => {
  const a = await admin.auth.admin.createUser({ email: ALICE_EMAIL, password: PWD, email_confirm: true });
  if (a.error) throw a.error;
  aliceId = a.data.user!.id;
  const b = await admin.auth.admin.createUser({ email: BOB_EMAIL, password: PWD, email_confirm: true });
  if (b.error) throw b.error;
  bobId = b.data.user!.id;

  aliceC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: ae } = await aliceC.auth.signInWithPassword({ email: ALICE_EMAIL, password: PWD });
  if (ae) throw ae;

  bobC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: be } = await bobC.auth.signInWithPassword({ email: BOB_EMAIL, password: PWD });
  if (be) throw be;
});

afterAll(async () => {
  await admin.from("trips").delete().or(`created_by.eq.${aliceId},created_by.eq.${bobId}`);
  await admin.from("group_members").delete().or(`user_id.eq.${aliceId},user_id.eq.${bobId}`);
  await admin.from("groups").delete().or(`created_by.eq.${aliceId},created_by.eq.${bobId}`);
  if (aliceId) await admin.auth.admin.deleteUser(aliceId);
  if (bobId) await admin.auth.admin.deleteUser(bobId);
});

describe("RLS — trips", () => {
  it("오너는 본인 여행을 CRUD 할 수 있다", async () => {
    const tripId: string = await aliceC.rpc("create_trip", {
      p_title: "Test", p_destination: "Seoul",
      p_start_date: "2026-06-01", p_end_date: "2026-06-03",
      p_is_domestic: true, p_currencies: ["KRW"],
    }).then((r) => r.data as string);
    expect(tripId).toBeTruthy();

    const { data } = await aliceC.from("trips").select("id").eq("id", tripId).single();
    expect(data?.id).toBe(tripId);

    const { error } = await aliceC.from("trips").delete().eq("id", tripId);
    expect(error).toBeNull();
  });

  it("파트너(active group member)는 공유 여행을 SELECT 할 수 있다", async () => {
    const { data: inv } = await aliceC.rpc("create_invite");
    const invCode = (inv as { invite_code: string }).invite_code;
    await bobC.rpc("accept_invite", { p_invite_code: invCode });

    const tripId: string = await aliceC.rpc("create_trip", {
      p_title: "Shared", p_destination: "Jeju",
      p_start_date: "2026-07-01", p_end_date: "2026-07-03",
      p_is_domestic: true, p_currencies: ["KRW"],
    }).then((r) => r.data as string);

    const { data, error } = await bobC.from("trips").select("id").eq("id", tripId).single();
    expect(error).toBeNull();
    expect(data?.id).toBe(tripId);

    await aliceC.from("trips").delete().eq("id", tripId);
    await aliceC.rpc("dissolve_group");
  });

  it("can_access_trip — stranger 는 false", async () => {
    const tripId: string = await aliceC.rpc("create_trip", {
      p_title: "Solo", p_destination: "Busan",
      p_start_date: "2026-08-01", p_end_date: "2026-08-02",
      p_is_domestic: true, p_currencies: [],
    }).then((r) => r.data as string);

    const { data } = await bobC.from("trips").select("id").eq("id", tripId);
    expect(data).toHaveLength(0);

    await aliceC.from("trips").delete().eq("id", tripId);
  });

  it("파트너는 여행 정보를 UPDATE 할 수 없다 (created_by 만 가능)", async () => {
    const { data: inv } = await aliceC.rpc("create_invite");
    const invCode = (inv as { invite_code: string }).invite_code;
    await bobC.rpc("accept_invite", { p_invite_code: invCode });

    const tripId: string = await aliceC.rpc("create_trip", {
      p_title: "Shared2", p_destination: "Daegu",
      p_start_date: "2026-09-01", p_end_date: "2026-09-02",
      p_is_domestic: true, p_currencies: [],
    }).then((r) => r.data as string);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error, count } = await (bobC as any).from("trips").update({ title: "Hacked" }, { count: "exact" }).eq("id", tripId);
    expect(error).toBeNull();
    expect(count).toBe(0);

    await aliceC.from("trips").delete().eq("id", tripId);
    await aliceC.rpc("dissolve_group");
  });
});
