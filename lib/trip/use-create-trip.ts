"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export type CreateTripInput = {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  isDomestic: boolean;
  currencies: string[];
};

export function useCreateTrip() {
  const supabase = getBrowserClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTripInput): Promise<string> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("create_trip", {
        p_title: input.title,
        p_destination: input.destination,
        p_start_date: input.startDate,
        p_end_date: input.endDate,
        p_is_domestic: input.isDomestic,
        p_currencies: input.currencies,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips.list });
    },
  });
}
