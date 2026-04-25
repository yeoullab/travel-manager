import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

/**
 * Phase 0 기본 보안 헤더 세트.
 *  - X-Robots-Tag: 목업 preview URL의 검색엔진 인덱싱 차단
 *  - CSP: default-src 'self' 기반. 폰트/이미지 예외. Phase 1 이후 Supabase·Maps 도메인 추가
 *  - 기타 기본 방어 헤더 (HSTS는 prod 도메인 적용 후 활성화)
 */
const isDev = process.env.NODE_ENV !== "production";

// Naver Maps SDK 는 페이지 protocol(dev=http)을 따라 subsequent 요청을 발행.
// dev 에서는 http 스킴, prod 에서는 https 만 허용.
const naverMapsHostsHttps = [
  "https://oapi.map.naver.com", // auth, SDK
  "https://nrbe.map.naver.com", // 타일 스토어 JSONP
  "https://*.pstatic.net", // 타일/정적 리소스 CDN
  "https://*.map.naver.net", // 타일 CDN
];
const naverMapsHostsHttp = isDev
  ? [
      "http://oapi.map.naver.com",
      "http://nrbe.map.naver.com",
      "http://*.pstatic.net",
      "http://*.map.naver.net",
    ]
  : [];
const naverMapsHosts = [...naverMapsHostsHttps, ...naverMapsHostsHttp];

// Next.js dev 모드의 React Refresh와 Turbopack HMR이 eval을 사용하므로
// dev 에서만 'unsafe-eval' 허용. production 빌드는 그대로 차단.
const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  isDev ? "'unsafe-eval'" : "",
  "https://accounts.google.com",
  "https://accounts.google.com/gsi/client",
  // Phase 3 (ADR-009) — Maps SDK
  ...naverMapsHosts,
  "https://maps.googleapis.com", // Google Maps JS loader
]
  .filter(Boolean)
  .join(" ");

// Supabase REST + Realtime 모두 허용. Realtime은 wss:// 스킴을 쓰므로 별도 항목 필요.
const supabaseHttp = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWs = supabaseHttp.replace(/^https:\/\//i, "wss://");

const imgSrc = [
  "img-src 'self' data: blob:",
  "https://lh3.googleusercontent.com",
  // Phase 3 Maps 타일/정적 이미지
  "https://*.naver.net", // Naver 타일
  "https://*.pstatic.net", // Naver 정적
  ...(isDev ? ["http://*.naver.net", "http://*.pstatic.net"] : []),
  "https://maps.googleapis.com", // Google Static Maps
  "https://maps.gstatic.com", // Google 아이콘
  "https://*.googleusercontent.com", // Google Places photos
].join(" ");

const connectSrc = [
  "connect-src 'self'",
  supabaseHttp,
  supabaseWs,
  "https://accounts.google.com",
  // Phase 3 — Maps/Search API (client 에서 직접 호출하는 도메인 + SDK 가 fetch 하는 도메인)
  ...naverMapsHosts, // Naver Maps auth + 타일 스토어 XHR (http/https 둘 다)
  "https://naveropenapi.apigw.ntruss.com",
  "https://maps.googleapis.com",
].join(" ");

const securityHeaders = [
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      // Google Maps SDK 가 inline style 대량 주입 → 'unsafe-inline' 유지 (nonce 지원 없음)
      "style-src 'self' 'unsafe-inline' https://accounts.google.com",
      imgSrc,
      "font-src 'self' data:",
      connectSrc,
      "frame-src https://accounts.google.com",
      "worker-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  // dev SW 는 HMR 충돌 + Workbox console 노이즈 → 비활성화. preview/prod 만 동작.
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(nextConfig);
