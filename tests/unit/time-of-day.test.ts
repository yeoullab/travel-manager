import { describe, expect, it } from "vitest";
import {
  buildTimeOfDay,
  parseTimeOfDay,
  type TimePeriod,
} from "@/lib/schedule/time-of-day";

describe("schedule time of day helpers", () => {
  it.each([
    ["00:00", { period: "AM", hour12: "12", minute: "00" }],
    ["05:16", { period: "AM", hour12: "05", minute: "16" }],
    ["12:00", { period: "PM", hour12: "12", minute: "00" }],
    ["17:16", { period: "PM", hour12: "05", minute: "16" }],
    ["23:59", { period: "PM", hour12: "11", minute: "59" }],
  ] as const)("parses %s", (value, expected) => {
    expect(parseTimeOfDay(value)).toEqual(expected);
  });

  it.each([
    ["AM", "12", "00", "00:00"],
    ["AM", "05", "16", "05:16"],
    ["PM", "12", "00", "12:00"],
    ["PM", "05", "16", "17:16"],
    ["PM", "11", "59", "23:59"],
  ] as const)(
    "builds %s %s:%s",
    (period: TimePeriod, hour12, minute, expected) => {
      expect(buildTimeOfDay(period, hour12, minute)).toBe(expected);
    },
  );

  it("returns null for malformed input", () => {
    expect(parseTimeOfDay("24:00")).toBeNull();
    expect(parseTimeOfDay("10:60")).toBeNull();
    expect(parseTimeOfDay("nope")).toBeNull();
  });
});
