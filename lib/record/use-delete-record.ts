"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export type DeleteRecordInput = { tripId: string; recordId: string };

export function useDeleteRecord() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeleteRecordInput): Promise<void> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("delete_record", {
        p_record_id: input.recordId,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.records.byTripId(vars.tripId) });
    },
  });
}
