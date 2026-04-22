"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { TextField, TextArea } from "@/components/ui/text-field";
import { cn } from "@/lib/cn";
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";
import type { PlaceResult } from "@/lib/maps/types";
import type { ScheduleCategory } from "@/lib/types";

export type ScheduleItemFormValue = {
  title: string;
  categoryCode: ScheduleCategory;
  timeOfDay: string | null;
  memo: string | null;
  url: string | null;
  place: PlaceResult | null;
  // manual_place stage 에서만 채워짐 (place === null 상태로 title/주소만 수동 기입)
  placeAddressManual?: string | null;
};

type FormStage = "category_select" | "other_form" | "place_search" | "manual_place";

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

const CATEGORY_CODES: ScheduleCategory[] = [
  "transport",
  "sightseeing",
  "food",
  "lodging",
  "shopping",
  "other",
];

const CATEGORY_LABEL: Record<ScheduleCategory, string> = {
  transport: "교통",
  sightseeing: "관광",
  food: "식당",
  lodging: "숙소",
  shopping: "쇼핑",
  other: "기타",
};

const CATEGORY_COLOR: Record<ScheduleCategory, string> = {
  transport: "bg-ti-read",
  sightseeing: "bg-ti-grep",
  food: "bg-ti-thinking",
  lodging: "bg-ti-edit",
  shopping: "bg-accent-gold",
  other: "bg-ink-400",
};

function initialStageFor(initial: ScheduleItem | null | undefined): FormStage {
  if (!initial) return "category_select";
  const code = (initial.category_code as ScheduleCategory) ?? "other";
  if (code === "other") return "other_form";
  return "place_search";
}

function initialPlaceFor(initial: ScheduleItem | null | undefined): PlaceResult | null {
  if (
    !initial ||
    !initial.place_name ||
    initial.place_lat == null ||
    initial.place_lng == null ||
    !initial.place_provider
  ) {
    return null;
  }
  return {
    externalId: initial.place_external_id ?? `${initial.place_provider}:manual`,
    name: initial.place_name,
    address: initial.place_address ?? "",
    lat: initial.place_lat,
    lng: initial.place_lng,
    provider: initial.place_provider as "naver" | "google",
  };
}

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
  const [stage, setStage] = useState<FormStage>("category_select");
  const [categoryCode, setCategoryCode] = useState<ScheduleCategory>("other");
  const [title, setTitle] = useState("");
  const [timeOfDay, setTimeOfDay] = useState<string>("");
  const [memo, setMemo] = useState<string>("");
  const [url, setUrl] = useState<string>("");
  const [place, setPlace] = useState<PlaceResult | null>(null);
  const [addressManual, setAddressManual] = useState<string>("");

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    const startCat = (initial?.category_code as ScheduleCategory) ?? "other";
    setCategoryCode(startCat);
    setStage(initialStageFor(initial));
    setTitle(initial?.title ?? "");
    setTimeOfDay(initial?.time_of_day ? initial.time_of_day.slice(0, 5) : "");
    setMemo(initial?.memo ?? "");
    setUrl(initial?.url ?? "");
    setPlace(initialPlaceFor(initial));
    setAddressManual("");
  }, [open, initial]);

  useEffect(() => {
    if (!pickedPlace) return;
    setPlace(pickedPlace);
    // §8.6 place 선택 시 title auto-fill — other 제외 카테고리에선 수동 입력 필드가 없음
    if (stage === "place_search") setTitle(pickedPlace.name);
  }, [pickedPlace, stage]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function pickCategory(code: ScheduleCategory) {
    setCategoryCode(code);
    setStage(code === "other" ? "other_form" : "place_search");
  }

  function backToCategory() {
    setStage("category_select");
    setPlace(null);
    setTitle("");
    setAddressManual("");
  }

  function switchToManual() {
    setStage("manual_place");
    setPlace(null);
    setTitle("");
    setAddressManual("");
  }

  const titleTrim = title.trim();
  const titleValid = titleTrim.length >= 1 && titleTrim.length <= 100;

  const canSave = (() => {
    if (stage === "category_select") return false;
    if (stage === "other_form") return titleValid;
    if (stage === "place_search") return titleValid && place !== null;
    if (stage === "manual_place") return titleValid && addressManual.trim().length > 0;
    return false;
  })();

  const dialogTitle = (() => {
    if (stage === "category_select") return mode === "edit" ? "일정 수정" : "일정 추가";
    if (stage === "other_form") return "일정 (기타)";
    if (stage === "manual_place") return `일정 (${CATEGORY_LABEL[categoryCode]} · 직접 입력)`;
    return `일정 (${CATEGORY_LABEL[categoryCode]})`;
  })();

  function submit() {
    onSubmit({
      title: titleTrim,
      categoryCode,
      timeOfDay: timeOfDay || null,
      memo: memo.trim() || null,
      url: url.trim() || null,
      place,
      placeAddressManual: stage === "manual_place" ? (addressManual.trim() || null) : null,
    });
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={dialogTitle}
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
          <Button fullWidth variant="primary" disabled={!canSave} onClick={submit}>
            {mode === "create" ? "추가" : "저장"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {stage === "category_select" && (
          <div>
            <p className="text-ink-700 mb-2 text-[13px]">카테고리를 선택하세요</p>
            <CategoryChipGrid value={null} onSelect={pickCategory} />
          </div>
        )}

        {stage === "other_form" && (
          <>
            <CategoryChipRow value={categoryCode} onBack={backToCategory} />
            <TextField
              label="제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 자유 시간"
              maxLength={100}
              required
            />
            <PlacePicker place={place} onOpen={onOpenPlaceSearch} onClear={() => setPlace(null)} />
            <CommonFields
              timeOfDay={timeOfDay}
              memo={memo}
              url={url}
              onTime={setTimeOfDay}
              onMemo={setMemo}
              onUrl={setUrl}
            />
          </>
        )}

        {stage === "place_search" && (
          <>
            <CategoryChipRow value={categoryCode} onBack={backToCategory} />
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
              <div className="space-y-2">
                <button
                  type="button"
                  className="border-border-primary text-ink-600 w-full rounded-[10px] border px-3 py-3 text-left text-[13px]"
                  onClick={onOpenPlaceSearch}
                >
                  장소 검색…
                </button>
                <button
                  type="button"
                  className="text-ti-read w-full text-[13px] underline"
                  onClick={switchToManual}
                >
                  검색 결과가 없나요? 직접 입력
                </button>
              </div>
            )}
            <CommonFields
              timeOfDay={timeOfDay}
              memo={memo}
              url={url}
              onTime={setTimeOfDay}
              onMemo={setMemo}
              onUrl={setUrl}
            />
          </>
        )}

        {stage === "manual_place" && (
          <>
            <CategoryChipRow value={categoryCode} onBack={backToCategory} />
            <TextField
              label="제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 이름 모를 식당"
              maxLength={100}
              required
            />
            <TextField
              label="주소"
              value={addressManual}
              onChange={(e) => setAddressManual(e.target.value)}
              placeholder="주소 또는 위치 설명"
              maxLength={200}
              required
            />
            <CommonFields
              timeOfDay={timeOfDay}
              memo={memo}
              url={url}
              onTime={setTimeOfDay}
              onMemo={setMemo}
              onUrl={setUrl}
            />
          </>
        )}
      </div>
    </BottomSheet>
  );
}

