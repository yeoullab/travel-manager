"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import { useUiStore } from "@/lib/store/ui-store";
import { applyLocalReorder } from "@/lib/schedule/apply-local-reorder";
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";

export type ReorderInput = {
  tripId: string;
  tripDayId: string;
  orderedIds: string[];
};

export function useReorderScheduleItemsInDay() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();
  const showToast = useUiStore((s) => s.showToast);

  return useMutation({
    mutationFn: async (input: ReorderInput): Promise<void> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("reorder_schedule_items_in_day", {
        p_trip_day_id: input.tripDayId,
        p_item_ids: input.orderedIds,
      });
      if (error) throw error;
    },
    onMutate: async (input) => {
      const key = queryKeys.schedule.byTripId(input.tripId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ScheduleItem[]>(key);
      if (previous) {
        qc.setQueryData<ScheduleItem[]>(
          key,
          applyLocalReorder(previous, input.tripDayId, input.orderedIds),
        );
      }
      return { previous };
    },
    onError: (err, input, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(queryKeys.schedule.byTripId(input.tripId), ctx.previous);
      }
      const msg = err instanceof Error ? err.message : "unknown";
      showToast(`순서 변경에 실패했어요 (${msg})`, "error");
    },
    onSettled: (_d, _e, input) => {
      void qc.invalidateQueries({ queryKey: queryKeys.schedule.byTripId(input.tripId) });
    },
  });
}
