import { describe, it, expect } from "vitest";
import { initialStageFor } from "@/components/schedule/schedule-item-modal";
import type { Database } from "@/types/database";

type ScheduleItem = Database["public"]["Tables"]["schedule_items"]["Row"];

function mkItem(partial: Partial<ScheduleItem>): ScheduleItem {
  return {
    id: "x",
    trip_day_id: "d",
    title: "t",
    sort_order: 1,
    time_of_day: null,
    place_name: null,
    place_address: null,
    place_lat: null,
    place_lng: null,
    place_provider: null,
    place_external_id: null,
    place_external_url: null,
    memo: null,
    url: null,
    created_at: "2026-04-22T00:00:00Z",
    updated_at: "2026-04-22T00:00:00Z",
    category_code: "other",
    ...partial,
  };
}

describe("schedule-item-modal — initialStageFor", () => {
  it("returns 'category_select' when no initial (create mode)", () => {
    expect(initialStageFor(null)).toBe("category_select");
    expect(initialStageFor(undefined)).toBe("category_select");
  });

  it("returns 'other_form' when initial.category_code === 'other'", () => {
    expect(initialStageFor(mkItem({ category_code: "other" }))).toBe("other_form");
  });

  it("returns 'place_search' for all non-'other' categories", () => {
    for (const code of ["transport", "sightseeing", "food", "lodging", "shopping"] as const) {
      expect(initialStageFor(mkItem({ category_code: code }))).toBe("place_search");
    }
  });
});
