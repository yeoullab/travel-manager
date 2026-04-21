import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ALICE } from "../fixtures/users";

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`E2E env missing: ${key}`);
  return v;
}

export function getAdmin() {
  return createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function getAliceClient() {
  const c = createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { persistSession: false } },
  );
  const { error } = await c.auth.signInWithPassword({
    email: ALICE.email,
    password: ALICE.password,
  });
  if (error) throw new Error(`alice signIn: ${error.message}`);
  return c;
}

/** create_trip RPC + trip_days 조회 + schedule items 삽입을 한 번에 수행 */
export async function seedTripWithItems(params: {
  title: string;
  destination?: string;
  startDate: string;
  endDate: string;
  isDomestic: boolean;
  itemsByDay: Record<number, string[]>; // day_number → titles[]
}): Promise<{ tripId: string; dayIds: Record<number, string> }> {
  const c = await getAliceClient();
  const admin = getAdmin();

  const r = await c.rpc("create_trip", {
    p_title: params.title,
    p_destination: params.destination ?? "Seoul",
    p_start_date: params.startDate,
    p_end_date: params.endDate,
    p_is_domestic: params.isDomestic,
    p_currencies: params.isDomestic ? ["KRW"] : ["JPY"],
  });
  if (r.error) throw new Error(`create_trip: ${r.error.message}`);
  const tripId = r.data as string;

  const { data: days, error: dErr } = await admin
    .from("trip_days")
    .select("id, day_number")
    .eq("trip_id", tripId)
    .order("day_number");
  if (dErr) throw new Error(`trip_days: ${dErr.message}`);

  const dayIds: Record<number, string> = {};
  for (const d of days ?? []) dayIds[d.day_number] = d.id;

  for (const [dayNumStr, titles] of Object.entries(params.itemsByDay)) {
    const dayId = dayIds[Number(dayNumStr)];
    if (!dayId) continue;
    for (const title of titles) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ins = await (c as any).rpc("create_schedule_item", {
        p_trip_day_id: dayId,
        p_title: title,
        p_time_of_day: null,
        p_memo: null,
        p_url: null,
        p_place_name: null,
        p_place_address: null,
        p_place_lat: null,
        p_place_lng: null,
        p_place_provider: null,
        p_place_external_id: null,
      });
      if (ins.error) throw new Error(`create_schedule_item "${title}": ${ins.error.message}`);
    }
  }

  await c.auth.signOut({ scope: "local" });
  return { tripId, dayIds };
}

/** alice 소유 trip 을 alice 의 group 과 연결해 공유 상태로 만든다 */
export async function seedSharedTrip(params: {
  title: string;
  startDate: string;
  endDate: string;
}): Promise<string> {
  const c = await getAliceClient();
  const admin = getAdmin();

  const r = await c.rpc("create_trip", {
    p_title: params.title,
    p_destination: "Seoul",
    p_start_date: params.startDate,
    p_end_date: params.endDate,
    p_is_domestic: true,
    p_currencies: ["KRW"],
  });
  if (r.error) throw new Error(`create_trip: ${r.error.message}`);
  const tripId = r.data as string;

  const { data: user } = await c.auth.getUser();
  const { data: group } = await admin
    .from("groups")
    .select("id")
    .eq("created_by", user.user!.id)
    .maybeSingle();

  if (group?.id) {
    const { error } = await admin.from("trips").update({ group_id: group.id }).eq("id", tripId);
    if (error) throw new Error(`set group_id: ${error.message}`);
  }

  await c.auth.signOut({ scope: "local" });
  return tripId;
}
