import type { MapsProviderName } from "./types";

export function providerForTrip(isDomestic: boolean): MapsProviderName {
  return isDomestic ? "naver" : "google";
}

// `getMapsProvider` (lazy SDK loader) 는 Task 10 에서 실 provider 파일이 합류한 뒤 추가.
