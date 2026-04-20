import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createClient,
  type SupabaseClient,
  type RealtimeChannel,
} from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
let aliceId = "";
let bobId = "";
let aliceC: SupabaseClient<Database>;
let bobC: SupabaseClient<Database>;
let tripId = "";

beforeAll(async () => {
  const a = await admin.auth.admin.createUser({
    email: `alicestog+${STAMP}@test.local`,
    password: PWD,
    email_confirm: true,
  });
  if (a.error) throw a.error;
  aliceId = a.data.user!.id;

  const b = await admin.auth.admin.createUser({
    email: `bobstog+${STAMP}@test.local`,
    password: PWD,
    email_confirm: true,
  });
  if (b.error) throw b.error;
  bobId = b.data.user!.id;

  aliceC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  {
    const { error } = await aliceC.auth.signInWithPassword({
      email: `alicestog+${STAMP}@test.local`,
      password: PWD,
    });
    if (error) throw error;
  }

  bobC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  {
    const { error } = await bobC.auth.signInWithPassword({
      email: `bobstog+${STAMP}@test.local`,
      password: PWD,
    });
    if (error) throw error;
  }

  const inv = await aliceC.rpc("create_invite");
  if (inv.error) throw inv.error;
  const code = (inv.data as { invite_code: string }).invite_code;
  const acc = await bobC.rpc("accept_invite", { p_invite_code: code });
  if (acc.error) throw acc.error;

  const trip = await aliceC.rpc("create_trip", {
    p_title: "Share Toggle Realtime",
    p_destination: "Tokyo",
    p_start_date: "2026-06-01",
    p_end_date: "2026-06-03",
    p_is_domestic: false,
    p_currencies: ["JPY"],
  });
  if (trip.error) throw trip.error;
  tripId = trip.data as string;

  const verify = await aliceC.from("trips").select("group_id").eq("id", tripId).single();
  if (verify.error || !verify.data?.group_id) {
    throw new Error(`trip.group_id not populated: ${verify.error?.message ?? "null"}`);
  }
}, 30_000);

afterAll(async () => {
  await admin.from("trips").delete().eq("id", tripId);
  await admin
    .from("group_members")
    .delete()
    .or(`user_id.eq.${aliceId},user_id.eq.${bobId}`);
  await admin.from("groups").delete().eq("created_by", aliceId);
  for (const id of [aliceId, bobId]) await admin.auth.admin.deleteUser(id);
});

describe("Share-toggle realtime payload (§9.5)", () => {
  it(
    "REPLICA IDENTITY FULL 덕분에 UPDATE payload.old 에 group_id 포함",
    async () => {
      const payloads: Array<{
        old: Record<string, unknown>;
        new: Record<string, unknown>;
      }> = [];

      // admin client 로 구독 — RLS bypass. OLD payload 에 group_id 가 실제로 포함되는지
      // (REPLICA IDENTITY FULL 동작) 만 검증. 파트너측 RLS 필터링은 E2E 에서 별도 검증.
      let ch: RealtimeChannel | null = null;
      const subscribed = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("subscribe timeout")), 10_000);
        ch = admin
          .channel(`test-share-toggle-${STAMP}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "trips",
              filter: `id=eq.${tripId}`,
            },
            (payload) => {
              payloads.push({
                old: payload.old as Record<string, unknown>,
                new: payload.new as Record<string, unknown>,
              });
            },
          )
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              clearTimeout(timer);
              resolve();
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              clearTimeout(timer);
              reject(new Error(`subscribe failed: ${status}`));
            }
          });
      });
      await subscribed;

      // 추가 안정화 버퍼 (subscription 상태 → Postgres 변경 감지 준비 완료)
      await new Promise((r) => setTimeout(r, 500));

      const upd = await aliceC.from("trips").update({ group_id: null }).eq("id", tripId);
      expect(upd.error).toBeNull();

      const deadline = Date.now() + 10_000;
      while (payloads.length === 0 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 200));
      }

      expect(payloads.length).toBeGreaterThan(0);
      expect(payloads[0].old.group_id).not.toBeNull();
      expect(payloads[0].new.group_id).toBeNull();

      await admin.removeChannel(ch!);
    },
    20_000,
  );
});
