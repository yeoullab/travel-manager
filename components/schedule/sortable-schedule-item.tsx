"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ScheduleItem as ScheduleItemCard } from "@/components/ui/schedule-item";
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";
import type { ScheduleCategory } from "@/lib/types";
import { cn } from "@/lib/cn";
import { resolvePlaceLink } from "@/lib/maps/place-link";

type Props = {
  item: ScheduleItem;
  index: number;
  isDomestic: boolean;
  onTap: (item: ScheduleItem) => void;
  onNumberTap?: (item: ScheduleItem) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelected?: (item: ScheduleItem) => void;
  registerRef?: (el: HTMLLIElement | null) => void;
};

export function SortableScheduleItem({
  item,
  index,
  isDomestic,
  onTap,
  onNumberTap,
  selectionMode = false,
  selected = false,
  onToggleSelected,
  registerRef,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: selectionMode,
  });
  const dragHandleProps = selectionMode ? {} : { ...attributes, ...listeners };

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    boxShadow: isDragging ? "0 12px 24px rgba(0,0,0,0.12)" : undefined,
  };

  return (
    <li
      ref={(el) => {
        setNodeRef(el);
        registerRef?.(el);
      }}
      style={style}
      className="flex items-stretch gap-1"
      onClick={() => (selectionMode ? onToggleSelected?.(item) : onTap(item))}
    >
      {/*
        Drag handle.
        - 시각 원: 22×22, accent-orange (#f54e00), cream 글자.
        - 실제 hit area: 44×44 (button 자체, 투명 padding 으로 확장) — iOS HIG / Material 권장 최소 터치 타겟.
        - touch-action: none 은 핸들에만 → 카드 본문 vertical swipe 는 페이지 스크롤로 위임.
      */}
      <button
        type="button"
        aria-label={
          selectionMode
            ? `${index}번 일정 선택`
            : `${index}번 일정 지도에서 보기. 길게 눌러 순서 변경`
        }
        aria-pressed={selectionMode ? selected : undefined}
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center bg-transparent",
          selectionMode ? "cursor-pointer" : "cursor-grab touch-none active:cursor-grabbing",
        )}
        onClick={(e) => {
          e.stopPropagation();
          if (selectionMode) onToggleSelected?.(item);
          else if (!isDragging) onNumberTap?.(item);
        }}
        {...dragHandleProps}
      >
        <span
          className={cn(
            "flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
            selected ? "bg-ink-900 text-cream" : "bg-accent-orange text-cream",
          )}
        >
          {selectionMode && selected ? "✓" : index}
        </span>
      </button>
      <div
        className={cn(
          "min-w-0 flex-1 rounded-[8px] text-left",
          selectionMode && selected && "ring-accent-orange/70 ring-2",
        )}
      >
        <ScheduleItemCard
          category={item.category_code as ScheduleCategory}
          title={item.title}
          time={item.time_of_day ? item.time_of_day.slice(0, 5) : undefined}
          placeName={item.place_name ?? undefined}
          placeAddress={item.place_address ?? undefined}
          memo={item.memo ?? undefined}
          placeUrl={resolvePlaceLink({
            placeExternalUrl: item.place_external_url,
            placeLat: item.place_lat,
            placeLng: item.place_lng,
            placeName: item.place_name,
            placeAddress: item.place_address,
            isDomestic,
          })}
        />
      </div>
    </li>
  );
}
