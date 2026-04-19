"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export type ResizeTripDaysInput = {
  tripId: string;
  newStart: string;
  newEnd: string;
};

export function useResizeTripDays() {
  const supabase = getBrowserClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tripId, newStart, newEnd }: ResizeTripDaysInput) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("resize_trip_days", {
        p_trip_id: tripId,
        p_new_start: newStart,
        p_new_end: newEnd,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { tripId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips.list });
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(tripId) });
    },
  });
}
