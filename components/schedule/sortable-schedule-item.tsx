"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ScheduleItem as ScheduleItemCard } from "@/components/ui/schedule-item";
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";
import type { ScheduleCategory } from "@/lib/types";
import { resolvePlaceLink } from "@/lib/maps/place-link";

type Props = {
  item: ScheduleItem;
  index: number;
  isDomestic: boolean;
  onTap: (item: ScheduleItem) => void;
  registerRef?: (el: HTMLLIElement | null) => void;
};

export function SortableScheduleItem({ item, index, isDomestic, onTap, registerRef }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

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
      onClick={() => onTap(item)}
    >
      {/*
        Drag handle.
        - 시각 원: 22×22, accent-orange (#f54e00), cream 글자.
        - 실제 hit area: 44×44 (button 자체, 투명 padding 으로 확장) — iOS HIG / Material 권장 최소 터치 타겟.
        - touch-action: none 은 핸들에만 → 카드 본문 vertical swipe 는 페이지 스크롤로 위임.
      */}
      <button
        type="button"
        aria-label="길게 눌러 순서 변경"
        className="flex h-11 w-11 shrink-0 cursor-grab touch-none items-center justify-center bg-transparent active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        <span className="bg-accent-orange text-cream flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-semibold tabular-nums">
          {index}
        </span>
      </button>
      <div className="min-w-0 flex-1 text-left">
        <ScheduleItemCard
          category={item.category_code as ScheduleCategory}
          title={item.title}
          time={item.time_of_day ? item.time_of_day.slice(0, 5) : undefined}
          placeName={item.place_name ?? undefined}
          memo={item.memo ?? undefined}
          placeUrl={resolvePlaceLink({
            placeExternalUrl: item.place_external_url,
            placeLat: item.place_lat,
            placeLng: item.place_lng,
            placeName: item.place_name,
            isDomestic,
          })}
        />
      </div>
    </li>
  );
}
