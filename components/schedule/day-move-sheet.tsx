"use client";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import type { TripDay } from "@/lib/trip/use-trip-days";

type Props = {
  open: boolean;
  days: TripDay[];
  currentDayId: string;
  onClose: () => void;
  onPick: (targetDayId: string) => void;
};

export function DayMoveSheet({ open, days, currentDayId, onClose, onPick }: Props) {
  const others = days.filter((d) => d.id !== currentDayId);
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="다른 날로 이동"
      footer={
        <Button fullWidth variant="secondary" onClick={onClose}>
          취소
        </Button>
      }
    >
      {others.length === 0 ? (
        <p className="text-ink-600 py-6 text-center text-[13px]">다른 일자가 없어요.</p>
      ) : (
        <ul className="divide-border-primary divide-y">
          {others.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                className="text-ink-900 w-full py-3 text-left text-[14px]"
                onClick={() => onPick(d.id)}
              >
                Day {d.day_number}
                <span className="text-ink-500 ml-2 text-[12px]">{d.date}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </BottomSheet>
  );
}
