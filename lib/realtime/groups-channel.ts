import { subscribeToTable } from "@/lib/realtime/channel";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";

export type GroupsChannelOptions = {
  onDissolved?: () => void;
};

export function subscribeToGroups(queryClient: QueryClient, opts?: GroupsChannelOptions) {
  return subscribeToTable({
    channel: "groups-changes",
    table: "groups",
    onChange: (payload) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.group.me });
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips.list });
      if (
        payload.eventType === "UPDATE" &&
        payload.new &&
        "status" in payload.new &&
        payload.new.status === "dissolved"
      ) {
        opts?.onDissolved?.();
      }
      if (process.env.NODE_ENV !== "production") {
        const w = window as unknown as { __realtimeEvents?: unknown[] };
        w.__realtimeEvents ??= [];
        w.__realtimeEvents.push({ ...payload, table: "groups" });
      }
    },
  });
}
