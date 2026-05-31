export type TimePeriod = "AM" | "PM";

export type ParsedTimeOfDay = {
  period: TimePeriod;
  hour12: string;
  minute: string;
};

export const HOUR_12_OPTIONS = [
  "12",
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
];

export const MINUTE_OPTIONS = Array.from({ length: 60 }, (_v, i) =>
  String(i).padStart(2, "0"),
);

export function parseTimeOfDay(
  value: string | null | undefined,
): ParsedTimeOfDay | null {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour24 = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour24) || !Number.isInteger(minute)) return null;
  if (hour24 < 0 || hour24 > 23 || minute < 0 || minute > 59) return null;

  const period: TimePeriod = hour24 < 12 ? "AM" : "PM";
  const rawHour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return {
    period,
    hour12: String(rawHour12).padStart(2, "0"),
    minute: String(minute).padStart(2, "0"),
  };
}

export function buildTimeOfDay(
  period: TimePeriod,
  hour12: string,
  minute: string,
): string {
  const hour = Number(hour12);
  const min = Number(minute);
  if (!HOUR_12_OPTIONS.includes(hour12) || !MINUTE_OPTIONS.includes(minute)) {
    throw new Error("invalid_time_of_day");
  }
  const hour24 =
    period === "AM"
      ? hour === 12
        ? 0
        : hour
      : hour === 12
        ? 12
        : hour + 12;
  return `${String(hour24).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
