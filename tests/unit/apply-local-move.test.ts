import { describe, it, expect } from "vitest";
import { applyLocalMove } from "@/lib/schedule/apply-local-move";
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

describe("applyLocalMove (1-based target_position)", () => {
  const D1 = "day-1";
  const D2 = "day-2";
  const D3 = "day-3";
  const base: ScheduleItem[] = [
    make("a", D1, 1),
    make("b", D1, 2),
    make("c", D1, 3),
    make("x", D2, 1),
    make("y", D2, 2),
  ];

  it("다른 day 로 이동 시 source 와 target 을 모두 재번호한다", () => {
    const next = applyLocalMove(base, "b", D2, 2);
    const d1 = next
      .filter((i) => i.trip_day_id === D1)
      .sort((a, b) => a.sort_order - b.sort_order);
    expect(d1.map((i) => [i.id, i.sort_order])).toEqual([
      ["a", 1],
      ["c", 2],
    ]);
    const d2 = next
      .filter((i) => i.trip_day_id === D2)
      .sort((a, b) => a.sort_order - b.sort_order);
    expect(d2.map((i) => [i.id, i.sort_order])).toEqual([
      ["x", 1],
      ["b", 2],
      ["y", 3],
    ]);
  });

  it("target position=1 은 맨 앞 삽입", () => {
    const next = applyLocalMove(base, "b", D2, 1);
    const d2 = next
      .filter((i) => i.trip_day_id === D2)
      .sort((a, b) => a.sort_order - b.sort_order);
    expect(d2.map((i) => i.id)).toEqual(["b", "x", "y"]);
  });

  it("target position=target_count+1 은 맨 뒤 삽입", () => {
    const next = applyLocalMove(base, "b", D2, 3);
    const d2 = next
      .filter((i) => i.trip_day_id === D2)
      .sort((a, b) => a.sort_order - b.sort_order);
    expect(d2.map((i) => i.id)).toEqual(["x", "y", "b"]);
  });

  it("same-day 호출은 throw (caller 가 reorder 로 분기해야 함)", () => {
    expect(() => applyLocalMove(base, "b", D1, 1)).toThrow(/same day|use_reorder/i);
  });

  it("존재하지 않는 id 는 throw", () => {
    expect(() => applyLocalMove(base, "zzz", D2, 1)).toThrow(/not found/i);
  });

  it("범위 밖 position (0 또는 count+2) 은 throw", () => {
    expect(() => applyLocalMove(base, "b", D2, 0)).toThrow(/invalid_target_position/);
    expect(() => applyLocalMove(base, "b", D2, 4)).toThrow(/invalid_target_position/);
  });

  it("빈 target day 로 이동 position=1 허용", () => {
    const next = applyLocalMove(base, "b", D3, 1);
    const d3 = next.filter((i) => i.trip_day_id === D3);
    expect(d3).toEqual([expect.objectContaining({ id: "b", trip_day_id: D3, sort_order: 1 })]);
  });

  it("입력을 mutate 하지 않는다", () => {
    const snap = JSON.parse(JSON.stringify(base));
    applyLocalMove(base, "b", D2, 2);
    expect(base).toEqual(snap);
  });
});
