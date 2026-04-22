"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export type CreateTodoInput = {
  tripId: string;
  title: string;
  memo?: string | null;
  assignedTo?: string | null;
};

export function useCreateTodo() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTodoInput): Promise<string> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("create_todo", {
        p_trip_id: input.tripId,
        p_title: input.title,
        p_memo: input.memo ?? null,
        p_assigned_to: input.assignedTo ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_id, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.todos.byTripId(vars.tripId) });
    },
  });
}
