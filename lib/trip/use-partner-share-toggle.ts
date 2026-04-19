"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export type PartnerShareToggleInput = {
  tripId: string;
  groupId: string | null; // null = share off, uuid = share on
};

export function usePartnerShareToggle() {
  const supabase = getBrowserClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tripId, groupId }: PartnerShareToggleInput) => {
      // pessimistic: 서버 확정 후 invalidate
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("trips")
        .update({ group_id: groupId })
        .eq("id", tripId);
      if (error) throw error;
    },
    onSuccess: (_data, { tripId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips.list });
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(tripId) });
    },
  });
}
