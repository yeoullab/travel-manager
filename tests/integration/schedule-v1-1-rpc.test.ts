import { randomUUID } from "crypto";
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
let foreignUserId = "";
let userC: SupabaseClient<Database>;
const tripIds: string[] = [];

type TripDay = { id: string; day_number: number };
type RpcError = { message: string; code?: string; details?: string; hint?: string };
type RpcArgs = Record<string, unknown>;

function rpc<T>(fn: string, args: RpcArgs) {
  return rpcFor<T>(userC, fn, args);
}

function rpcFor<T>(client: SupabaseClient<Database>, fn: string, args: RpcArgs) {
  const call = client.rpc.bind(client) as unknown as (
    fn: string,
    args: RpcArgs,
  ) => Promise<{ data: T | null; error: RpcError | null }>;
  return call(fn, args);
}

async function createTestTrip(title: string, days = 3, client = userC) {
  const startDay = 1;
  const endDay = String(startDay + days - 1).padStart(2, "0");
  const { data: tripId, error: tripError } = await client.rpc("create_trip", {
    p_title: title,
    p_destination: "Seoul",
    p_start_date: "2026-09-01",
    p_end_date: `2026-09-${endDay}`,
    p_is_domestic: true,
    p_currencies: [],
  });
  expect(tripError).toBeNull();
  tripIds.push(tripId as string);

  const { data: daysRows, error: daysError } = await client
    .from("trip_days")
    .select("id, day_number")
    .eq("trip_id", tripId as string)
    .order("day_number");
  expect(daysError).toBeNull();
  expect(daysRows).toHaveLength(days);

  return { tripId: tripId as string, days: daysRows as TripDay[] };
}

async function createItem(
  dayId: string,
  title: string,
  extra: Record<string, unknown> = {},
  client = userC,
) {
  const { data: id, error } = await rpcFor<string>(client, "create_schedule_item", {
    p_trip_day_id: dayId,
    p_title: title,
    ...extra,
  });
  expect(error).toBeNull();
  return id as string;
}

beforeAll(async () => {
  const u = await admin.auth.admin.createUser({
    email: `schedule-v11+${STAMP}@test.local`,
    password: PWD,
    email_confirm: true,
  });
  if (u.error) throw u.error;
  userId = u.data.user!.id;

  userC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const signIn = await userC.auth.signInWithPassword({
    email: `schedule-v11+${STAMP}@test.local`,
    password: PWD,
  });
  if (signIn.error) throw signIn.error;
});

afterAll(async () => {
  if (tripIds.length > 0) {
    await admin.from("trips").delete().in("id", tripIds);
  }
  if (userId) {
    await admin.auth.admin.deleteUser(userId);
  }
  if (foreignUserId) {
    await admin.auth.admin.deleteUser(foreignUserId);
  }
});

