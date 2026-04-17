import type { NextConfig } from "next";

/**
 * Phase 0 기본 보안 헤더 세트.
 *  - X-Robots-Tag: 목업 preview URL의 검색엔진 인덱싱 차단
 *  - CSP: default-src 'self' 기반. 폰트/이미지 예외. Phase 1 이후 Supabase·Maps 도메인 추가
 *  - 기타 기본 방어 헤더 (HSTS는 prod 도메인 적용 후 활성화)
 */
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
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
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
