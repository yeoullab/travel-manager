"use client";

import { useQuery } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import type { Database } from "@/types/database";

export type TripDay = Database["public"]["Tables"]["trip_days"]["Row"];

export function useTripDays(tripId: string | null) {
  const supabase = getBrowserClient();
  return useQuery({
    queryKey: tripId ? queryKeys.tripDays.byTripId(tripId) : ["tripDays", "__idle"],
    enabled: Boolean(tripId),
    queryFn: async (): Promise<TripDay[]> => {
      if (!tripId) return [];
      const { data, error } = await supabase
        .from("trip_days")
        .select("id, trip_id, day_number, date")
        .eq("trip_id", tripId)
        .order("day_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TripDay[];
    },
    staleTime: 60_000,
  });
}
