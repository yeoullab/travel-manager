"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { subscribeToTrips } from "@/lib/realtime/trips-channel";
import { subscribeToGroupMembers } from "@/lib/realtime/group-members-channel";
import { subscribeToGroups } from "@/lib/realtime/groups-channel";
import { useUiStore } from "@/lib/store/ui-store";

export function useRealtimeGateway(userId: string | undefined) {
  const queryClient = useQueryClient();
  const supabase = getBrowserClient();
  const showToast = useUiStore((s) => s.showToast);

  useEffect(() => {
    if (!userId) return;

    const unsubTrips = subscribeToTrips(queryClient);
    const unsubMembers = subscribeToGroupMembers(queryClient);
    const unsubGroups = subscribeToGroups(queryClient, {
      onDissolved: () => showToast("파트너와의 공유가 종료되었어요"),
    });

    // 재연결 시 놓친 이벤트 복구
    const handleOnline = () => {
      void queryClient.invalidateQueries();
    };
    window.addEventListener("online", handleOnline);

    return () => {
      unsubTrips();
      unsubMembers();
      unsubGroups();
      window.removeEventListener("online", handleOnline);
      void supabase.removeAllChannels();
    };
  }, [userId, queryClient, supabase, showToast]);
}
