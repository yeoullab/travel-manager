import type { MapsProvider, MapsProviderName } from "./types";

const cache = new Map<MapsProviderName, MapsProvider>();

export function providerForTrip(isDomestic: boolean): MapsProviderName {
  return isDomestic ? "naver" : "google";
}

/**
 * Lazy-load the chosen Maps SDK + provider. dynamic import 로 trip 에서 실제 필요할 때까지
 * 번들에 포함되지 않는다. 캐시 재조회 시에도 `loadSdk()` 를 재호출 — SDK 가 외부 script 태그
 * 삽입으로 전역에 달라붙으므로 멱등성은 provider 내부 `loadPromise` 재사용으로 보장된다.
 */
export async function getMapsProvider(name: MapsProviderName): Promise<MapsProvider> {
  const cached = cache.get(name);
  if (cached) {
    await cached.loadSdk();
    return cached;
  }
  const mod =
    name === "naver"
      ? await import("./providers/naver-provider")
      : await import("./providers/google-provider");
  const provider = mod.default;
  cache.set(name, provider);
  await provider.loadSdk();
  return provider;
}
