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
    // 모바일 long-press 가 브라우저 native scroll/zoom 보다 dnd-kit TouchSensor 에 먼저 가도록.
    // dnd-kit 공식 권장: TouchSensor 사용 시 draggable 요소의 touch-action 을 none 으로.
    touchAction: "none",
  };

  return (
    <li
      ref={(el) => {
        setNodeRef(el);
        registerRef?.(el);
      }}
      style={style}
      className="flex items-start gap-2"
      {...attributes}
      {...listeners}
      onClick={() => onTap(item)}
    >
      <div className="bg-surface-300 text-ink-700 mt-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold">
        {index}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <ScheduleItemCard
          category={item.category_code as ScheduleCategory}
          title={item.title}
          time={item.time_of_day ? item.time_of_day.slice(0, 5) : undefined}
          placeName={item.place_name ?? undefined}
          memo={item.memo ?? undefined}
          draggable
        />
      </div>
    </li>
  );
}
