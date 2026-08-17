"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ScheduleList } from "./schedule-list";
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";
import { cn } from "@/lib/cn";

type Props = {
  items: ScheduleItem[];
  isDomestic: boolean;
  onTapItem: (item: ScheduleItem) => void;
  onTapNumber?: (item: ScheduleItem) => void;
  registerItemRef?: (id: string, el: HTMLLIElement | null) => void;
};

/**
 * Day 화면 하단 접이식 "후보 (M)" 섹션 (스펙 §7).
 * 후보 0개면 부모에서 렌더하지 않는다. 기본 접힘.
 * 부모의 DndContext 안에서 렌더되어야 드래그 재정렬이 동작한다.
 */
export function CandidateSection({
  items,
  isDomestic,
  onTapItem,
  onTapNumber,
  registerItemRef,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-4" data-testid="candidate-section">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "border-border-medium text-ink-700 flex w-full items-center gap-1.5 rounded-[8px] border-2 border-dashed px-3 py-2 text-[13px] font-medium",
        )}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        후보 ({items.length})
      </button>
      {open && (
        <ScheduleList
          items={items}
          variant="candidate"
          isDomestic={isDomestic}
          onTapItem={onTapItem}
          onTapNumber={onTapNumber}
          registerItemRef={registerItemRef}
        />
      )}
    </section>
  );
}
