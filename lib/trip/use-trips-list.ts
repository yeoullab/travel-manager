"use client";

import { useQuery } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import type { Database } from "@/types/database";

export type TripRow = Database["public"]["Tables"]["trips"]["Row"];

export function useTripsList() {
  const supabase = getBrowserClient();
  return useQuery({
    queryKey: queryKeys.trips.list,
    queryFn: async (): Promise<TripRow[]> => {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    // partner 측 가시성 손실 polling — useTripDetail 와 같은 이유 (Spec §9.2 가정 어긋남, ADR-011)
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
}
