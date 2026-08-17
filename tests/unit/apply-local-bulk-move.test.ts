import { describe, expect, it } from "vitest";
import { applyLocalBulkMove } from "@/lib/schedule/apply-local-bulk-move";
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";

function make(
  id: string,
  tripDayId: string,
  sortOrder: number,
  isCandidate = false,
): ScheduleItem {
  return {
    id,
    trip_day_id: tripDayId,
    trip_id: "trip-1",
    is_candidate: isCandidate,
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

  it("후보 아이템 이동 시도는 에러 (main 전용)", () => {
    const items = [make("c1", D1, 1, true)];
    expect(() => applyLocalBulkMove(items, ["c1"], D2)).toThrow(/candidate/);
  });

  it("본 일정 벌크 이동은 후보 sort_order 에 영향을 주지 않는다", () => {
    const items = [
      make("m1", D1, 1, false),
      make("c1", D1, 1, true),
      make("c9", D2, 1, true),
    ];
    const next = applyLocalBulkMove(items, ["m1"], D2);
    const find = (id: string) => next.find((i) => i.id === id)!;
    expect(find("m1").trip_day_id).toBe(D2);
    expect(find("m1").sort_order).toBe(1);
    expect(find("c1").sort_order).toBe(1);
    expect(find("c9").sort_order).toBe(1);
  });
});
