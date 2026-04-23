import type { QueryClient, Query } from "@tanstack/react-query";
import { subscribeToTable } from "./channel";

export function handleRecordChange(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({
    predicate: (q: Query) => Array.isArray(q.queryKey) && q.queryKey[0] === "records",
  });
}

export function subscribeToRecords(queryClient: QueryClient) {
  return subscribeToTable<{ trip_id: string }>({
    channel: "records-changes",
    table: "records",
    onChange: () => handleRecordChange(queryClient),
  });
}
