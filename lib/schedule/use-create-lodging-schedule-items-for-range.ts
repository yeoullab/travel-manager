"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { getBrowserClient } from "@/lib/supabase/browser-client";

export type CreateLodgingScheduleItemsForRangeInput = {
  tripId: string;
  startDayId: string;
  endDayId: string;
  title: string;
  timeOfDay?: string | null;
  placeName?: string | null;
  placeAddress?: string | null;
  placeLat?: number | null;
  placeLng?: number | null;
  placeProvider?: "naver" | "google" | null;
  placeExternalId?: string | null;
  placeExternalUrl?: string | null;
  memo?: string | null;
  url?: string | null;
};

export function useCreateLodgingScheduleItemsForRange() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateLodgingScheduleItemsForRangeInput): Promise<string[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc(
        "create_lodging_schedule_items_for_range",
        {
          p_trip_id: input.tripId,
          p_start_day_id: input.startDayId,
          p_end_day_id: input.endDayId,
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
          p_place_external_url: input.placeExternalUrl ?? null,
        },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (_ids, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.schedule.byTripId(vars.tripId) });
    },
  });
}
