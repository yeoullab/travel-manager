import type { NextConfig } from "next";

/**
 * Phase 0 기본 보안 헤더 세트.
 *  - X-Robots-Tag: 목업 preview URL의 검색엔진 인덱싱 차단
 *  - CSP: default-src 'self' 기반. 폰트/이미지 예외. Phase 1 이후 Supabase·Maps 도메인 추가
 *  - 기타 기본 방어 헤더 (HSTS는 prod 도메인 적용 후 활성화)
 */
const isDev = process.env.NODE_ENV !== "production";

// Next.js dev 모드의 React Refresh와 Turbopack HMR이 eval을 사용하므로
// dev 에서만 'unsafe-eval' 허용. production 빌드는 그대로 차단.
const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  isDev ? "'unsafe-eval'" : "",
  "https://accounts.google.com",
  "https://accounts.google.com/gsi/client",
]
  .filter(Boolean)
  .join(" ");

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
      "style-src 'self' 'unsafe-inline' https://accounts.google.com",
      "img-src 'self' data: blob: https://lh3.googleusercontent.com",
      "font-src 'self' data:",
      `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""} https://accounts.google.com`,
      "frame-src https://accounts.google.com",
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

export default nextConfig;
