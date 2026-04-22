"use client";

import { useQuery } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import type { Database } from "@/types/database";

export type TripRecord = Database["public"]["Tables"]["records"]["Row"];

export function useRecordList(tripId: string | null) {
  const supabase = getBrowserClient();
  return useQuery({
    queryKey: tripId ? queryKeys.records.byTripId(tripId) : ["records", "__idle"],
    enabled: Boolean(tripId),
    queryFn: async (): Promise<TripRecord[]> => {
      if (!tripId) return [];
      const { data, error } = await supabase
        .from("records")
        .select("*")
        .eq("trip_id", tripId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10_000,
  });
}
