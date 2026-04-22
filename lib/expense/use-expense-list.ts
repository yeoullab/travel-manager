"use client";

import { useQuery } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import type { Database } from "@/types/database";

export type Expense = Database["public"]["Tables"]["expenses"]["Row"];

export function useExpenseList(tripId: string | null) {
  const supabase = getBrowserClient();
  return useQuery({
    queryKey: tripId ? queryKeys.expenses.byTripId(tripId) : ["expenses", "__idle"],
    enabled: Boolean(tripId),
    queryFn: async (): Promise<Expense[]> => {
      if (!tripId) return [];
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("trip_id", tripId)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10_000,
  });
}
