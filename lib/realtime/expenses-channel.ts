import type { QueryClient, Query } from "@tanstack/react-query";
import { subscribeToTable } from "./channel";

export function handleExpenseChange(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({
    predicate: (q: Query) => Array.isArray(q.queryKey) && q.queryKey[0] === "expenses",
  });
}

export function subscribeToExpenses(queryClient: QueryClient) {
  return subscribeToTable<{ trip_id: string }>({
    channel: "expenses-changes",
    table: "expenses",
    onChange: () => handleExpenseChange(queryClient),
  });
}
