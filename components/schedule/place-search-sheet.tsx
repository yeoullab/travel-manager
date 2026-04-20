"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TextField } from "@/components/ui/text-field";
import { usePlaceSearch } from "@/lib/maps/use-place-search";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import type { PlaceResult, MapsProviderName } from "@/lib/maps/types";

type Props = {
  open: boolean;
  provider: MapsProviderName;
  onClose: () => void;
  onPick: (place: PlaceResult) => void;
  onManual?: () => void;
};

export function PlaceSearchSheet({ open, provider, onClose, onPick, onManual }: Props) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 300);
  const { mutate, data, isPending, error, reset } = usePlaceSearch();

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
      reset();
    }
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const q = debounced.trim();
    if (q.length < 2) return;
    mutate({ query: q, provider });
  }, [debounced, open, provider, mutate]);

  const state = ((): "initial" | "loading" | "empty" | "error" | "results" => {
    if (!query.trim()) return "initial";
    if (isPending) return "loading";
    if (error) return "error";
    if (data && data.length === 0) return "empty";
    if (data && data.length > 0) return "results";
    return "loading";
  })();

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={provider === "naver" ? "장소 검색 (Naver)" : "장소 검색 (Google)"}
    >
      <div className="space-y-3">
        <TextField
          label=""
          placeholder="예: 성수동 카페, 시부야 라멘"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        {state === "initial" && (
          <p className="text-ink-600 py-6 text-center text-[13px]">장소를 검색해보세요.</p>
        )}

        {state === "loading" && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} variant="rect" className="h-12" />
            ))}
          </div>
        )}

        {state === "empty" && (
          <div className="space-y-2 py-4 text-center">
            <p className="text-ink-700 text-[13px]">검색 결과가 없어요.</p>
            {onManual && (
              <Button variant="tertiary" onClick={onManual}>
                직접 입력으로 저장
              </Button>
            )}
          </div>
        )}

        {state === "error" && (
          <div className="space-y-2 py-4 text-center">
            <p className="text-ink-700 text-[13px]">
              {error instanceof Error && error.message === "rate_limited"
                ? "검색을 너무 많이 하셨어요. 잠시 후 다시 시도해주세요."
                : "장소 검색이 일시적으로 어려워요. 직접 입력하실 수 있어요."}
            </p>
            {onManual && (
              <Button variant="tertiary" onClick={onManual}>
                직접 입력
              </Button>
            )}
          </div>
        )}

        {state === "results" && (
          <ul className="divide-border-primary divide-y">
            {(data ?? []).map((p) => (
              <li key={p.externalId}>
                <button
                  type="button"
                  className="hover:bg-surface-200/60 w-full py-3 text-left"
                  onClick={() => onPick(p)}
                >
                  <p className="text-ink-900 text-[14px] font-medium">{p.name}</p>
                  <p className="text-ink-600 text-[12px]">{p.address}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </BottomSheet>
  );
}
