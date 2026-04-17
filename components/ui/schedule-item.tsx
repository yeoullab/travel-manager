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
        <button
          type="button"
          aria-label="순서 변경"
          className="text-ink-500 -ml-1 flex h-10 w-6 shrink-0 cursor-grab items-center justify-center active:cursor-grabbing"
        >
          <GripVertical size={16} />
        </button>
      )}
      <div className="min-w-0 flex-1 pl-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-ink-900 truncate text-[15px] font-semibold">{title}</p>
          {time && (
            <span className="text-ink-600 shrink-0 font-mono text-[12px]">{time}</span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <span
            className={cn(
              "inline-block h-1.5 w-1.5 rounded-full",
              categoryColor[category],
            )}
          />
          <span className="text-ink-600 text-[11px] uppercase">
            {categoryLabel[category]}
          </span>
        </div>
        {placeName && (
          <div className="text-ink-700 mt-1 flex items-center gap-1 text-[13px]">
            <MapPin size={12} strokeWidth={2} />
            <span className="truncate">{placeName}</span>
          </div>
        )}
        {memo && (
          <p className="text-ink-600 mt-1 line-clamp-2 text-[13px] leading-[1.45]">
            {memo}
          </p>
        )}
      </div>
    </div>
  );
}
