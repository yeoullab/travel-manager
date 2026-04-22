"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { TextField, TextArea } from "@/components/ui/text-field";
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";
import type { PlaceResult } from "@/lib/maps/types";
import type { ScheduleCategory } from "@/lib/types";

export type ScheduleItemFormValue = {
  title: string;
  // Task 6~7에서 카테고리 분기 폼 구축 시 필수로 전환. 현재는 modal.initial.category_code fallback.
  categoryCode?: ScheduleCategory;
  timeOfDay: string | null;
  memo: string | null;
  url: string | null;
  place: PlaceResult | null;
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: ScheduleItem | null;
  pickedPlace: PlaceResult | null;
  onClose: () => void;
  onSubmit: (value: ScheduleItemFormValue) => void;
  onDelete?: () => void;
  onOpenPlaceSearch: () => void;
  onOpenDayMove?: () => void;
};

export function ScheduleItemModal({
  open,
  mode,
  initial,
  pickedPlace,
  onClose,
  onSubmit,
  onDelete,
  onOpenPlaceSearch,
  onOpenDayMove,
}: Props) {
  const [title, setTitle] = useState("");
  const [timeOfDay, setTimeOfDay] = useState<string>("");
  const [memo, setMemo] = useState<string>("");
  const [url, setUrl] = useState<string>("");
  const [place, setPlace] = useState<PlaceResult | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setTimeOfDay(initial?.time_of_day ? initial.time_of_day.slice(0, 5) : "");
    setMemo(initial?.memo ?? "");
    setUrl(initial?.url ?? "");
    setPlace(
      initial &&
        initial.place_name &&
        initial.place_lat != null &&
        initial.place_lng != null &&
        initial.place_provider != null
        ? {
            externalId: initial.place_external_id ?? `${initial.place_provider}:manual`,
            name: initial.place_name,
            address: initial.place_address ?? "",
            lat: initial.place_lat,
            lng: initial.place_lng,
            provider: initial.place_provider as "naver" | "google",
          }
        : null,
    );
  }, [open, initial]);

  useEffect(() => {
    if (pickedPlace) setPlace(pickedPlace);
  }, [pickedPlace]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const canSave = title.trim().length >= 1 && title.trim().length <= 100;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={mode === "create" ? "일정 추가" : "일정 수정"}
      footer={
        <div className="flex w-full gap-2">
          {mode === "edit" && onDelete && (
            <Button variant="ghost" onClick={onDelete}>
              삭제
            </Button>
          )}
          {mode === "edit" && onOpenDayMove && (
            <Button variant="tertiary" onClick={onOpenDayMove}>
              다른 날로 이동
            </Button>
          )}
          <Button
            fullWidth
            variant="primary"
            disabled={!canSave}
            onClick={() =>
              onSubmit({
                title: title.trim(),
                timeOfDay: timeOfDay || null,
                memo: memo.trim() || null,
                url: url.trim() || null,
                place,
              })
            }
          >
            {mode === "create" ? "추가" : "저장"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <TextField
          label="제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 센소지 방문"
          maxLength={100}
          required
        />
        <TextField
          label="시간"
          type="time"
          value={timeOfDay}
          onChange={(e) => setTimeOfDay(e.target.value)}
        />

        <div>
          <label className="text-ink-700 mb-1 block text-[12px] font-medium">장소</label>
          {place ? (
            <div className="border-border-primary flex items-start justify-between gap-2 rounded-[10px] border px-3 py-2">
              <div className="min-w-0">
                <p className="text-ink-900 truncate text-[14px] font-medium">{place.name}</p>
                <p className="text-ink-600 truncate text-[12px]">{place.address}</p>
              </div>
              <button
                type="button"
                className="text-ink-500 text-[12px]"
                onClick={() => setPlace(null)}
              >
                해제
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="border-border-primary text-ink-600 w-full rounded-[10px] border px-3 py-3 text-left text-[13px]"
              onClick={onOpenPlaceSearch}
            >
              장소 검색…
            </button>
          )}
        </div>

        <TextArea
          label="메모"
          rows={3}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          maxLength={1000}
        />
        <TextField
          label="URL (선택)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
        />
      </div>
    </BottomSheet>
  );
}
