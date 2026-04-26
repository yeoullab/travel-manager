"use client";

import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SortableScheduleItem } from "./sortable-schedule-item";
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";

type Props = {
  items: ScheduleItem[];
  isDomestic: boolean;
  onTapItem: (item: ScheduleItem) => void;
  registerItemRef?: (id: string, el: HTMLLIElement | null) => void;
};

export function ScheduleList({ items, isDomestic, onTapItem, registerItemRef }: Props) {
  return (
    <ul className="mt-3 flex flex-col gap-2">
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {items.map((item, idx) => (
          <SortableScheduleItem
            key={item.id}
            item={item}
            index={idx + 1}
            isDomestic={isDomestic}
            onTap={onTapItem}
            registerRef={(el) => registerItemRef?.(item.id, el)}
          />
        ))}
      </SortableContext>
    </ul>
  );
}
