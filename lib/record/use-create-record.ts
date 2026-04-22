"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export type CreateRecordInput = {
  tripId: string;
  title: string;
  content: string;
  date: string;
};

export function useCreateRecord() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRecordInput): Promise<string> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("create_record", {
        p_trip_id: input.tripId,
        p_title: input.title,
        p_content: input.content,
        p_date: input.date,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_id, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.records.byTripId(vars.tripId) });
    },
  });
}
