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
      // schedule_items 는 trip_day_id 만 가지므로 trip_days 와 inner join 으로 tripId 필터.
      const { data, error } = await supabase
        .from("schedule_items")
        .select("*, trip_days!inner(trip_id)")
        .eq("trip_days.trip_id", tripId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as Array<ScheduleItem & { trip_days: unknown }>).map((row) => {
        const { trip_days: _j, ...item } = row;
        return item as ScheduleItem;
      });
    },
    staleTime: 10_000,
  });
}
