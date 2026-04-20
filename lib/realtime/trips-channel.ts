import type { QueryClient } from "@tanstack/react-query";
import { subscribeToTable } from "./channel";
import { queryKeys } from "@/lib/query/keys";
import type { MyGroupData } from "@/lib/group/use-my-group";

type TripRow = {
  id: string;
  group_id: string | null;
  created_by: string | null;
};

type Payload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  old: Partial<TripRow> | null;
  new: Partial<TripRow> | null;
};

type Ctx = { currentUserId: string; currentGroupId: string | null };

export type TripsVisibilityAction = {
  invalidateList: boolean;
  invalidateDetailId: string | null;
  markUnavailableId: string | null;
};

function isVisible(row: Partial<TripRow> | null, ctx: Ctx): boolean {
  if (!row) return false;
  if (row.created_by && row.created_by === ctx.currentUserId) return true;
  if (row.group_id && ctx.currentGroupId && row.group_id === ctx.currentGroupId) return true;
  return false;
}

export function resolveTripsVisibilityAction(payload: Payload, ctx: Ctx): TripsVisibilityAction {
  const wasVisible = isVisible(payload.old, ctx);
  const isVisibleNow = isVisible(payload.new, ctx);

  if (payload.eventType === "DELETE") {
    return {
      invalidateList: wasVisible,
      invalidateDetailId: null,
      markUnavailableId: wasVisible ? (payload.old?.id ?? null) : null,
    };
  }

  if (payload.eventType === "INSERT") {
    return {
      invalidateList: isVisibleNow,
      invalidateDetailId: isVisibleNow ? (payload.new?.id ?? null) : null,
      markUnavailableId: null,
    };
  }

  // UPDATE
  if (wasVisible && !isVisibleNow) {
    return {
      invalidateList: true,
      invalidateDetailId: null,
      markUnavailableId: payload.old?.id ?? payload.new?.id ?? null,
    };
  }
  if (isVisibleNow) {
    return {
      invalidateList: true,
      invalidateDetailId: payload.new?.id ?? null,
      markUnavailableId: null,
    };
  }
  return { invalidateList: false, invalidateDetailId: null, markUnavailableId: null };
}

export function subscribeToTrips(queryClient: QueryClient, currentUserId: string) {
  return subscribeToTable<TripRow>({
    channel: "trips-changes",
    table: "trips",
    onChange: (payload) => {
      // Patch QQ: 매 handler 에서 최신 group_id 조회 (re-subscribe 비용 회피).
      const groupCache = queryClient.getQueryData<MyGroupData>(queryKeys.group.me);
      const currentGroupId = groupCache?.group?.id ?? null;

      const action = resolveTripsVisibilityAction(
        payload as unknown as Payload,
        { currentUserId, currentGroupId },
      );

      if (action.invalidateList) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.trips.list });
      }
      if (action.invalidateDetailId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.trips.detail(action.invalidateDetailId),
        });
      }
      if (action.markUnavailableId) {
        // useTripDetail 은 maybeSingle() 로 null 리턴 → page.tsx 가 !trip 에서 <TripUnavailable />.
        // null 주입이 동일 경로 재사용 (spec §9.5 Patch PP sentinel 단순화).
        queryClient.setQueryData(queryKeys.trips.detail(action.markUnavailableId), null);
      }

      if (process.env.NODE_ENV !== "production") {
        const w = window as unknown as { __realtimeEvents?: unknown[] };
        w.__realtimeEvents ??= [];
        w.__realtimeEvents.push({ ...payload, table: "trips" });
      }
    },
  });
}
