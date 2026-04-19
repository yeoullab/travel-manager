"use client";

import { useQuery } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import type { TripRow } from "@/lib/trip/use-trips-list";

export function useTripDetail(id: string) {
  const supabase = getBrowserClient();
  return useQuery({
    queryKey: queryKeys.trips.detail(id),
    queryFn: async (): Promise<TripRow | null> => {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}
