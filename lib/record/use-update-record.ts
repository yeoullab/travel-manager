"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export type UpdateRecordInput = {
  tripId: string;
  recordId: string;
  title: string;
  content: string;
  date: string;
};

export function useUpdateRecord() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateRecordInput): Promise<void> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("update_record", {
        p_record_id: input.recordId,
        p_title: input.title,
        p_content: input.content,
        p_date: input.date,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.records.byTripId(vars.tripId) });
    },
  });
}
