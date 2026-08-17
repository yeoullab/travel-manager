import { describe, it, expect } from "vitest";
import {
  initialManualAddressFor,
  initialStageFor,
} from "@/components/schedule/schedule-item-modal";
import type { Database } from "@/types/database";

type ScheduleItem = Database["public"]["Tables"]["schedule_items"]["Row"];

function mkItem(partial: Partial<ScheduleItem>): ScheduleItem {
  return {
    id: "x",
    trip_day_id: "d",
    trip_id: "trip-1",
    is_candidate: false,
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

  it("returns 'place_search' for coordinate-backed non-'other' places", () => {
    for (const code of ["transport", "sightseeing", "food", "cafe", "lodging", "shopping"] as const) {
      expect(
        initialStageFor(
          mkItem({
            category_code: code,
            place_name: "place",
            place_address: "address",
            place_lat: 37.5,
            place_lng: 127,
            place_provider: "naver",
          }),
        ),
      ).toBe("place_search");
    }
  });

  it("returns 'manual_place' for non-'other' places saved with address but no coordinates", () => {
    expect(
      initialStageFor(
        mkItem({
          category_code: "food",
          place_name: "수기 식당",
          place_address: "서울 중구 을지로 200",
        }),
      ),
    ).toBe("manual_place");
  });
});

describe("schedule-item-modal — initialManualAddressFor", () => {
  it("prefills the manual address for coordinate-less manual places", () => {
    expect(
      initialManualAddressFor(
        mkItem({
          category_code: "food",
          place_name: "수기 식당",
          place_address: "서울 중구 을지로 200",
        }),
      ),
    ).toBe("서울 중구 을지로 200");
  });

  it("returns an empty string for coordinate-backed places", () => {
    expect(
      initialManualAddressFor(
        mkItem({
          category_code: "food",
          place_name: "검색 식당",
          place_address: "서울 중구",
          place_lat: 37.5,
          place_lng: 127,
          place_provider: "naver",
        }),
      ),
    ).toBe("");
  });
});
