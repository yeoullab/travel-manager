"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export type CreateScheduleItemInput = {
  tripId: string; // invalidate 키 용도 (서버엔 미전달)
  tripDayId: string;
  title: string;
  timeOfDay?: string | null;
  placeName?: string | null;
  placeAddress?: string | null;
  placeLat?: number | null;
  placeLng?: number | null;
  placeProvider?: "naver" | "google" | null;
  placeExternalId?: string | null;
  memo?: string | null;
  url?: string | null;
};

export function useCreateScheduleItem() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateScheduleItemInput): Promise<string> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("create_schedule_item", {
        p_trip_day_id: input.tripDayId,
        p_title: input.title,
        p_time_of_day: input.timeOfDay ?? null,
        p_place_name: input.placeName ?? null,
        p_place_address: input.placeAddress ?? null,
        p_place_lat: input.placeLat ?? null,
        p_place_lng: input.placeLng ?? null,
        p_place_provider: input.placeProvider ?? null,
        p_place_external_id: input.placeExternalId ?? null,
        p_memo: input.memo ?? null,
        p_url: input.url ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_id, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.schedule.byTripId(vars.tripId) });
    },
  });
}
