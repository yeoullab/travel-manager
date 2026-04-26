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

  /*
    카드 전체가 drag 영역. {...listeners} 를 <li> 에 부착해 카드 어디서든 long-press → drag.
    touch-action: pan-y 는 수직 스크롤은 브라우저에 양보하고 horizontal/long-press 만
    dnd-kit (TouchSensor delay 400ms) 에 넘김. 카드 위 swipe 로 페이지 스크롤 정상 동작.
    탭 (delay < 400ms) → onClick → 모달.
  */
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    boxShadow: isDragging ? "0 12px 24px rgba(0,0,0,0.12)" : undefined,
    touchAction: "pan-y",
  };

  return (
    <li
      ref={(el) => {
        setNodeRef(el);
        registerRef?.(el);
      }}
      style={style}
      className="flex cursor-grab items-start gap-2 active:cursor-grabbing"
      onClick={() => onTap(item)}
      {...attributes}
      {...listeners}
    >
      {/* 좌측 번호 칩: 28×28 peach (ti-thinking #dfa88f) + cream 글자. 지도 마커와 톤 동일. visual only — listener 는 <li> 에. */}
      <div
        aria-hidden
        className="bg-ti-thinking text-cream mt-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums"
      >
        {index}
      </div>
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
