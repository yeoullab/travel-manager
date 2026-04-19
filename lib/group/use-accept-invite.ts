"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export function useAcceptInvite() {
  const supabase = getBrowserClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteCode: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("accept_invite", { p_invite_code: inviteCode });
      if (error) throw error;
      return data as { group_id: string; status: string };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.group.me });
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips.list });
    },
  });
}
