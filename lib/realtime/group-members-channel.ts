import { subscribeToTable } from "@/lib/realtime/channel";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";

export function subscribeToGroupMembers(queryClient: QueryClient) {
  return subscribeToTable({
    channel: "group-members-changes",
    table: "group_members",
    onChange: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.me });
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips.list });
      void queryClient.invalidateQueries({ queryKey: queryKeys.group.me });
      if (process.env.NODE_ENV !== "production") {
        const w = window as unknown as { __realtimeEvents?: unknown[] };
        w.__realtimeEvents ??= [];
        w.__realtimeEvents.push({ table: "group_members" });
      }
    },
  });
}
