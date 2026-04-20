"use client";

import { cn } from "@/lib/cn";
import type { TripDay } from "@/lib/trip/use-trip-days";

type Props = {
  days: TripDay[];
  activeDayId: string | null;
  onSelect: (dayId: string) => void;
};

export function DayTabBar({ days, activeDayId, onSelect }: Props) {
  return (
    <div
      className="bg-surface-200/90 sticky top-14 z-20 -mx-4 overflow-x-auto px-4 pt-3 pb-2 backdrop-blur-md"
      role="tablist"
      aria-label="일자 선택"
    >
      <ul className="flex gap-2">
        {days.map((d) => {
          const active = d.id === activeDayId;
          return (
            <li key={d.id}>
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelect(d.id)}
                className={cn(
                  "flex h-12 min-w-[64px] flex-col items-center justify-center rounded-[10px] px-3 transition-colors duration-150",
                  active
                    ? "bg-accent-orange text-cream"
                    : "bg-surface-400 text-ink-700 hover:text-ink-900",
                )}
              >
                <span
                  className={cn(
                    "text-[10px] font-medium tracking-wider uppercase",
                    active ? "text-cream/90" : "text-ink-600",
                  )}
                >
                  Day {d.day_number}
                </span>
                <span className="mt-0.5 text-[13px] font-semibold">
                  {formatShortDate(d.date)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function formatShortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}
