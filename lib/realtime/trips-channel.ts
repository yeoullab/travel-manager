import { subscribeToTable } from "@/lib/realtime/channel";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";

export function subscribeToTrips(queryClient: QueryClient) {
  return subscribeToTable({
    channel: "trips-changes",
    table: "trips",
    onChange: (payload) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips.list });
      if (payload.eventType === "UPDATE" && payload.new && "id" in payload.new) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(payload.new.id as string) });
      }
      if (process.env.NODE_ENV !== "production") {
        const w = window as unknown as { __realtimeEvents?: unknown[] };
        w.__realtimeEvents ??= [];
        w.__realtimeEvents.push({ ...payload, table: "trips" });
      }
    },
  });
}
