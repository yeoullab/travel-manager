"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export type UpdateTripInput = {
  id: string;
  title?: string;
  destination?: string;
  isDomestic?: boolean;
  currencies?: string[];
};

export function useUpdateTrip() {
  const supabase = getBrowserClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...fields }: UpdateTripInput) => {
      const patch: Record<string, unknown> = {};
      if (fields.title !== undefined) patch.title = fields.title;
      if (fields.destination !== undefined) patch.destination = fields.destination;
      if (fields.isDomestic !== undefined) patch.is_domestic = fields.isDomestic;
      if (fields.currencies !== undefined) patch.currencies = fields.currencies;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("trips").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips.list });
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(id) });
    },
  });
}
