import { describe, it, expect } from "vitest";
import { resolvePlaceLink } from "@/lib/maps/place-link";

describe("resolvePlaceLink (§6.13)", () => {
  it("placeExternalUrl 가 있으면 그대로 반환 (옵션 A 우선)", () => {
    expect(
      resolvePlaceLink({
        placeExternalUrl: "https://map.naver.com/v5/entry/place/1234",
        placeLat: 37.5,
        placeLng: 127.0,
        placeName: "테스트 카페",
        isDomestic: true,
      }),
    ).toBe("https://map.naver.com/v5/entry/place/1234");
  });

  it("스킴이 https?:// 가 아닌 외부 URL 은 무시 (deeplink 방어)", () => {
    expect(
      resolvePlaceLink({
        placeExternalUrl: "nmap://place?id=42",
        placeLat: 37.5,
        placeLng: 127.0,
        placeName: "x",
        isDomestic: true,
      }),
    ).toBe("https://map.naver.com/v5/search/x");
  });

  it("국내 + 좌표 + 이름 → Naver 검색 fallback (옵션 C)", () => {
    const url = resolvePlaceLink({
      placeExternalUrl: null,
      placeLat: 37.5665,
      placeLng: 126.978,
      placeName: "서울시청",
      isDomestic: true,
    });
    expect(url).toBe(`https://map.naver.com/v5/search/${encodeURIComponent("서울시청")}`);
  });

  it("국내 + 좌표 + 이름 없음 → 좌표 문자열 검색", () => {
    const url = resolvePlaceLink({
      placeExternalUrl: null,
      placeLat: 37.5,
      placeLng: 127.0,
      placeName: null,
      isDomestic: true,
    });
    expect(url).toBe(`https://map.naver.com/v5/search/${encodeURIComponent("37.5,127")}`);
  });

  it("해외 + 좌표 → Google Maps 좌표 검색 (옵션 C)", () => {
    expect(
      resolvePlaceLink({
        placeExternalUrl: null,
        placeLat: 35.6595,
        placeLng: 139.7005,
        placeName: "Shibuya",
        isDomestic: false,
      }),
    ).toBe("https://www.google.com/maps/search/?api=1&query=35.6595,139.7005");
  });

  it("좌표 없음 + URL 없음 → null (버튼 숨김)", () => {
    expect(
      resolvePlaceLink({
        placeExternalUrl: null,
        placeLat: null,
        placeLng: null,
        placeName: "수동 입력",
        isDomestic: true,
      }),
    ).toBeNull();
  });

  it("lat 만 있고 lng null → null", () => {
    expect(
      resolvePlaceLink({
        placeExternalUrl: null,
        placeLat: 37.5,
        placeLng: null,
        placeName: null,
        isDomestic: true,
      }),
    ).toBeNull();
  });

  it("좌표가 NaN 이면 null", () => {
    expect(
      resolvePlaceLink({
        placeExternalUrl: null,
        placeLat: Number.NaN,
        placeLng: 127.0,
        placeName: null,
        isDomestic: true,
      }),
    ).toBeNull();
  });
});
