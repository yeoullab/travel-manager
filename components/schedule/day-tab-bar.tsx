"use client";

import { cn } from "@/lib/cn";
import type { TripDay } from "@/lib/trip/use-trip-days";

type Props = {
  days: TripDay[];
  activeDayId: string | null;
  onSelect: (dayId: string) => void;
  candidateActive?: boolean;
  onSelectCandidates?: () => void;
  className?: string;
};

export function DayTabBar({
  days,
  activeDayId,
  onSelect,
  candidateActive,
  onSelectCandidates,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "bg-surface-200/90 sticky top-14 z-20 -mx-4 overflow-x-auto px-4 pt-2 pb-1.5 backdrop-blur-md",
        className,
      )}
      role="tablist"
      aria-label="일자 선택"
    >
      <ul className="flex gap-1.5">
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
                  "flex h-10 min-w-[58px] flex-col items-center justify-center rounded-[8px] px-2.5 transition-colors duration-150",
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
        {onSelectCandidates && (
          <li>
            <button
              type="button"
              role="tab"
              aria-selected={candidateActive}
              onClick={onSelectCandidates}
              className={cn(
                "flex h-10 min-w-[58px] flex-col items-center justify-center rounded-[8px] border-2 border-dashed px-2.5 transition-colors duration-150",
                candidateActive
                  ? "border-accent-orange bg-accent-orange/10 text-accent-orange"
                  : "border-border-medium text-ink-700 hover:text-ink-900",
              )}
            >
              <span className="text-[10px] font-medium tracking-wider uppercase">Plan B</span>
              <span className="mt-0.5 text-[13px] font-semibold">후보</span>
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}

function formatShortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}
