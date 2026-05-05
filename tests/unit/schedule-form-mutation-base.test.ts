import { describe, expect, it } from "vitest";
import { buildScheduleMutationBase } from "@/lib/schedule/build-schedule-mutation-base";
import type { PlaceResult } from "@/lib/maps/types";

describe("buildScheduleMutationBase", () => {
  it("stores manual place name and address in place fields without merging address into memo", () => {
    expect(
      buildScheduleMutationBase({
        title: "수기 식당",
        categoryCode: "food",
        timeOfDay: "12:00",
        memo: "대표 메뉴 확인",
        url: null,
        place: null,
        placeAddressManual: "서울 중구 을지로 200",
      }),
    ).toEqual({
      title: "수기 식당",
      categoryCode: "food",
      timeOfDay: "12:00",
      memo: "대표 메뉴 확인",
      url: null,
      placeName: "수기 식당",
      placeAddress: "서울 중구 을지로 200",
      placeLat: null,
      placeLng: null,
      placeProvider: null,
      placeExternalId: null,
      placeExternalUrl: null,
    });
  });

  it("uses searched place coordinates when a place is selected", () => {
    const place: PlaceResult = {
      externalId: "naver:1",
      name: "검색 식당",
      address: "서울 중구",
      lat: 37.5,
      lng: 127,
      provider: "naver",
      externalUrl: "https://map.naver.com/p/1",
    };

    expect(
      buildScheduleMutationBase({
        title: "검색 식당",
        categoryCode: "food",
        timeOfDay: null,
        memo: null,
        url: "https://example.com",
        place,
        placeAddressManual: "무시할 주소",
      }),
    ).toEqual({
      title: "검색 식당",
      categoryCode: "food",
      timeOfDay: null,
      memo: null,
      url: "https://example.com",
      placeName: "검색 식당",
      placeAddress: "서울 중구",
      placeLat: 37.5,
      placeLng: 127,
      placeProvider: "naver",
      placeExternalId: "naver:1",
      placeExternalUrl: "https://map.naver.com/p/1",
    });
  });
});
