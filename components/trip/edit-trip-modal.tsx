"use client";

import { useState } from "react";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { DateShrinkConfirm } from "@/components/trip/date-shrink-confirm";
import { useUpdateTrip } from "@/lib/trip/use-update-trip";
import { useResizeTripDays } from "@/lib/trip/use-resize-trip-days";
import { validateTripDates } from "@/lib/trip/trip-date-validation";
import type { TripRow } from "@/lib/trip/use-trips-list";

const CURRENCIES = ["KRW", "JPY", "USD", "EUR", "CNY", "THB"];

type Props = {
  trip: TripRow;
  onClose: () => void;
  onSaved: () => void;
};

export function EditTripModal({ trip, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(trip.title);
  const [destination, setDestination] = useState(trip.destination);
  const [start, setStart] = useState(trip.start_date);
  const [end, setEnd] = useState(trip.end_date);
  const [isDomestic, setIsDomestic] = useState(trip.is_domestic);
  const [currencies, setCurrencies] = useState<string[]>(trip.currencies);
  const [dateError, setDateError] = useState<string | null>(null);
  const [showShrinkConfirm, setShowShrinkConfirm] = useState(false);

  const updateTrip = useUpdateTrip();
  const resizeTripDays = useResizeTripDays();

  const isShrinking = end < trip.end_date || start > trip.start_date;

  async function save() {
    const dateErr = validateTripDates(start, end);
    if (dateErr) {
      setDateError(dateErr);
      return;
    }
    setDateError(null);

    const dateChanged = start !== trip.start_date || end !== trip.end_date;

    if (dateChanged) {
      await resizeTripDays.mutateAsync({ tripId: trip.id, newStart: start, newEnd: end });
    }

    await updateTrip.mutateAsync({
      id: trip.id,
      title,
      destination,
      isDomestic,
      currencies,
    });

    onSaved();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isShrinking) {
      setShowShrinkConfirm(true);
    } else {
      await save();
    }
  }

  if (showShrinkConfirm) {
    const originalDays =
      Math.round(
        (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000,
      ) + 1;
    const newDays =
      Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
    return (
      <DateShrinkConfirm
        fromDay={newDays + 1}
        toDay={originalDays}
        onConfirm={save}
        onCancel={() => setShowShrinkConfirm(false)}
      />
    );
  }

  const isPending = updateTrip.isPending || resizeTripDays.isPending;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-4">
      <TextField
        label="여행 제목"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={100}
      />
      <TextField
        label="목적지"
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
        maxLength={100}
      />
      <div className="flex gap-3">
        <TextField
          label="시작일"
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <TextField
          label="종료일"
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </div>
      {dateError && <p className="text-error text-[12px]">{dateError}</p>}
      <div className="flex gap-2">
        {["국내", "해외"].map((label, i) => (
          <Button
            key={label}
            type="button"
            variant={isDomestic === (i === 0) ? "primary" : "ghost"}
            onClick={() => setIsDomestic(i === 0)}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {CURRENCIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() =>
              setCurrencies((prev) =>
                prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
              )
            }
            className={cn(
              "h-9 rounded-full px-4 text-[13px] font-medium transition-colors",
              currencies.includes(c)
                ? "bg-ink-900 text-cream"
                : "bg-surface-400 text-ink-700 hover:text-ink-900",
            )}
            aria-pressed={currencies.includes(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="ghost" fullWidth onClick={onClose}>
          취소
        </Button>
        <Button type="submit" variant="primary" fullWidth disabled={isPending}>
          {isPending ? "저장 중..." : "저장"}
        </Button>
      </div>
    </form>
  );
}
