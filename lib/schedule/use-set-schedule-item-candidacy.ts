"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export type SetCandidacyInput = {
  tripId: string; // invalidate 키 용도
  itemId: string;
  isCandidate: boolean;
  /** null = 전체 풀 (isCandidate=true 일 때만 유효) */
  targetDayId: string | null;
};

/** 승격·강등·후보 이동 겸용 — set_schedule_item_candidacy RPC (스펙 §4). */
export function useSetScheduleItemCandidacy() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SetCandidacyInput): Promise<void> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("set_schedule_item_candidacy", {
        p_item_id: input.itemId,
        p_is_candidate: input.isCandidate,
        p_target_day_id: input.targetDayId,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.schedule.byTripId(vars.tripId) });
    },
  });
}
