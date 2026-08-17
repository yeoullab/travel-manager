"use client";

import { useQuery } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import type { Database } from "@/types/database";

export type ScheduleItem = Database["public"]["Tables"]["schedule_items"]["Row"];

export function useScheduleList(tripId: string | null) {
  const supabase = getBrowserClient();
  return useQuery({
    queryKey: tripId ? queryKeys.schedule.byTripId(tripId) : ["schedule", "__idle"],
    enabled: Boolean(tripId),
    queryFn: async (): Promise<ScheduleItem[]> => {
      if (!tripId) return [];
      // 0023 이후 schedule_items 는 비정규화 trip_id 를 직접 가진다. 풀 후보(trip_day_id null)는
      // inner join 으로는 영원히 조회되지 않으므로 trip_id 직접 필터로 전환한다 (스펙 §7).
      const { data, error } = await supabase
        .from("schedule_items")
        .select("*")
        .eq("trip_id", tripId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10_000,
  });
}
