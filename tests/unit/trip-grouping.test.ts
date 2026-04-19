import { describe, expect, it } from "vitest";
import { groupTripsByStatus } from "@/lib/trip/trip-grouping";
import type { Database } from "@/types/database";

type TripRow = Database["public"]["Tables"]["trips"]["Row"];

function makeTrip(overrides: Partial<TripRow>): TripRow {
  const today = new Date().toISOString().split("T")[0];
  return {
    id: "00000000-0000-0000-0000-000000000001",
    group_id: null,
    created_by: "00000000-0000-0000-0000-000000000002",
    title: "Test Trip",
    destination: "Seoul",
    start_date: today,
    end_date: today,
    is_domestic: true,
    currencies: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("groupTripsByStatus", () => {
  it("오늘 포함 여행은 ongoing", () => {
    const today = new Date().toISOString().split("T")[0];
    const trip = makeTrip({ start_date: today, end_date: today });
    const result = groupTripsByStatus([trip]);
    expect(result.ongoing).toHaveLength(1);
    expect(result.upcoming).toHaveLength(0);
    expect(result.past).toHaveLength(0);
  });

  it("미래 시작 여행은 upcoming", () => {
    const future = new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0];
    const trip = makeTrip({ start_date: future, end_date: future });
    const result = groupTripsByStatus([trip]);
    expect(result.upcoming).toHaveLength(1);
  });

  it("어제 종료 여행은 past", () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const trip = makeTrip({ start_date: yesterday, end_date: yesterday });
    const result = groupTripsByStatus([trip]);
    expect(result.past).toHaveLength(1);
  });

  it("빈 배열은 모두 0", () => {
    const result = groupTripsByStatus([]);
    expect(result.ongoing).toHaveLength(0);
    expect(result.upcoming).toHaveLength(0);
    expect(result.past).toHaveLength(0);
  });
});
