"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export function useDeleteScheduleItem() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tripId: string; itemId: string }): Promise<void> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("delete_schedule_item", {
        p_item_id: input.itemId,
      });
      if (error) throw error;
    },
    onSuccess: (_v, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.schedule.byTripId(vars.tripId) });
    },
  });
}
