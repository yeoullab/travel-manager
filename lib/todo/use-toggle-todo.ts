"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import type { Database } from "@/types/database";

type Todo = Database["public"]["Tables"]["todos"]["Row"];

export type ToggleTodoInput = { tripId: string; todoId: string; complete: boolean };

export function useToggleTodo() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ToggleTodoInput): Promise<void> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("toggle_todo", {
        p_todo_id: input.todoId,
        p_complete: input.complete,
      });
      if (error) throw error;
    },
    onMutate: async ({ tripId, todoId, complete }) => {
      const key = queryKeys.todos.byTripId(tripId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Todo[]>(key);
      if (prev) {
        qc.setQueryData<Todo[]>(
          key,
          prev.map((t) => (t.id === todoId ? { ...t, is_completed: complete } : t)),
        );
      }
      return { prev };
    },
    onError: (_err, { tripId }, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(queryKeys.todos.byTripId(tripId), ctx.prev);
      }
    },
    onSettled: (_d, _e, { tripId }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.todos.byTripId(tripId) });
    },
  });
}
