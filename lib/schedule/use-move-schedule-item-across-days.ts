"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import { useUiStore } from "@/lib/store/ui-store";
import { applyLocalMove } from "@/lib/schedule/apply-local-move";
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";

export type MoveInput = {
  tripId: string;
  itemId: string;
  targetDayId: string;
  targetPosition: number; // 1-based, 1..targetCount+1
};

export function useMoveScheduleItemAcrossDays() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();
  const showToast = useUiStore((s) => s.showToast);

  return useMutation({
    mutationFn: async (input: MoveInput): Promise<void> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("move_schedule_item_across_days", {
        p_item_id: input.itemId,
        p_target_day_id: input.targetDayId,
        p_target_position: input.targetPosition,
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
            applyLocalMove(previous, input.itemId, input.targetDayId, input.targetPosition),
          );
        } catch {
          // same-day / invalid_target_position / not-found: caller 분기 실패.
          // 서버가 동일 예외로 응답할 것이므로 onError 에서 롤백된다.
        }
      }
      return { previous };
    },
    onError: (err, input, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(queryKeys.schedule.byTripId(input.tripId), ctx.previous);
      }
      const msg = err instanceof Error ? err.message : "unknown";
      showToast(`이동에 실패했어요 (${msg})`, "error");
    },
    onSettled: (_d, _e, input) => {
      void qc.invalidateQueries({ queryKey: queryKeys.schedule.byTripId(input.tripId) });
    },
  });
}
