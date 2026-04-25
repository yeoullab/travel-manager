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
    // Realtime postgres_changes UPDATE 가 `new` row 기준 RLS 만 평가해 partner 가
    // 가시성 손실 (trips.group_id: X → null) 을 NOTIFY 로 받지 못한다 (Spec §9.2 가정 어긋남,
    // 실측 결과). 5초 polling 으로 보완 — RLS 가 이미 차단하므로 maybeSingle() 이 null 반환
    // → app/trips/[id]/page.tsx 의 !trip 분기가 <TripUnavailable /> 렌더. ADR-011 참조.
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
}