function CategoryChipGrid({
  value,
  onSelect,
}: {
  value: ScheduleCategory | null;
  onSelect: (code: ScheduleCategory) => void;
}) {
  return (
    <div role="radiogroup" aria-label="카테고리 선택" className="grid grid-cols-3 gap-2">
      {CATEGORY_CODES.map((code) => {
        const active = value === code;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(code)}
            className={cn(
              "border-border-primary flex flex-col items-center gap-1 rounded-[10px] border px-3 py-3 text-[13px]",
              active && "border-ti-read bg-ti-read/10",
            )}
          >
            <span aria-hidden className={cn("h-4 w-4 rounded-full", CATEGORY_COLOR[code])} />
            {CATEGORY_LABEL[code]}
          </button>
        );
      })}
    </div>
  );
}

function CategoryChipRow({
  value,
  onBack,
}: {
  value: ScheduleCategory;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-ink-700 inline-flex items-center gap-2 text-[13px]">
        <span aria-hidden className={cn("h-3 w-3 rounded-full", CATEGORY_COLOR[value])} />
        <span>{CATEGORY_LABEL[value]}</span>
      </div>
      <button type="button" className="text-ink-500 text-[12px] underline" onClick={onBack}>
        카테고리 변경
      </button>
    </div>
  );
}

function PlacePicker({
  place,
  onOpen,
  onClear,
}: {
  place: PlaceResult | null;
  onOpen: () => void;
  onClear: () => void;
}) {
  return (
    <div>
      <label className="text-ink-700 mb-1 block text-[12px] font-medium">장소 (선택)</label>
      {place ? (
        <div className="border-border-primary flex items-start justify-between gap-2 rounded-[10px] border px-3 py-2">
          <div className="min-w-0">
            <p className="text-ink-900 truncate text-[14px] font-medium">{place.name}</p>
            <p className="text-ink-600 truncate text-[12px]">{place.address}</p>
          </div>
          <button type="button" className="text-ink-500 text-[12px]" onClick={onClear}>
            해제
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="border-border-primary text-ink-600 w-full rounded-[10px] border px-3 py-3 text-left text-[13px]"
          onClick={onOpen}
        >
          장소 검색…
        </button>
      )}
    </div>
  );
}

function CommonFields({
  timeOfDay,
  memo,
  url,
  onTime,
  onMemo,
  onUrl,
}: {
  timeOfDay: string;
  memo: string;
  url: string;
  onTime: (v: string) => void;
  onMemo: (v: string) => void;
  onUrl: (v: string) => void;
}) {
  return (
    <>
      <TextField
        label="시간"
        type="time"
        value={timeOfDay}
        onChange={(e) => onTime(e.target.value)}
      />
      <TextArea
        label="메모"
        rows={3}
        value={memo}
        onChange={(e) => onMemo(e.target.value)}
        maxLength={1000}
      />
      <TextField
        label="URL (선택)"
        value={url}
        onChange={(e) => onUrl(e.target.value)}
        placeholder="https://..."
      />
    </>
  );
}
