"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export type UpdateGuestShareInput = {
  tripId: string;
  shareId: string;
  showSchedule?: boolean;
  showExpenses?: boolean;
  showTodos?: boolean;
  showRecords?: boolean;
  expiresAt?: string | null;
};

export function useUpdateGuestShare() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateGuestShareInput): Promise<void> => {
      const patch: Record<string, unknown> = {};
      if (input.showSchedule !== undefined) patch.show_schedule = input.showSchedule;
      if (input.showExpenses !== undefined) patch.show_expenses = input.showExpenses;
      if (input.showTodos !== undefined) patch.show_todos = input.showTodos;
      if (input.showRecords !== undefined) patch.show_records = input.showRecords;
      if (input.expiresAt !== undefined) patch.expires_at = input.expiresAt;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("guest_shares")
        .update(patch)
        .eq("id", input.shareId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.guest.byTripId(vars.tripId) });
    },
  });
}
