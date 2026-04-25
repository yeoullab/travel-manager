/**
 * @serwist/next runtime caching 정책.
 *
 * 핵심 설계:
 *  - Supabase / Maps API / Google auth 는 **절대 캐시 안 함** (RLS·세션·rate-limit·실시간성).
 *  - 정적 자산 (`/_next/static/*`, font woff2) 은 CacheFirst (해시 기반 immutable 자산).
 *  - HTML navigation 은 SWR — 즉시 캐시 응답, background 갱신.
 *
 * 본 모듈은 SW 빌드 시점 (Workbox routing 등록) + unit test 양쪽에서 import.
 */

export type CacheHandler = "NetworkOnly" | "CacheFirst" | "StaleWhileRevalidate";

export type RuntimeCachePolicy = {
  /** 매칭 대상 origin host suffix 또는 pathname prefix */
  match: (url: URL, destination?: RequestDestination) => boolean;
  handler: CacheHandler;
  cacheName?: string;
  /** 표시용 라벨 (디버깅/로그) */
  label: string;
};

const SUPABASE_HOST_SUFFIX = ".supabase.co";
const NAVER_MAPS_SUFFIXES = [
  ".map.naver.com",
  ".pstatic.net",
  ".map.naver.net",
  "naveropenapi.apigw.ntruss.com",
];
const GOOGLE_API_HOSTS = [
  "maps.googleapis.com",
  "maps.gstatic.com",
  "accounts.google.com",
];

export const RUNTIME_CACHE_POLICIES: RuntimeCachePolicy[] = [
  {
    label: "supabase-rest-realtime-auth",
    handler: "NetworkOnly",
    match: (url) => url.host.endsWith(SUPABASE_HOST_SUFFIX),
  },
  {
    label: "naver-maps",
    handler: "NetworkOnly",
    match: (url) =>
      NAVER_MAPS_SUFFIXES.some((s) => url.host === s || url.host.endsWith(s)),
  },
  {
    label: "google-maps-and-auth",
    handler: "NetworkOnly",
    match: (url) => GOOGLE_API_HOSTS.includes(url.host),
  },
  {
    label: "next-static-assets",
    handler: "CacheFirst",
    cacheName: "static-assets",
    match: (url) =>
      url.pathname.startsWith("/_next/static/") ||
      /\.(?:woff2?|ttf|otf)$/i.test(url.pathname),
  },
  {
    label: "html-pages",
    handler: "StaleWhileRevalidate",
    cacheName: "pages",
    match: (_url, destination) => destination === "document",
  },
];

export function matchPolicy(
  url: URL,
  destination?: RequestDestination,
): RuntimeCachePolicy | null {
  for (const p of RUNTIME_CACHE_POLICIES) {
    if (p.match(url, destination)) return p;
  }
  return null;
}
