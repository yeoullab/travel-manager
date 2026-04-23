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
import { useUiStore } from "@/lib/store/ui-store";

export function useRealtimeGateway(userId: string | undefined) {
  const queryClient = useQueryClient();
  const supabase = getBrowserClient();
  const showToast = useUiStore((s) => s.showToast);

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
