"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export type UpdateTodoInput = {
  tripId: string;
  todoId: string;
  title: string;
  memo?: string | null;
  assignedTo?: string | null;
};

export function useUpdateTodo() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateTodoInput): Promise<void> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("update_todo", {
        p_todo_id: input.todoId,
        p_title: input.title,
        p_memo: input.memo ?? null,
        p_assigned_to: input.assignedTo ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.todos.byTripId(vars.tripId) });
    },
  });
}
