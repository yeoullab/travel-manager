"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Query } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { subscribeToTrips } from "@/lib/realtime/trips-channel";
import { subscribeToScheduleItems } from "@/lib/realtime/schedule-channel";
import { subscribeToGroupMembers } from "@/lib/realtime/group-members-channel";
import { subscribeToGroups } from "@/lib/realtime/groups-channel";
import { subscribeToExpenses } from "@/lib/realtime/expenses-channel";
import { subscribeToTodos } from "@/lib/realtime/todos-channel";
import { subscribeToRecords } from "@/lib/realtime/records-channel";
import { useMyGroup } from "@/lib/group/use-my-group";
import { useUiStore } from "@/lib/store/ui-store";

export function useRealtimeGateway(userId: string | undefined) {
  const queryClient = useQueryClient();
  const supabase = getBrowserClient();
  const showToast = useUiStore((s) => s.showToast);

  // trips-channel 의 visibility 판정은 group.me 캐시에 의존 (subscribeToTrips 참조).
  // 게이트웨이가 항상 mount 되는 providers 에서 useMyGroup 을 prefetch 해
  // /trips 목록이나 /trips/[id] 처럼 useMyGroup 을 직접 호출하지 않는 페이지에서도
  // wasVisible/isVisibleNow 평가가 정확하도록 보장한다.
  useMyGroup();

  const isDragging = useUiStore((s) => s.isDraggingSchedule);
  const pending = useUiStore((s) => s.pendingScheduleInvalidate);
  const setPending = useUiStore((s) => s.setPendingScheduleInvalidate);

  useEffect(() => {
    if (!userId) return;

    const unsubTrips = subscribeToTrips(queryClient, userId);
    const unsubSchedule = subscribeToScheduleItems(queryClient);
    const unsubMembers = subscribeToGroupMembers(queryClient);
    const unsubGroups = subscribeToGroups(queryClient, {
      onDissolved: () => showToast("파트너와의 공유가 종료되었어요"),
    });
    const unsubExpenses = subscribeToExpenses(queryClient);
    const unsubTodos = subscribeToTodos(queryClient);
    const unsubRecords = subscribeToRecords(queryClient);

    const handleOnline = () => {
      void queryClient.invalidateQueries();
    };
    window.addEventListener("online", handleOnline);

    return () => {
      unsubTrips();
      unsubSchedule();
      unsubMembers();
      unsubGroups();
      unsubExpenses();
      unsubTodos();
      unsubRecords();
      window.removeEventListener("online", handleOnline);
      void supabase.removeAllChannels();
    };
  }, [userId, queryClient, supabase, showToast]);

  useEffect(() => {
    if (isDragging) return;
    if (!pending) return;
    void queryClient.invalidateQueries({
      predicate: (q: Query) => Array.isArray(q.queryKey) && q.queryKey[0] === "schedule",
    });
    setPending(false);
  }, [isDragging, pending, queryClient, setPending]);
}
