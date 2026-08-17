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
let userId = "";
let userC: SupabaseClient<Database>;
let tripId = "";
let day1Id = "";
let day2Id = "";

// Postgres 함수 인자에는 nullability 메타데이터가 없어 생성 타입이 null을 거부할 수 있다.
// 이 저장소의 기존 integration 테스트와 같은 RPC 경계 캐스트를 한 곳에 모은다.
function callRpc(name: string, args: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (userC as any).rpc(name, args);
}

async function sortOrders(filter: {
  dayId?: string | null;
  isCandidate: boolean;
}): Promise<Array<{ id: string; sort_order: number; title: string }>> {
  let q = userC
    .from("schedule_items")
    .select("id, sort_order, title")
    .eq("trip_id", tripId)
    .eq("is_candidate", filter.isCandidate)
    .order("sort_order");
  q = filter.dayId === null ? q.is("trip_day_id", null) : q.eq("trip_day_id", filter.dayId!);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

beforeAll(async () => {
  const u = await admin.auth.admin.createUser({
    email: `cand+${STAMP}@test.local`,
    password: PWD,
    email_confirm: true,
  });
  if (u.error) throw u.error;
  userId = u.data.user!.id;
  userC = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  await userC.auth.signInWithPassword({ email: `cand+${STAMP}@test.local`, password: PWD });

  const { data: tid } = await callRpc("create_trip", {
    p_title: "CandT",
    p_destination: "Tokyo",
    p_start_date: "2026-09-01",
    p_end_date: "2026-09-03",
    p_is_domestic: false,
    p_currencies: [],
  });
  tripId = tid as string;
  const { data: ds } = await userC
    .from("trip_days")
    .select("id, day_number")
    .eq("trip_id", tripId)
    .order("day_number");
  day1Id = ds![0].id;
  day2Id = ds![1].id;
});

afterAll(async () => {
  await admin.from("trips").delete().eq("id", tripId);
  await admin.auth.admin.deleteUser(userId);
});

describe("candidate creation partitions (0023)", () => {
  it("main / day-candidate / pool 이 각각 독립 시퀀스로 번호를 가진다", async () => {
    // 본 2 + 일자 후보 2 + 풀 2
    for (const t of ["m1", "m2"]) {
      const { error } = await callRpc("create_schedule_item", {
        p_trip_day_id: day1Id,
        p_title: t,
      });
      expect(error).toBeNull();
    }
    for (const t of ["c1", "c2"]) {
      const { error } = await callRpc("create_schedule_item", {
        p_trip_day_id: day1Id,
        p_title: t,
        p_is_candidate: true,
      });
      expect(error).toBeNull();
    }
    for (const t of ["p1", "p2"]) {
      const { error } = await callRpc("create_schedule_item", {
        p_trip_day_id: null,
        p_title: t,
        p_is_candidate: true,
        p_trip_id: tripId,
      });
      expect(error).toBeNull();
    }
    expect((await sortOrders({ dayId: day1Id, isCandidate: false })).map((r) => r.sort_order))
      .toEqual([1, 2]);
    expect((await sortOrders({ dayId: day1Id, isCandidate: true })).map((r) => r.sort_order))
      .toEqual([1, 2]);
    expect((await sortOrders({ dayId: null, isCandidate: true })).map((r) => r.sort_order))
      .toEqual([1, 2]);
  });

  it("day 없이 is_candidate=false 는 에러", async () => {
    const { error } = await callRpc("create_schedule_item", {
      p_trip_day_id: null,
      p_title: "bad",
      p_is_candidate: false,
      p_trip_id: tripId,
    });
    expect(error?.message).toMatch(/dayless_must_be_candidate/);
  });

  it("day 없이 trip_id 도 없으면 에러", async () => {
    const { error } = await callRpc("create_schedule_item", {
      p_trip_day_id: null,
      p_title: "bad2",
      p_is_candidate: true,
    });
    expect(error?.message).toMatch(/trip_id_required/);
  });
});

describe("set_schedule_item_candidacy", () => {
  it("강등: 본 → 같은 일자 후보 끝, 원 파티션 재압축", async () => {
    const mains = await sortOrders({ dayId: day1Id, isCandidate: false });
    const demoted = mains[0]; // m1 (sort 1)
    const { error } = await callRpc("set_schedule_item_candidacy", {
      p_item_id: demoted.id,
      p_is_candidate: true,
      p_target_day_id: day1Id,
    });
    expect(error).toBeNull();
    // 본: m2 만 남고 1로 재압축
    const mainsAfter = await sortOrders({ dayId: day1Id, isCandidate: false });
    expect(mainsAfter.map((r) => [r.title, r.sort_order])).toEqual([["m2", 1]]);
    // 후보: c1,c2 뒤에 m1 이 3번으로
    const candsAfter = await sortOrders({ dayId: day1Id, isCandidate: true });
    expect(candsAfter.map((r) => [r.title, r.sort_order]))
      .toEqual([["c1", 1], ["c2", 2], ["m1", 3]]);
  });

  it("승격: 후보 → 다른 일자 본 일정 끝", async () => {
    const cands = await sortOrders({ dayId: day1Id, isCandidate: true });
    const promoted = cands[0]; // c1
    const { error } = await callRpc("set_schedule_item_candidacy", {
      p_item_id: promoted.id,
      p_is_candidate: false,
      p_target_day_id: day2Id,
    });
    expect(error).toBeNull();
    const day2Mains = await sortOrders({ dayId: day2Id, isCandidate: false });
    expect(day2Mains.map((r) => [r.title, r.sort_order])).toEqual([["c1", 1]]);
    // day1 후보 재압축: c2=1, m1=2
    const day1Cands = await sortOrders({ dayId: day1Id, isCandidate: true });
    expect(day1Cands.map((r) => [r.title, r.sort_order])).toEqual([["c2", 1], ["m1", 2]]);
  });

  it("풀 이동: 일자 후보 → 풀 끝", async () => {
    const day1Cands = await sortOrders({ dayId: day1Id, isCandidate: true });
    const toPool = day1Cands[0]; // c2
    const { error } = await callRpc("set_schedule_item_candidacy", {
      p_item_id: toPool.id,
      p_is_candidate: true,
      p_target_day_id: null,
    });
    expect(error).toBeNull();
    const pool = await sortOrders({ dayId: null, isCandidate: true });
    expect(pool.map((r) => [r.title, r.sort_order]))
      .toEqual([["p1", 1], ["p2", 2], ["c2", 3]]);
  });

  it("no-op: 이미 대상 파티션이면 에러 없이 순서 유지 (멱등)", async () => {
    const pool = await sortOrders({ dayId: null, isCandidate: true });
    const { error } = await callRpc("set_schedule_item_candidacy", {
      p_item_id: pool[0].id,
      p_is_candidate: true,
      p_target_day_id: null,
    });
    expect(error).toBeNull();
    expect(await sortOrders({ dayId: null, isCandidate: true })).toEqual(pool);
  });

  it("승격에 target day 누락 시 에러", async () => {
    const pool = await sortOrders({ dayId: null, isCandidate: true });
    const { error } = await callRpc("set_schedule_item_candidacy", {
      p_item_id: pool[0].id,
      p_is_candidate: false,
    });
    expect(error?.message).toMatch(/target_day_required/);
  });
});

describe("partition-aware reorder / move / delete", () => {
  it("reorder: 본·후보 혼합 입력은 에러", async () => {
    const mains = await sortOrders({ dayId: day1Id, isCandidate: false });
    const cands = await sortOrders({ dayId: day1Id, isCandidate: true });
    expect(mains.length).toBeGreaterThan(0);
    expect(cands.length).toBeGreaterThan(0);
    const { error } = await callRpc("reorder_schedule_items_in_day", {
      p_trip_day_id: day1Id,
      p_item_ids: [mains[0].id, cands[0].id],
    });
    expect(error?.message).toMatch(/mixed_partition_items|item_set_mismatch/);
  });

  it("reorder: 후보 파티션만 재정렬, 본 일정 순서는 영향 없음", async () => {
    // day1 후보를 2개로 만들고 역순 재정렬
    await callRpc("create_schedule_item", {
      p_trip_day_id: day1Id,
      p_title: "c3",
      p_is_candidate: true,
    });
    const cands = await sortOrders({ dayId: day1Id, isCandidate: true });
    const mainsBefore = await sortOrders({ dayId: day1Id, isCandidate: false });
    const reversed = [...cands].reverse().map((r) => r.id);
    const { error } = await callRpc("reorder_schedule_items_in_day", {
      p_trip_day_id: day1Id,
      p_item_ids: reversed,
    });
    expect(error).toBeNull();
    const candsAfter = await sortOrders({ dayId: day1Id, isCandidate: true });
    expect(candsAfter.map((r) => r.id)).toEqual(reversed);
    expect(await sortOrders({ dayId: day1Id, isCandidate: false })).toEqual(mainsBefore);
  });

  it("move RPC 는 후보 입력을 거부한다", async () => {
    const cands = await sortOrders({ dayId: day1Id, isCandidate: true });
    const { error: e1 } = await callRpc("move_schedule_item_across_days", {
      p_item_id: cands[0].id,
      p_target_day_id: day2Id,
      p_target_position: 1,
    });
    expect(e1?.message).toMatch(/candidate_not_movable_here/);
    const { error: e2 } = await callRpc("move_schedule_items_to_day", {
      p_item_ids: [cands[0].id],
      p_target_day_id: day2Id,
    });
    expect(e2?.message).toMatch(/candidate_not_movable_here/);
  });

  it("풀 후보 update / 단건 delete 가 동작한다", async () => {
    const pool = await sortOrders({ dayId: null, isCandidate: true });
    const target = pool[pool.length - 1];
    const { error: ue } = await callRpc("update_schedule_item", {
      p_item_id: target.id,
      p_title: "pool-updated",
      p_category_code: "cafe",
    });
    expect(ue).toBeNull();
    const { error: de } = await callRpc("delete_schedule_item", {
      p_item_id: target.id,
    });
    expect(de).toBeNull();
    const after = await sortOrders({ dayId: null, isCandidate: true });
    expect(after.map((r) => r.sort_order)).toEqual(after.map((_, i) => i + 1)); // gap 없음
  });

  it("bulk delete: 풀 후보 + 본 일정 섞어 삭제해도 각 파티션이 재압축된다", async () => {
    // 풀 1개 + day1 본 1개 추가 후 함께 삭제
    const { data: poolId } = await callRpc("create_schedule_item", {
      p_trip_day_id: null,
      p_title: "bulk-pool",
      p_is_candidate: true,
      p_trip_id: tripId,
    });
    const { data: mainId } = await callRpc("create_schedule_item", {
      p_trip_day_id: day1Id,
      p_title: "bulk-main",
    });
    const { error } = await callRpc("delete_schedule_items", {
      p_item_ids: [poolId as string, mainId as string],
    });
    expect(error).toBeNull();
    const pool = await sortOrders({ dayId: null, isCandidate: true });
    const mains = await sortOrders({ dayId: day1Id, isCandidate: false });
    expect(pool.map((r) => r.sort_order)).toEqual(pool.map((_, i) => i + 1));
    expect(mains.map((r) => r.sort_order)).toEqual(mains.map((_, i) => i + 1));
  });

  it("cafe 카테고리 FK insert 가 성공한다", async () => {
    const { data: id, error } = await callRpc("create_schedule_item", {
      p_trip_day_id: day1Id,
      p_title: "커피",
      p_category_code: "cafe",
    });
    expect(error).toBeNull();
    const { data: row } = await userC
      .from("schedule_items")
      .select("category_code")
      .eq("id", id as string)
      .single();
    expect(row?.category_code).toBe("cafe");
  });

  it("숙소 범위 생성은 trip_id를 저장하고 후보와 독립된 본 일정 번호를 쓴다", async () => {
    await callRpc("create_schedule_item", {
      p_trip_day_id: day1Id,
      p_title: "candidate-before-lodging",
      p_is_candidate: true,
    });
    const { data: ids, error } = await callRpc("create_lodging_schedule_items_for_range", {
      p_trip_id: tripId,
      p_start_day_id: day1Id,
      p_end_day_id: day2Id,
      p_title: "range-lodging",
    });
    expect(error).toBeNull();
    expect(ids).toHaveLength(2);

    const { data: rows, error: rowsError } = await userC
      .from("schedule_items")
      .select("trip_id, trip_day_id, is_candidate, sort_order")
      .in("id", ids ?? []);
    expect(rowsError).toBeNull();
    expect(rows?.every((r) => r.trip_id === tripId && !r.is_candidate)).toBe(true);

    const day1Main = await sortOrders({ dayId: day1Id, isCandidate: false });
    expect(day1Main.map((r) => r.sort_order)).toEqual(day1Main.map((_, i) => i + 1));
  });

  it("같은 파티션 동시 생성 후 sort_order가 유일하고 연속이다", async () => {
    const before = await sortOrders({ dayId: day2Id, isCandidate: true });
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        callRpc("create_schedule_item", {
          p_trip_day_id: day2Id,
          p_title: `concurrent-${i}`,
          p_is_candidate: true,
        }),
      ),
    );
    expect(results.every((r) => r.error === null)).toBe(true);

    const after = await sortOrders({ dayId: day2Id, isCandidate: true });
    expect(after).toHaveLength(before.length + 5);
    expect(after.map((r) => r.sort_order)).toEqual(after.map((_, i) => i + 1));
  });
});
