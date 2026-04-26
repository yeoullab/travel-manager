---
type: qa-checklist
phase: 8
date: 2026-04-26
project: travel-manager
---

# Phase 8 PWA — Manual QA 체크리스트

> 자동 검증 (unit/integration/E2E) 은 plan Task 8 에서 PASS 처리. 본 문서는
> 실 브라우저/디바이스에서 PWA 설치 + SW + 오프라인 동작을 사용자가 직접
> 확인할 항목만 모은다.

> **중요 (turbopack pivot 반영):**
> - SW 산출물은 `public/sw.js` 정적 파일이 아니라 `app/[path]/route.ts` Route Handler 가 production 빌드 시 `/sw.js` + `/sw.js.map` 으로 정적 노출 (App Router `dynamicParams: false` + `generateStaticParams`).
> - dev 모드에선 라우트 자체는 200 응답하지만 클라이언트 등록 (`ServiceWorkerRegistrar`) 이 `process.env.NODE_ENV === "production"` 가드로 register 자체를 skip.
> - 따라서 SW 동작/캐시 항목은 반드시 `pnpm build && pnpm start` 후 검증.

## 1. Chrome (Desktop) — Application 탭 검증

`pnpm build && pnpm start` 후 http://localhost:3000 접속.

- [ ] DevTools → Application → Manifest: name="travel-manager", icons 4종 (192/512/maskable-512/apple-180), theme_color=#f2f1ed, display=standalone
- [ ] Application → Service Workers: `/sw.js` activated and is running, scope `/`
- [ ] Application → Cache Storage: serwist 캐시 그룹들 (`pages`, `static-image-assets`, `static-font-assets`, `static-style-assets`, `static-js-assets`, `next-data`, `start-url` 등) 채워짐
- [ ] Network 탭 → Disable cache 끄고 재방문: 정적 자산이 (from ServiceWorker) 표시
- [ ] Lighthouse → PWA 카테고리: "Installable" + "PWA Optimized" 통과

## 2. Chrome — 오프라인 동작

- [ ] DevTools → Network → Offline 토글
- [ ] 이미 본 trip detail 페이지 새로고침 → 캐시 hit (HTML SWR + static CacheFirst)
- [ ] 새 trip URL 입력 → `/offline` 페이지 표시 (navigation fallback)
- [ ] "다시 시도" 버튼 클릭 → location.reload (Online 복원 후 정상 동작)

## 3. iOS Safari (실기기)

- [ ] Safari → 공유 → 홈화면에 추가 → 아이콘이 apple-touch-icon-180.png 사용
- [ ] 홈화면 아이콘 탭 → standalone (Safari URL bar 없음)
- [ ] 상태표시줄 색이 theme_color (#f2f1ed) 와 비슷한 톤
- [ ] (참고) iOS 는 SW precache 정책이 Chrome 대비 보수적 — 단순 설치성만 검증

## 4. Android Chrome (실기기)

- [ ] 메뉴 → "앱 설치" 옵션 등장
- [ ] 설치 후 앱 드로어에서 실행 → standalone

## 5. CSP 위반 부재

- [ ] DevTools Console 에 CSP 위반 0건 (특히 `worker-src 'self'` 관련)
- [ ] Service Worker 등록 console.warn 0건

## 6. dev 모드 SW 비활성화

- [ ] `pnpm dev` 후 Application → Service Workers 비어있음 (registrar 가 NODE_ENV 가드로 skip)
- [ ] HMR 정상 동작 (코드 수정 → 페이지 자동 갱신, SW 캐시 간섭 없음)
- [ ] (참고) `/sw.js` 라우트 자체는 dev 에서도 200 응답 — registrar 가 register 호출만 안 함

## 7. 성능 (참고)

- [ ] 재방문 시 first contentful paint 가 신규 방문 대비 단축 (Lighthouse 비교)
- [ ] Pretendard 폰트 woff2 가 Cache Storage hit

## 자동 검증 요약 (참고)

- unit: `pwa-manifest.test.ts` 4 cases · `runtime-caching.test.ts` 9 cases
- integration: `pwa-build-artifacts.test.ts` 5 cases (manifest + 4 icons + sw.ts source + [path]/route.ts source + next.config wrap)
- E2E (anonymous project): `pwa.spec.ts` 5 cases (manifest 200 + /offline + apple-touch-icon link + manifest link + /sw.js 200+10KB)
