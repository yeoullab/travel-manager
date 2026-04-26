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
        Drag handle 만 touch-action: none — 좌측 번호 칩.
        나머지 카드 영역은 touch-action 기본값 (pan-x pan-y) 으로 페이지 스크롤 보장.
        dnd-kit 공식 권장 패턴: handle 분리 + listeners 를 handle 에만 부착.
      */}
      {/*
        카드 번호 = 지도 마커와 동일 시각: 28×28 원형, accent-orange 배경, 흰 글자, 흰 테두리.
        ring-2 ring-cream 으로 마커의 border:2px solid #fff 와 매칭. shadow 도 마커와 비슷하게.
      */}
      <button
        type="button"
        aria-label="드래그하여 순서 변경"
        className="bg-accent-orange text-cream ring-cream mt-2 flex h-7 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-[13px] font-semibold shadow-[0_2px_4px_rgba(0,0,0,0.25)] ring-2 active:cursor-grabbing"
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
