"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export type UpdateScheduleItemInput = {
  tripId: string;
  itemId: string;
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

export function useUpdateScheduleItem() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateScheduleItemInput): Promise<void> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("update_schedule_item", {
        p_item_id: input.itemId,
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
    },
    onSuccess: (_v, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.schedule.byTripId(vars.tripId) });
    },
  });
}
