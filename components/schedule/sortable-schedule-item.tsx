"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ScheduleItem as ScheduleItemCard } from "@/components/ui/schedule-item";
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";
import type { ScheduleCategory } from "@/lib/types";
import { cn } from "@/lib/cn";
import { resolvePlaceLink } from "@/lib/maps/place-link";
import { markerColorsFor } from "@/lib/maps/marker-colors";
import { useLongPress } from "@/lib/hooks/use-long-press";

type Props = {
  item: ScheduleItem;
  index: number;
  isDomestic: boolean;
  onTap: (item: ScheduleItem) => void;
  onLongPress?: (item: ScheduleItem) => void;
  onNumberTap?: (item: ScheduleItem) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelected?: (item: ScheduleItem) => void;
  registerRef?: (el: HTMLLIElement | null) => void;
  variant?: "main" | "candidate";
};

export function SortableScheduleItem({
  item,
  index,
  isDomestic,
  onTap,
  onLongPress,
  onNumberTap,
  selectionMode = false,
  selected = false,
  onToggleSelected,
  registerRef,
  variant = "main",
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: selectionMode,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    boxShadow: isDragging ? "0 12px 24px rgba(0,0,0,0.12)" : undefined,
  };

  const cardLongPress = useLongPress<HTMLDivElement>({
    onLongPress: () => onLongPress?.(item),
    disabled: selectionMode || !onLongPress,
  });

  return (
    <li
      ref={(el) => {
        setNodeRef(el);
        registerRef?.(el);
      }}
      style={style}
      className="flex items-stretch gap-1"
    >
      {/*
        Drag handle.
        - 시각 원: 22×22, accent-orange (#f54e00), cream 글자.
        - 실제 hit area: 44×44 (button 자체, 투명 padding 으로 확장) — iOS HIG / Material 권장 최소 터치 타겟.
        - touch-action: none 은 핸들에만 → 카드 본문 vertical swipe 는 페이지 스크롤로 위임.
      */}
      {selectionMode ? (
        <label
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center bg-transparent"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            aria-label={`${item.title} 선택`}
            checked={selected}
            onChange={() => onToggleSelected?.(item)}
            className="border-border-primary accent-ink-900 focus-visible:ring-accent-orange h-[22px] w-[22px] cursor-pointer rounded-[6px] border focus-visible:ring-2 focus-visible:ring-offset-2"
          />
        </label>
      ) : (
        <button
          type="button"
          aria-label={`${index}번 일정 지도에서 보기. 길게 눌러 순서 변경`}
          className="flex h-11 w-11 shrink-0 cursor-grab touch-none items-center justify-center bg-transparent active:cursor-grabbing"
          onClick={(e) => {
            e.stopPropagation();
            if (!isDragging) onNumberTap?.(item);
          }}
          {...attributes}
          {...listeners}
        >
          {variant === "candidate" ? (
            <span
              className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-dashed bg-transparent text-[11px] font-semibold tabular-nums"
              style={{
                borderColor: markerColorsFor(item.category_code).fill,
                color: markerColorsFor(item.category_code).fill,
              }}
            >
              {index}
            </span>
          ) : (
            <span className="bg-accent-orange text-cream flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-semibold tabular-nums">
              {index}
            </span>
          )}
        </button>
      )}
      <div
        data-testid={`schedule-card-${item.id}`}
        className={cn(
          "relative min-w-0 flex-1 rounded-[8px] text-left",
          selectionMode && selected && "ring-accent-orange/70 ring-2",
        )}
        onClick={() => (selectionMode ? onToggleSelected?.(item) : onTap(item))}
        {...cardLongPress}
      >
        {!selectionMode && onLongPress && (
          <button
            type="button"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:right-2 focus:z-10 focus:h-9 focus:w-auto focus:rounded-full focus:bg-ink-900 focus:px-3 focus:text-[12px] focus:font-medium focus:text-cream focus:ring-2 focus:ring-accent-orange focus:ring-offset-2 focus:outline-none"
            onClick={(e) => {
              e.stopPropagation();
              onLongPress(item);
            }}
          >
            {item.title} 선택 모드 시작
          </button>
        )}
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
