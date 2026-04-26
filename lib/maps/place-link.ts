/**
 * §6.13 V1.1 — 일정 카드/모달/게스트 페이지의 "📍 지도에서 보기" 버튼이 가리킬 URL 결정.
 *
 * 정책:
 * - 국내 (Naver): 항상 Naver Map place 페이지로 이동. Naver 지역검색 API 의 `link` 필드는
 *   사업자 등록 외부 URL (instagram/홈페이지 등) 이라 신뢰 안 함 → naver-search.ts 에서
 *   externalUrl 미저장. 좌표/이름 기반 `map.naver.com/v5/search/<name>` 으로 통일.
 * - 해외 (Google): Places API (New) 의 `googleMapsUri` 가 정식 Google Maps Place 페이지 →
 *   placeExternalUrl 우선. 누락 시 좌표 기반 `google.com/maps/search` 로 fallback.
 *
 * 우선순위:
 *   1. place_external_url (옵션 A — Google 만 실효)
 *   2. 좌표 기반 일반 지도 검색 (옵션 C — Naver 는 항상 이 경로)
 *   3. null — 좌표도 없으면 버튼 숨김
 */

export type PlaceLinkInput = {
  placeExternalUrl: string | null;
  placeLat: number | null;
  placeLng: number | null;
  placeName?: string | null;
  isDomestic: boolean;
};

export function resolvePlaceLink(item: PlaceLinkInput): string | null {
  // 옵션 A: 저장된 외부 URL 우선. https?:// 스킴만 (DB CHECK 와 동일 보장).
  if (item.placeExternalUrl && /^https?:\/\//i.test(item.placeExternalUrl)) {
    return item.placeExternalUrl;
  }
  // 옵션 C: 좌표 fallback. 좌표가 없거나 유한하지 않으면 버튼 숨김.
  if (
    item.placeLat == null ||
    item.placeLng == null ||
    !Number.isFinite(item.placeLat) ||
    !Number.isFinite(item.placeLng)
  ) {
    return null;
  }
  if (item.isDomestic) {
    // Naver Map 검색: 이름이 있으면 이름으로, 없으면 좌표로.
    const q = encodeURIComponent(item.placeName || `${item.placeLat},${item.placeLng}`);
    return `https://map.naver.com/v5/search/${q}`;
  }
  // Google Maps 좌표 기반 검색.
  return `https://www.google.com/maps/search/?api=1&query=${item.placeLat},${item.placeLng}`;
}
