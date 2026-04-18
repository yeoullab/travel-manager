import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();

const admin = createClient<Database>(
  env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const STAMP = Date.now();
const ALICE = `alice+${STAMP}@test.local`;
const BOB = `bob+${STAMP}@test.local`;
const PASSWORD = "Test_Pwd_2026!";
let aliceId = "";
let bobId = "";

async function clientFor(email: string) {
  const c = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return { c, userId: data.user!.id };
}

beforeAll(async () => {
  const a = await admin.auth.admin.createUser({
    email: ALICE,
    password: PASSWORD,
    email_confirm: true,
  });
  if (a.error) throw a.error;
  aliceId = a.data.user!.id;

  const b = await admin.auth.admin.createUser({
    email: BOB,
    password: PASSWORD,
    email_confirm: true,
  });
  if (b.error) throw b.error;
  bobId = b.data.user!.id;
});

afterAll(async () => {
  if (aliceId) await admin.auth.admin.deleteUser(aliceId);
  if (bobId) await admin.auth.admin.deleteUser(bobId);
});

describe("RLS — profiles 테이블", () => {
  it("본인은 본인 row의 비-email 컬럼을 SELECT 할 수 있다", async () => {
    const { c } = await clientFor(ALICE);
    const { data, error } = await c
      .from("profiles")
      .select("id, display_name, color")
      .eq("id", aliceId)
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBe(aliceId);
    expect(data?.color).toBe("orange");
  });

  it("본인은 본인 row의 color를 UPDATE 할 수 있다", async () => {
    const { c } = await clientFor(ALICE);
    // supabase-js 2.103 update() never 타입 우회 (관련 이슈 참고)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (c as any)
      .from("profiles")
      .update({ color: "blue" })
      .eq("id", aliceId);
    expect(error).toBeNull();
  });

  it("타인의 profiles row UPDATE는 0 rows affected", async () => {
    const { c } = await clientFor(ALICE);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error, count } = await (c as any)
      .from("profiles")
      .update({ color: "rose" }, { count: "exact" })
      .eq("id", bobId);
    expect(error).toBeNull();
    expect(count).toBe(0);
  });

  it("어떤 유저도 profiles의 email 컬럼을 SELECT할 수 없다 (GRANT 차단)", async () => {
    const { c } = await clientFor(ALICE);
    const { data, error } = await c.from("profiles").select("email").eq("id", aliceId);
    // grant가 email 컬럼 제외 → permission denied 또는 빈 결과
    // 어느 쪽이든 응답에 email 데이터가 포함되면 안 됨
    if (!error) {
      for (const row of data ?? []) {
        expect((row as Record<string, unknown>).email).toBeUndefined();
      }
    } else {
      expect(error.message.toLowerCase()).toMatch(/permission|denied|column/);
    }
  });
});

describe("RLS — profiles_public view", () => {
  it("alice가 bob의 public 프로필을 조회 가능 (display_name, color)", async () => {
    const { c } = await clientFor(ALICE);
    const { data, error } = await c
      .from("profiles_public")
      .select("id, display_name, color")
      .eq("id", bobId)
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBe(bobId);
  });

  it("profiles_public에는 email 컬럼이 정의되지 않음", async () => {
    const { c } = await clientFor(ALICE);
    // email은 view 정의에 없음 — PostgREST가 400 반환
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (c as any)
      .from("profiles_public")
      .select("email")
      .eq("id", bobId);
    expect(error).not.toBeNull();
  });
});
