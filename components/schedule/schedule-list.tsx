"use client";

import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SortableScheduleItem } from "./sortable-schedule-item";
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";

type Props = {
  items: ScheduleItem[];
  isDomestic: boolean;
  onTapItem: (item: ScheduleItem) => void;
  onTapNumber?: (item: ScheduleItem) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelected?: (item: ScheduleItem) => void;
  registerItemRef?: (id: string, el: HTMLLIElement | null) => void;
};

export function ScheduleList({
  items,
  isDomestic,
  onTapItem,
  onTapNumber,
  selectionMode = false,
  selectedIds,
  onToggleSelected,
  registerItemRef,
}: Props) {
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
            onNumberTap={onTapNumber}
            selectionMode={selectionMode}
            selected={selectedIds?.has(item.id) ?? false}
            onToggleSelected={onToggleSelected}
            registerRef={(el) => registerItemRef?.(item.id, el)}
          />
        ))}
      </SortableContext>
    </ul>
  );
}
