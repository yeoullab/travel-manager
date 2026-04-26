import * as React from "react";
import { MapPin, GripVertical } from "lucide-react";
import { cn } from "@/lib/cn";

export type ScheduleCategory =
  | "transport"
  | "sightseeing"
  | "food"
  | "lodging"
  | "shopping"
  | "other";

const categoryColor: Record<ScheduleCategory, string> = {
  transport: "bg-ti-read", // soft blue
  sightseeing: "bg-ti-grep", // soft sage
  food: "bg-ti-thinking", // warm peach
  lodging: "bg-ti-edit", // soft lavender
  shopping: "bg-accent-gold",
  other: "bg-ink-400",
};

const categoryLabel: Record<ScheduleCategory, string> = {
  transport: "교통",
  sightseeing: "관광",
  food: "식당",
  lodging: "숙소",
  shopping: "쇼핑",
  other: "기타",
};

type ScheduleItemProps = {
  category: ScheduleCategory;
  title: string;
  time?: string;
  placeName?: string;
  memo?: string;
  draggable?: boolean;
  onClick?: () => void;
  className?: string;
  /** §6.13: place_external_url || 좌표 fallback. resolvePlaceLink() 호출 결과. null 이면 버튼 숨김. */
  placeUrl?: string | null;
};

/**
 * 일정 아이템 카드. category 색상 좌측 보더, 시간·제목·장소·메모 노출.
 * draggable 프롭으로 drag handle 표시 (Phase 0 정적).
 */
export function ScheduleItem({
  category,
  title,
  time,
  placeName,
  memo,
  draggable,
  onClick,
  className,
  placeUrl,
}: ScheduleItemProps) {
  return (
    <div
      className={cn(
        "bg-surface-100 border-border-primary relative flex gap-3 overflow-hidden rounded-[8px] border p-3",
        "transition-shadow duration-200 active:scale-[0.99]",
        onClick && "cursor-pointer",
        className,
      )}
      onClick={onClick}
    >
      <div
        aria-hidden
        className={cn("absolute top-0 bottom-0 left-0 w-1", categoryColor[category])}
      />
      {draggable && (
        <span
          aria-label="순서 변경"
          className="text-ink-500 -ml-1 flex h-10 w-6 shrink-0 cursor-grab items-center justify-center active:cursor-grabbing"
        >
          <GripVertical size={16} />
        </span>
      )}
      <div className="min-w-0 flex-1 pl-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-ink-900 truncate text-[15px] font-semibold">{title}</p>
          {time && (
            <span className="text-ink-600 shrink-0 font-mono text-[12px]">{time}</span>
          )}
        </div>
        {/* 부가 정보 한 줄: [카테고리 dot] 카테고리 · 장소 · 메모 (모두 truncate) */}
        <div className="text-ink-600 mt-1 flex min-w-0 items-center gap-1.5 text-[12px]">
          <span
            aria-hidden
            className={cn(
              "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
              categoryColor[category],
            )}
          />
          <span className="shrink-0">{categoryLabel[category]}</span>
          {placeName && (
            <>
              <span aria-hidden className="text-ink-400 shrink-0">
                ·
              </span>
              {placeUrl ? (
                <a
                  href={placeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-accent-orange hover:text-accent-orange/80 inline-flex min-w-0 items-center gap-1 underline-offset-2 hover:underline"
                  aria-label={`${placeName} — 지도에서 보기`}
                >
                  <MapPin size={11} strokeWidth={2} className="shrink-0" aria-hidden />
                  <span className="truncate">{placeName}</span>
                </a>
              ) : (
                <>
                  <MapPin
                    size={11}
                    strokeWidth={2}
                    className="text-ink-500 shrink-0"
                    aria-hidden
                  />
                  <span className="truncate">{placeName}</span>
                </>
              )}
            </>
          )}
          {memo && (
            <>
              <span aria-hidden className="text-ink-400 shrink-0">
                ·
              </span>
              <span className="truncate">{memo}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
