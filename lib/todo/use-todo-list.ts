"use client";

import { useQuery } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import type { Database } from "@/types/database";

export type Todo = Database["public"]["Tables"]["todos"]["Row"];

export function useTodoList(tripId: string | null) {
  const supabase = getBrowserClient();
  return useQuery({
    queryKey: tripId ? queryKeys.todos.byTripId(tripId) : ["todos", "__idle"],
    enabled: Boolean(tripId),
    queryFn: async (): Promise<Todo[]> => {
      if (!tripId) return [];
      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .eq("trip_id", tripId)
        .order("is_completed", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10_000,
  });
}
