"use client";

import { useQuery } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import type { Database } from "@/types/database";

export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

/**
 * Schedule (일정) 도메인 시스템 카테고리 6종.
 * 0008_categories.sql 의 seed 와 1:1. components/ui/schedule-item.tsx 의 categoryColor / categoryLabel 도 같은 코드 집합 사용.
 * RLS 가 SELECT only 라 INSERT/UPDATE/DELETE 는 시도해도 deny — V1 은 읽기 전용.
 */
export function useCategories() {
  const supabase = getBrowserClient();
  return useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: async (): Promise<CategoryRow[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: Infinity, // 시스템 테이블, 사실상 변하지 않음
  });
}

/** 0008 seed 의 한글 라벨 fallback. DB row.name 이 우선이지만 SSR/loading 시 fallback. */
export const CATEGORY_FALLBACK_LABEL: Record<string, string> = {
  transport: "교통",
  sightseeing: "관광",
  food: "식당",
  lodging: "숙소",
  shopping: "쇼핑",
  other: "기타",
};
