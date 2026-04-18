"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import type { PublicProfile } from "@/lib/profile/use-profile";

export function useTripMembers(tripId: string | null | undefined) {
  const supabase = getBrowserClient();
  const query = useQuery({
    queryKey: queryKeys.tripMembers.byTripId(tripId ?? "__none__"),
    enabled: !!tripId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PublicProfile[]> => {
      const { data, error } = await supabase
        .from("profiles_public")
        .select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const lookup = useMemo(() => {
    const map = new Map<string, PublicProfile>();
    for (const p of query.data ?? []) if (p.id) map.set(p.id, p);
    return (id: string | null | undefined): PublicProfile | null => {
      if (!id) return null;
      return map.get(id) ?? null;
    };
  }, [query.data]);

  return { ...query, lookup };
}
