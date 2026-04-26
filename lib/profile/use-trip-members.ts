"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import type { PublicProfile } from "@/lib/profile/use-profile";

/**
 * trip 의 그룹 멤버만 반환한다.
 *
 * 보안: `profiles_public` view 는 모든 인증 사용자에게 SELECT 가 열려있어
 * 직접 조회하면 prod DB 의 모든 사용자가 노출된다. 따라서 다음 경로로
 * 제한:  trips.group_id → group_members.user_id → profiles_public.id
 * `group_members` RLS (`group_members_select_own_group`) 가 "내 그룹의 멤버만"
 * 으로 1차 차단하므로 cross-group 누수도 방지된다.
 *
 * trip.group_id 가 null (해체됨/공유 OFF) 인 경우 빈 배열.
 */
export function useTripMembers(tripId: string | null | undefined) {
  const supabase = getBrowserClient();
  const query = useQuery({
    queryKey: queryKeys.tripMembers.byTripId(tripId ?? "__none__"),
    enabled: !!tripId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PublicProfile[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: trip, error: tripErr } = await (supabase as any)
        .from("trips")
        .select("group_id")
        .eq("id", tripId!)
        .maybeSingle();
      if (tripErr) throw tripErr;
      const groupId = (trip as { group_id: string | null } | null)?.group_id;
      if (!groupId) return [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: gmRows, error: gmErr } = await (supabase as any)
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId);
      if (gmErr) throw gmErr;

      const userIds = ((gmRows ?? []) as Array<{ user_id: string | null }>)
        .map((r) => r.user_id)
        .filter((v): v is string => !!v);
      if (userIds.length === 0) return [];

      const { data: profiles, error: pErr } = await supabase
        .from("profiles_public")
        .select("*")
        .in("id", userIds);
      if (pErr) throw pErr;
      return profiles ?? [];
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
