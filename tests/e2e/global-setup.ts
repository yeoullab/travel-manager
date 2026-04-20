import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ALICE, BOB } from "./fixtures/users";
import { ensureTestUser, buildStorageState } from "./helpers/auth";
import { truncateCascade } from "./helpers/db-reset";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`E2E env missing: ${key}`);
  return value;
}

async function ensureAlicePartnersBob(): Promise<void> {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const aliceC = createClient<Database>(url, anonKey, { auth: { persistSession: false } });
  {
    const { error } = await aliceC.auth.signInWithPassword({
      email: ALICE.email,
      password: ALICE.password,
    });
    if (error) throw new Error(`alice signIn failed: ${error.message}`);
  }

  const inv = await aliceC.rpc("create_invite" as never);
  if ((inv as { error: unknown }).error)
    throw new Error(`create_invite failed: ${JSON.stringify((inv as { error: unknown }).error)}`);
  const code = (inv.data as unknown as { invite_code: string }).invite_code;

  const bobC = createClient<Database>(url, anonKey, { auth: { persistSession: false } });
  {
    const { error } = await bobC.auth.signInWithPassword({
      email: BOB.email,
      password: BOB.password,
    });
    if (error) throw new Error(`bob signIn failed: ${error.message}`);
  }

  const acc = await bobC.rpc("accept_invite" as never, { p_invite_code: code } as never);
  if ((acc as { error: unknown }).error)
    throw new Error(`accept_invite failed: ${JSON.stringify((acc as { error: unknown }).error)}`);

  await aliceC.auth.signOut();
  await bobC.auth.signOut();
}

export default async function globalSetup(): Promise<void> {
  // 1) DB reset — 이전 run 의 test data 제거 (auth.users 는 보존)
  await truncateCascade();

  // 2) 유저 생성/보장 (멱등)
  await ensureTestUser(ALICE);
  await ensureTestUser(BOB);

  // 3) alice ↔ bob 그룹 결성 (partner-dual specs 전제 조건)
  //    truncateCascade 가 이전 group* 를 지웠으므로 항상 새로 결성
  await ensureAlicePartnersBob();

  // 4) storageState — /api/test/sign-in 으로 fresh signIn → cookie 격리 유지
  const aliceState = resolve("tests/e2e/.auth/alice.json");
  const bobState = resolve("tests/e2e/.auth/bob.json");
  await mkdir(dirname(aliceState), { recursive: true });
  await buildStorageState(ALICE, aliceState);
  await buildStorageState(BOB, bobState);
}
