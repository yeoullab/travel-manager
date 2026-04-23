import type { QueryClient, Query } from "@tanstack/react-query";
import { subscribeToTable } from "./channel";

export function handleTodoChange(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({
    predicate: (q: Query) => Array.isArray(q.queryKey) && q.queryKey[0] === "todos",
  });
}

export function subscribeToTodos(queryClient: QueryClient) {
  return subscribeToTable<{ trip_id: string }>({
    channel: "todos-changes",
    table: "todos",
    onChange: () => handleTodoChange(queryClient),
  });
}
