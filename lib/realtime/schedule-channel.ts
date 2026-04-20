import type { QueryClient, Query } from "@tanstack/react-query";
import { subscribeToTable } from "./channel";
import { useUiStore } from "@/lib/store/ui-store";

export function __resetScheduleChannelForTest(): void {
  /* noop */
}

export function handleScheduleChange(queryClient: QueryClient): void {
  const ui = useUiStore.getState();
  if (ui.isDraggingSchedule) {
    ui.setPendingScheduleInvalidate(true);
    return;
  }
  void queryClient.invalidateQueries({
    predicate: (q: Query) => Array.isArray(q.queryKey) && q.queryKey[0] === "schedule",
  });
}

export function subscribeToScheduleItems(queryClient: QueryClient) {
  return subscribeToTable<{ trip_day_id: string }>({
    channel: "schedule-items-changes",
    table: "schedule_items",
    onChange: (_payload) => {
      handleScheduleChange(queryClient);
      if (process.env.NODE_ENV !== "production") {
        const w = window as unknown as { __realtimeEvents?: unknown[] };
        w.__realtimeEvents ??= [];
        w.__realtimeEvents.push({ ..._payload, table: "schedule_items" });
      }
    },
  });
}
