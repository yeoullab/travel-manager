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

      // .select() 를 붙여 영향 받은 row 를 반환받음. RLS 가 막혀 0 row updated 인 경우
      // PostgREST 는 error 를 던지지 않으므로, 빈 결과를 직접 감지해 사용자에게 실패 표시.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("trips")
        .update(patch)
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("수정 권한이 없거나 여행을 찾을 수 없어요");
      }
    },
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips.list });
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(id) });
    },
  });
}
