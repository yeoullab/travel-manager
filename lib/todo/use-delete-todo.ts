"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export type DeleteTodoInput = { tripId: string; todoId: string };

export function useDeleteTodo() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeleteTodoInput): Promise<void> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("delete_todo", {
        p_todo_id: input.todoId,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.todos.byTripId(vars.tripId) });
    },
  });
}
