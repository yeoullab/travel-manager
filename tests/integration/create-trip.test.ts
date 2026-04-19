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
  const a = await admin.auth.admin.createUser({ email: `alice_trip+${STAMP}@test.local`, password: PWD, email_confirm: true });
  if (a.error) throw a.error; aliceId = a.data.user!.id;
  const b = await admin.auth.admin.createUser({ email: `bob_trip+${STAMP}@test.local`, password: PWD, email_confirm: true });
  if (b.error) throw b.error; bobId = b.data.user!.id;

  aliceC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: ae } = await aliceC.auth.signInWithPassword({ email: `alice_trip+${STAMP}@test.local`, password: PWD });
  if (ae) throw ae;
  bobC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: be } = await bobC.auth.signInWithPassword({ email: `bob_trip+${STAMP}@test.local`, password: PWD });
  if (be) throw be;
});
afterAll(async () => {
  await admin.from("trips").delete().or(`created_by.eq.${aliceId},created_by.eq.${bobId}`);
  await admin.from("group_members").delete().or(`user_id.eq.${aliceId},user_id.eq.${bobId}`);
  await admin.from("groups").delete().or(`created_by.eq.${aliceId}`);
  for (const id of [aliceId, bobId]) await admin.auth.admin.deleteUser(id);
});

describe("create_trip RPC", () => {
  it("활성 그룹 없으면 group_id = null 로 생성", async () => {
    const tripId: string = await aliceC.rpc("create_trip", {
      p_title: "Solo", p_destination: "Busan", p_start_date: "2026-06-01", p_end_date: "2026-06-02",
      p_is_domestic: true, p_currencies: [],
    }).then((r) => r.data as string);

    const { data } = await aliceC.from("trips").select("group_id").eq("id", tripId).single();
    expect(data?.group_id).toBeNull();
    await aliceC.from("trips").delete().eq("id", tripId);
  });

  it("활성 그룹 있으면 auto-link", async () => {
    const { data: inv } = await aliceC.rpc("create_invite");
    const code = (inv as { invite_code: string }).invite_code;
    await bobC.rpc("accept_invite", { p_invite_code: code });

    const tripId: string = await aliceC.rpc("create_trip", {
      p_title: "Shared", p_destination: "Jeju", p_start_date: "2026-07-01", p_end_date: "2026-07-03",
      p_is_domestic: true, p_currencies: ["KRW"],
    }).then((r) => r.data as string);

    const { data } = await aliceC.from("trips").select("group_id").eq("id", tripId).single();
    expect(data?.group_id).not.toBeNull();

    await aliceC.from("trips").delete().eq("id", tripId);
    await aliceC.rpc("dissolve_group");
  });

  it("title 101자 → CHECK 위반 거부", async () => {
    const { error } = await aliceC.rpc("create_trip", {
      p_title: "A".repeat(101), p_destination: "Seoul", p_start_date: "2026-06-01", p_end_date: "2026-06-02",
      p_is_domestic: true, p_currencies: [],
    });
    expect(error).not.toBeNull();
  });

  it("기간 91일 → CHECK 위반 거부", async () => {
    const { error } = await aliceC.rpc("create_trip", {
      p_title: "Long", p_destination: "Seoul", p_start_date: "2026-01-01", p_end_date: "2026-04-02",
      p_is_domestic: true, p_currencies: [],
    });
    expect(error).not.toBeNull();
  });

  it("currencies 6개 → CHECK 위반 거부", async () => {
    const { error } = await aliceC.rpc("create_trip", {
      p_title: "Multi", p_destination: "Seoul", p_start_date: "2026-06-01", p_end_date: "2026-06-02",
      p_is_domestic: false, p_currencies: ["KRW","JPY","USD","EUR","CNY","THB"],
    });
    expect(error).not.toBeNull();
  });
});
