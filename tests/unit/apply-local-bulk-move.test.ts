import { describe, expect, it } from "vitest";
import { applyLocalBulkMove } from "@/lib/schedule/apply-local-bulk-move";
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";

function make(id: string, tripDayId: string, sortOrder: number): ScheduleItem {
  return {
    id,
    trip_day_id: tripDayId,
    title: id,
    sort_order: sortOrder,
    time_of_day: null,
    place_name: null,
    place_address: null,
    place_lat: null,
    place_lng: null,
    place_provider: null,
    place_external_id: null,
    memo: null,
    url: null,
    created_at: "2026-05-05T00:00:00Z",
    updated_at: "2026-05-05T00:00:00Z",
  } as ScheduleItem;
}

describe("applyLocalBulkMove", () => {
  const D1 = "day-1";
  const D2 = "day-2";
  const base = [
    make("a", D1, 1),
    make("b", D1, 2),
    make("c", D1, 3),
    make("x", D2, 1),
  ];

  it("appends selected items to target day in the selected order and compacts both days", () => {
    const next = applyLocalBulkMove(base, ["b", "a"], D2);

    expect(
      next
        .filter((item) => item.trip_day_id === D1)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((item) => [item.id, item.sort_order]),
    ).toEqual([["c", 1]]);

    expect(
      next
        .filter((item) => item.trip_day_id === D2)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((item) => [item.id, item.sort_order]),
    ).toEqual([
      ["x", 1],
      ["b", 2],
      ["a", 3],
    ]);
  });

  it("rejects duplicate, empty, missing, and already-target selections", () => {
    expect(() => applyLocalBulkMove(base, [], D2)).toThrow(/empty/i);
    expect(() => applyLocalBulkMove(base, ["a", "a"], D2)).toThrow(/duplicate/i);
    expect(() => applyLocalBulkMove(base, ["missing"], D2)).toThrow(/not found/i);
    expect(() => applyLocalBulkMove(base, ["x"], D2)).toThrow(/target/i);
  });

  it("does not mutate input", () => {
    const snap = JSON.parse(JSON.stringify(base));
    applyLocalBulkMove(base, ["a"], D2);
    expect(base).toEqual(snap);
  });
});
