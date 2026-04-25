import { createSerwistRoute } from "@serwist/turbopack";

/**
 * Service Worker route handler — @serwist/turbopack 가 build 시점에 sw.ts 를 esbuild 로
 * 번들 + precache 매니페스트 주입 → /sw.js (+ /sw.js.map) 로 정적 노출.
 *
 * dynamicParams: false 로 generateStaticParams 가 반환한 path 외엔 404. 정적 라우트는
 * App Router 의 우선순위가 더 높으므로 /login, /trips 등 1단계 정적 페이지와 충돌 없음.
 *
 * dev 환경에서 SW 자체는 빌드되지만 클라이언트 등록 (ServiceWorkerRegistrar) 이
 * production 만 호출하므로 dev/prod 분리는 그쪽에서 책임 (Task 7).
 */
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "app/sw.ts",
    // macOS/Linux 네이티브 esbuild 사용 (esbuild-wasm 미설치 회피).
    useNativeEsbuild: true,
  });
