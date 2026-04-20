import { describe, it, expect } from "vitest";
import { applyLocalReorder } from "@/lib/schedule/apply-local-reorder";
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
    created_at: "2026-04-20T00:00:00Z",
    updated_at: "2026-04-20T00:00:00Z",
  } as ScheduleItem;
}

describe("applyLocalReorder", () => {
  const D1 = "day-1";
  const D2 = "day-2";
  const base: ScheduleItem[] = [
    make("a", D1, 1),
    make("b", D1, 2),
    make("c", D1, 3),
    make("x", D2, 1),
  ];

  it("같은 day 내 재배치 후 sort_order 1-based 로 재번호한다", () => {
    const next = applyLocalReorder(base, D1, ["c", "a", "b"]);
    const d1 = next
      .filter((i) => i.trip_day_id === D1)
      .sort((a, b) => a.sort_order - b.sort_order);
    expect(d1.map((i) => [i.id, i.sort_order])).toEqual([
      ["c", 1],
      ["a", 2],
      ["b", 3],
    ]);
  });

  it("다른 day 는 건드리지 않는다", () => {
    const next = applyLocalReorder(base, D1, ["b", "a", "c"]);
    expect(next.find((i) => i.id === "x")).toEqual(
      expect.objectContaining({ id: "x", trip_day_id: D2, sort_order: 1 }),
    );
  });

  it("입력을 mutate 하지 않는다", () => {
    const snap = JSON.parse(JSON.stringify(base));
    applyLocalReorder(base, D1, ["c", "a", "b"]);
    expect(base).toEqual(snap);
  });

  it("set mismatch (누락 id) 시 throw", () => {
    expect(() => applyLocalReorder(base, D1, ["a", "b"])).toThrow(/set mismatch/i);
  });

  it("set mismatch (다른 day item 포함) 시 throw", () => {
    expect(() => applyLocalReorder(base, D1, ["a", "b", "c", "x"])).toThrow(/set mismatch/i);
  });
});
