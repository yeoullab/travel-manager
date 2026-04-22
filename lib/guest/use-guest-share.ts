"use client";

import { useQuery } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import type { Database } from "@/types/database";

export type GuestShare = Database["public"]["Tables"]["guest_shares"]["Row"];

/**
 * 현재 활성 guest share (trip 당 1개) 를 반환.
 * 비활성 share 는 감사 목적으로 DB 에 남지만 UI 에선 null.
 */
export function useGuestShare(tripId: string | null) {
  const supabase = getBrowserClient();
  return useQuery({
    queryKey: tripId ? queryKeys.guest.byTripId(tripId) : ["guest", "__idle"],
    enabled: Boolean(tripId),
    queryFn: async (): Promise<GuestShare | null> => {
      if (!tripId) return null;
      const { data, error } = await supabase
        .from("guest_shares")
        .select("*")
        .eq("trip_id", tripId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    staleTime: 30_000,
  });
}
