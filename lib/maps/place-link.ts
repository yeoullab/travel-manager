/**
 * §6.13 V1 — 일정 카드/모달/게스트 페이지의 "📍 지도에서 보기" 버튼이 가리킬 URL 결정.
 *
 * 우선순위:
 *   1. place_external_url (옵션 A) — 검색 결과 출처 URL (Naver Place / Google Maps Place 페이지)
 *   2. 좌표 기반 일반 지도 검색 (옵션 C) — 옛 일정 / external_url 누락 fallback
 *   3. null — 좌표도 없으면 버튼 숨김
 *
 * isDomestic 플래그로 Naver Map ↔ Google Maps fallback 분기.
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
