"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export type DeleteScheduleItemsInput = {
  tripId: string;
  itemIds: string[];
};

export function useDeleteScheduleItems() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: DeleteScheduleItemsInput): Promise<void> => {
      if (input.itemIds.length === 0) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("delete_schedule_items", {
        p_item_ids: input.itemIds,
      });
      if (error) throw error;
    },
    onSuccess: (_value, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.schedule.byTripId(vars.tripId) });
    },
  });
}