describe("schedule v1.1 RPCs", () => {
  it("creates and updates manual places without coordinates", async () => {
    const trip = await createTestTrip("manual-place", 2);
    const id = await createItem(trip.days[0].id, "Manual stop", {
      p_place_name: "을지로 수기 장소",
      p_place_address: "서울 중구 을지로 100",
      p_category_code: "sightseeing",
    });

    const { error: updateError } = await rpc<undefined>("update_schedule_item", {
      p_item_id: id,
      p_title: "Manual stop edited",
      p_place_name: "을지로 수정 장소",
      p_place_address: "서울 중구 을지로 200",
      p_memo: "메모는 주소와 섞이지 않는다",
      p_category_code: "food",
    });
    expect(updateError).toBeNull();

    const { data: row, error: rowError } = await userC
      .from("schedule_items")
      .select(
        "title, place_name, place_address, place_lat, place_lng, place_provider, place_external_id, memo, category_code",
      )
      .eq("id", id)
      .single();
    expect(rowError).toBeNull();
    expect(row).toEqual(
      expect.objectContaining({
        title: "Manual stop edited",
        place_name: "을지로 수정 장소",
        place_address: "서울 중구 을지로 200",
        place_lat: null,
        place_lng: null,
        place_provider: null,
        place_external_id: null,
        memo: "메모는 주소와 섞이지 않는다",
        category_code: "food",
      }),
    );
  });

  it("creates lodging items for every day in a selected range", async () => {
    const trip = await createTestTrip("lodging-range", 3);
    const { data: ids, error } = await rpc<string[]>("create_lodging_schedule_items_for_range", {
      p_trip_id: trip.tripId,
      p_start_day_id: trip.days[2].id,
      p_end_day_id: trip.days[0].id,
      p_title: "연박 숙소",
      p_place_name: "연박 호텔",
      p_place_address: "서울 중구 세종대로 1",
      p_memo: "체크인 15:00",
    });
    expect(error).toBeNull();
    expect(ids).toHaveLength(3);

    const { data: rows, error: rowsError } = await userC
      .from("schedule_items")
      .select("id, trip_day_id, title, category_code, place_name, place_address, memo")
      .in("id", ids as string[]);
    expect(rowsError).toBeNull();
    expect(rows).toHaveLength(3);
    expect((ids as string[]).map((id) => rows?.find((row) => row.id === id)?.trip_day_id)).toEqual(
      trip.days.map((day) => day.id),
    );
    for (const day of trip.days) {
      expect(rows?.find((row) => row.trip_day_id === day.id)).toEqual(
        expect.objectContaining({
          title: "연박 숙소",
          category_code: "lodging",
          place_name: "연박 호텔",
          place_address: "서울 중구 세종대로 1",
          memo: "체크인 15:00",
        }),
      );
    }
  });

  it("moves multiple selected items to another day and recompacts both days", async () => {
    const trip = await createTestTrip("bulk-move", 2);
    const a = await createItem(trip.days[0].id, "A");
    const b = await createItem(trip.days[0].id, "B");
    await createItem(trip.days[0].id, "C");
    await createItem(trip.days[1].id, "Existing");

    const { error } = await rpc<undefined>("move_schedule_items_to_day", {
      p_item_ids: [b, a],
      p_target_day_id: trip.days[1].id,
    });
    expect(error).toBeNull();

    const { data: sourceRows } = await userC
      .from("schedule_items")
      .select("title, sort_order")
      .eq("trip_day_id", trip.days[0].id)
      .order("sort_order");
    expect(sourceRows).toEqual([{ title: "C", sort_order: 1 }]);

    const { data: targetRows } = await userC
      .from("schedule_items")
      .select("title, sort_order")
      .eq("trip_day_id", trip.days[1].id)
      .order("sort_order");
    expect(targetRows).toEqual([
      { title: "Existing", sort_order: 1 },
      { title: "B", sort_order: 2 },
      { title: "A", sort_order: 3 },
    ]);
  });

  it("rejects bulk moves with items from another trip", async () => {
    const a = await createTestTrip("bulk-move-source", 2);
    const b = await createTestTrip("bulk-move-other-trip", 2);
    const sourceItem = await createItem(a.days[0].id, "Source A");
    const foreignItem = await createItem(b.days[0].id, "Foreign B");

    const { error } = await rpc<undefined>("move_schedule_items_to_day", {
      p_item_ids: [sourceItem, foreignItem],
      p_target_day_id: a.days[1].id,
    });

    expect(error?.message).toMatch(/mixed_trip_items|target_day_mismatch/);
  });

  it("deletes selected schedule items and recompacts each affected day", async () => {
    const trip = await createTestTrip("bulk-delete", 2);
    const a = await createItem(trip.days[0].id, "A");
    const b = await createItem(trip.days[0].id, "B");
    const c = await createItem(trip.days[0].id, "C");
    const x = await createItem(trip.days[1].id, "X");
    const y = await createItem(trip.days[1].id, "Y");

    const { error } = await rpc<undefined>("delete_schedule_items", {
      p_item_ids: [b, x],
    });
    expect(error).toBeNull();

    const { data: day1Rows, error: day1Error } = await userC
      .from("schedule_items")
      .select("id, title, sort_order")
      .eq("trip_day_id", trip.days[0].id)
      .order("sort_order");
    expect(day1Error).toBeNull();
    expect(day1Rows).toEqual([
      { id: a, title: "A", sort_order: 1 },
      { id: c, title: "C", sort_order: 2 },
    ]);

    const { data: day2Rows, error: day2Error } = await userC
      .from("schedule_items")
      .select("id, title, sort_order")
      .eq("trip_day_id", trip.days[1].id)
      .order("sort_order");
    expect(day2Error).toBeNull();
    expect(day2Rows).toEqual([{ id: y, title: "Y", sort_order: 1 }]);
  });

  it("rejects bulk deletes when any selected id is missing and keeps rows unchanged", async () => {
    const trip = await createTestTrip("bulk-delete-missing", 1);
    const a = await createItem(trip.days[0].id, "A");
    const b = await createItem(trip.days[0].id, "B");

    const { error } = await rpc<undefined>("delete_schedule_items", {
      p_item_ids: [a, randomUUID()],
    });
    expect(error?.message).toMatch(/missing_schedule_items/);

    const { data: rows, error: rowsError } = await userC
      .from("schedule_items")
      .select("id, title, sort_order")
      .eq("trip_day_id", trip.days[0].id)
      .order("sort_order");
    expect(rowsError).toBeNull();
    expect(rows).toEqual([
      { id: a, title: "A", sort_order: 1 },
      { id: b, title: "B", sort_order: 2 },
    ]);
  });

  it("rejects duplicate selected ids and keeps rows unchanged", async () => {
    const trip = await createTestTrip("bulk-delete-duplicates", 1);
    const a = await createItem(trip.days[0].id, "A");
    const b = await createItem(trip.days[0].id, "B");

    const { error } = await rpc<undefined>("delete_schedule_items", {
      p_item_ids: [a, a],
    });
    expect(error?.message).toMatch(/duplicate_item_ids/);

    const { data: rows, error: rowsError } = await userC
      .from("schedule_items")
      .select("id, title, sort_order")
      .eq("trip_day_id", trip.days[0].id)
      .order("sort_order");
    expect(rowsError).toBeNull();
    expect(rows).toEqual([
      { id: a, title: "A", sort_order: 1 },
      { id: b, title: "B", sort_order: 2 },
    ]);
  });

  it("rejects empty bulk delete input", async () => {
    const { error } = await rpc<undefined>("delete_schedule_items", {
      p_item_ids: [],
    });
    expect(error?.message).toMatch(/empty_item_ids/);
  });

  it("rejects bulk deletes with items from multiple trips", async () => {
    const aTrip = await createTestTrip("bulk-delete-trip-a", 1);
    const bTrip = await createTestTrip("bulk-delete-trip-b", 1);
    const a = await createItem(aTrip.days[0].id, "A");
    const b = await createItem(bTrip.days[0].id, "B");

    const { error } = await rpc<undefined>("delete_schedule_items", {
      p_item_ids: [a, b],
    });
    expect(error?.message).toMatch(/mixed_trip_items/);

    const { data: aRows, error: aRowsError } = await userC
      .from("schedule_items")
      .select("id, title, sort_order")
      .eq("trip_day_id", aTrip.days[0].id)
      .order("sort_order");
    expect(aRowsError).toBeNull();
    expect(aRows).toEqual([{ id: a, title: "A", sort_order: 1 }]);

    const { data: bRows, error: bRowsError } = await userC
      .from("schedule_items")
      .select("id, title, sort_order")
      .eq("trip_day_id", bTrip.days[0].id)
      .order("sort_order");
    expect(bRowsError).toBeNull();
    expect(bRows).toEqual([{ id: b, title: "B", sort_order: 1 }]);
  });

  it("rejects bulk deletes with inaccessible items and keeps owned rows unchanged", async () => {
    const u = await admin.auth.admin.createUser({
      email: `schedule-v11-foreign+${STAMP}@test.local`,
      password: PWD,
      email_confirm: true,
      // display_name falls back to email in handle_new_user(); this email exceeds
      // the profiles_display_name_length (<=40) CHECK, so supply a short name.
      user_metadata: { name: "Foreign User" },
    });
    if (u.error) throw u.error;
    foreignUserId = u.data.user!.id;

    const foreignC = createClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: { persistSession: false },
      },
    );
    const signIn = await foreignC.auth.signInWithPassword({
      email: `schedule-v11-foreign+${STAMP}@test.local`,
      password: PWD,
    });
    if (signIn.error) throw signIn.error;

    const ownedTrip = await createTestTrip("bulk-delete-owned-access", 1);
    const ownedA = await createItem(ownedTrip.days[0].id, "Owned A");
    const ownedB = await createItem(ownedTrip.days[0].id, "Owned B");
    const foreignTrip = await createTestTrip("bulk-delete-foreign-access", 1, foreignC);
    const foreignItem = await createItem(foreignTrip.days[0].id, "Foreign", {}, foreignC);

    const { error } = await rpc<undefined>("delete_schedule_items", {
      p_item_ids: [ownedA, foreignItem],
    });
    expect(error?.message).toMatch(/forbidden/);

    const { data: ownedRows, error: ownedRowsError } = await userC
      .from("schedule_items")
      .select("id, title, sort_order")
      .eq("trip_day_id", ownedTrip.days[0].id)
      .order("sort_order");
    expect(ownedRowsError).toBeNull();
    expect(ownedRows).toEqual([
      { id: ownedA, title: "Owned A", sort_order: 1 },
      { id: ownedB, title: "Owned B", sort_order: 2 },
    ]);

    const { data: foreignRows, error: foreignRowsError } = await foreignC
      .from("schedule_items")
      .select("id, title, sort_order")
      .eq("trip_day_id", foreignTrip.days[0].id)
      .order("sort_order");
    expect(foreignRowsError).toBeNull();
    expect(foreignRows).toEqual([{ id: foreignItem, title: "Foreign", sort_order: 1 }]);
  });
});
