"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import type { Database } from "@/types/database";

export type GuestShare = Database["public"]["Tables"]["guest_shares"]["Row"];

export type CreateGuestShareInput = { tripId: string };

/**
 * trip 에 active guest share 가 없으면 새로 발급 (token 자동 생성).
 * 기존 비활성 share 가 있어도 partial unique index 의 WHERE 절에서 제외되므로 INSERT 정상.
 * 동시 탭 race 로 unique violation 발생 시 catch 후 invalidateQueries 로 복구.
 */
export function useCreateGuestShare() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateGuestShareInput): Promise<GuestShare> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("guest_shares")
        .insert({ trip_id: input.tripId })
        .select("*")
        .single();
      if (error) throw error;
      return data as GuestShare;
    },
    onSuccess: (_row, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.guest.byTripId(vars.tripId) });
    },
    onError: (_err, vars) => {
      // unique violation 등 — refetch 로 기존 활성 토큰 복구
      void qc.invalidateQueries({ queryKey: queryKeys.guest.byTripId(vars.tripId) });
    },
  });
}
