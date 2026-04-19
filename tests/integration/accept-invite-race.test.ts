import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
let aliceId = ""; let bobId = ""; let carolId = "";

async function clientFor(email: string) {
  const c = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password: PWD });
  return c;
}

beforeAll(async () => {
  const a = await admin.auth.admin.createUser({ email: `alice_race+${STAMP}@test.local`, password: PWD, email_confirm: true });
  if (a.error) throw a.error; aliceId = a.data.user!.id;
  const b = await admin.auth.admin.createUser({ email: `bob_race+${STAMP}@test.local`, password: PWD, email_confirm: true });
  if (b.error) throw b.error; bobId = b.data.user!.id;
  const c2 = await admin.auth.admin.createUser({ email: `carol_race+${STAMP}@test.local`, password: PWD, email_confirm: true });
  if (c2.error) throw c2.error; carolId = c2.data.user!.id;
});

afterAll(async () => {
  await admin.from("group_members").delete().or(`user_id.eq.${aliceId},user_id.eq.${bobId},user_id.eq.${carolId}`);
  await admin.from("groups").delete().or(`created_by.eq.${aliceId}`);
  for (const id of [aliceId, bobId, carolId]) if (id) await admin.auth.admin.deleteUser(id);
});

describe("accept_invite race — 20회 루프", () => {
  it("동시 수락 시 1명만 성공하고 나머지는 invite_invalid_or_consumed", async () => {
    const aliceC = await clientFor(`alice_race+${STAMP}@test.local`);
    const bobC   = await clientFor(`bob_race+${STAMP}@test.local`);
    const carolC = await clientFor(`carol_race+${STAMP}@test.local`);

    for (let i = 0; i < 20; i++) {
      await admin.from("group_members").delete().or(`user_id.eq.${bobId},user_id.eq.${carolId}`);
      await admin.from("groups").delete().or(`created_by.eq.${aliceId}`);
      const { data: inv } = await aliceC.rpc("create_invite");
      const code = (inv as { invite_code: string }).invite_code;

      const [r1, r2] = await Promise.all([
        bobC.rpc("accept_invite", { p_invite_code: code }),
        carolC.rpc("accept_invite", { p_invite_code: code }),
      ]);

      const successes = [r1, r2].filter((r) => !r.error).length;
      const failures  = [r1, r2].filter((r) => r.error?.message === "invite_invalid_or_consumed").length;
      expect(successes).toBe(1);
      expect(failures).toBe(1);

      await aliceC.rpc("dissolve_group");
    }
  }, 60_000);
});
