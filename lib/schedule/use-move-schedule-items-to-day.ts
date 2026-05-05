"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { applyLocalBulkMove } from "@/lib/schedule/apply-local-bulk-move";
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";
import { queryKeys } from "@/lib/query/keys";
import { useUiStore } from "@/lib/store/ui-store";
import { getBrowserClient } from "@/lib/supabase/browser-client";

export type MoveScheduleItemsToDayInput = {
  tripId: string;
  itemIds: string[];
  targetDayId: string;
};

export function useMoveScheduleItemsToDay() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();
  const showToast = useUiStore((s) => s.showToast);

  return useMutation({
    mutationFn: async (input: MoveScheduleItemsToDayInput): Promise<void> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("move_schedule_items_to_day", {
        p_item_ids: input.itemIds,
        p_target_day_id: input.targetDayId,
      });
      if (error) throw error;
    },
    onMutate: async (input) => {
      const key = queryKeys.schedule.byTripId(input.tripId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ScheduleItem[]>(key);
      if (previous) {
        try {
          qc.setQueryData<ScheduleItem[]>(
            key,
            applyLocalBulkMove(previous, input.itemIds, input.targetDayId),
          );
        } catch {
          // The server RPC performs the same validation; rollback happens in onError.
        }
      }
      return { previous };
    },
    onError: (err, input, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(queryKeys.schedule.byTripId(input.tripId), ctx.previous);
      }
      const msg = err instanceof Error ? err.message : "unknown";
      showToast(`일정 이동에 실패했어요 (${msg})`, "error");
    },
    onSettled: (_data, _error, input) => {
      void qc.invalidateQueries({ queryKey: queryKeys.schedule.byTripId(input.tripId) });
    },
  });
}
