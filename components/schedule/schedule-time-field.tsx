"use client";

import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/cn";
import {
  buildTimeOfDay,
  HOUR_12_OPTIONS,
  MINUTE_OPTIONS,
  parseTimeOfDay,
  type ParsedTimeOfDay,
} from "@/lib/schedule/time-of-day";

type ScheduleTimeFieldMode = "auto" | "native" | "custom";

type Props = {
  value: string;
  onChange: (value: string) => void;
  mode?: ScheduleTimeFieldMode;
};

const DEFAULT_TIME_OF_DAY: ParsedTimeOfDay = {
  period: "AM",
  hour12: "09",
  minute: "00",
};

type DraftTimeOfDay = Partial<ParsedTimeOfDay>;

export function ScheduleTimeField({ value, onChange, mode = "auto" }: Props) {
  const id = useId();
  const useNative = useNativeTimeInput(mode);

  if (useNative) {
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-ink-700 text-[13px] font-medium">
          시간
        </label>
        <input
          id={id}
          type="time"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="border-border-primary bg-surface-100 text-ink-900 focus:border-border-medium h-11 rounded-[8px] border px-3 text-[15px] transition-colors duration-150 focus:shadow-[0_4px_12px_rgba(0,0,0,0.1)] focus:outline-none"
        />
      </div>
    );
  }

  return <DesktopTimePicker value={value} onChange={onChange} id={id} />;
}

function useNativeTimeInput(mode: ScheduleTimeFieldMode): boolean {
  const [native, setNative] = useState(mode !== "custom");

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (mode === "native") {
      setNative(true);
      return;
    }
    if (mode === "custom") {
      setNative(false);
      return;
    }
    if (typeof window.matchMedia !== "function") {
      setNative(false);
      return;
    }
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const hoverNone = window.matchMedia("(hover: none)").matches;
    setNative(coarse || hoverNone);
  }, [mode]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return native;
}

function DesktopTimePicker({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  id: string;
}) {
  const [draft, setDraft] = useState<DraftTimeOfDay>(() => parseTimeOfDay(value) ?? {});
  const hourId = `${id}-hour`;
  const minuteId = `${id}-minute`;

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setDraft(parseTimeOfDay(value) ?? {});
  }, [value]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function apply(next: DraftTimeOfDay) {
    const merged = { ...DEFAULT_TIME_OF_DAY, ...draft, ...next };
    setDraft(merged);
    onChange(buildTimeOfDay(merged.period, merged.hour12, merged.minute));
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-ink-700 text-[13px] font-medium">시간</legend>
      <div className="inline-flex w-fit rounded-[8px] border border-border-primary bg-surface-100 p-1">
        {(["AM", "PM"] as const).map((period) => (
          <button
            key={period}
            type="button"
            aria-pressed={draft.period === period}
            onClick={() => apply({ period })}
            className={cn(
              "h-9 rounded-[6px] px-4 text-[14px] font-medium transition-colors",
              draft.period === period
                ? "bg-accent-orange text-cream"
                : "text-ink-700 hover:bg-surface-300",
            )}
          >
            {period === "AM" ? "오전" : "오후"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-[12px] text-ink-600" htmlFor={hourId}>
          시
          <select
            id={hourId}
            value={draft.hour12 ?? ""}
            onChange={(e) => apply({ hour12: e.target.value })}
            className="border-border-primary bg-surface-100 text-ink-900 h-11 rounded-[8px] border px-3 text-[15px]"
          >
            <option value="" disabled>
              시
            </option>
            {HOUR_12_OPTIONS.map((hour) => (
              <option key={hour} value={hour}>
                {hour}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-ink-600" htmlFor={minuteId}>
          분
          <select
            id={minuteId}
            value={draft.minute ?? ""}
            onChange={(e) => apply({ minute: e.target.value })}
            className="border-border-primary bg-surface-100 text-ink-900 h-11 rounded-[8px] border px-3 text-[15px]"
          >
            <option value="" disabled>
              분
            </option>
            {MINUTE_OPTIONS.map((minute) => (
              <option key={minute} value={minute}>
                {minute}
              </option>
            ))}
          </select>
        </label>
      </div>
      {value && (
        <button
          type="button"
          onClick={() => {
            setDraft({});
            onChange("");
          }}
          className="text-ink-500 w-fit text-[12px] underline underline-offset-2"
        >
          시간 지우기
        </button>
      )}
    </fieldset>
  );
}
