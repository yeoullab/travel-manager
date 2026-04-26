"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ScheduleItem as ScheduleItemCard } from "@/components/ui/schedule-item";
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";
import type { ScheduleCategory } from "@/lib/types";

type Props = {
  item: ScheduleItem;
  index: number;
  onTap: (item: ScheduleItem) => void;
  registerRef?: (el: HTMLLIElement | null) => void;
};

export function SortableScheduleItem({ item, index, onTap, registerRef }: Props) {
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
      className="flex items-start gap-2"
      onClick={() => onTap(item)}
    >
      {/*
        Drag handle = 좌측 번호 칩. touch-action: none 은 핸들에만 적용해 페이지 스크롤 보장.
        디자인: 22×22 ink-900 원형 + cream 글자, shadow/테두리 없음. 지도 마커와 톤 동일.
      */}
      <button
        type="button"
        aria-label="드래그하여 순서 변경"
        className="bg-ink-900 text-cream mt-2.5 flex h-[22px] w-[22px] shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-[11px] font-semibold tabular-nums active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        {index}
      </button>
      <div className="min-w-0 flex-1 text-left">
        <ScheduleItemCard
          category={item.category_code as ScheduleCategory}
          title={item.title}
          time={item.time_of_day ? item.time_of_day.slice(0, 5) : undefined}
          placeName={item.place_name ?? undefined}
          memo={item.memo ?? undefined}
        />
      </div>
    </li>
  );
}
