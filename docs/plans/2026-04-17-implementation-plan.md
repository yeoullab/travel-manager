# travel-manager — Implementation Plan

## Context

travel-manager는 커플·소그룹 여행 플래너 PWA로, 2026-04-16 기존 코드를 폐기하고 재설계된 상태다.
ADR-001~005, 전체 스펙(`docs/superpowers/specs/2026-04-16-travel-manager-design.md`),
DESIGN.md(410줄, §10 Mobile App Patterns 포함), 5관점 스펙 리뷰까지 완료되었고,
구현 직전 단계다. 프로젝트 루트에는 `docs/`, `DESIGN.md`, `CLAUDE.md` 외에는
아무것도 없다 — 코드 0줄.

**이 계획의 목표:** 구현을 단계별로 나누되, **Phase 0에서 정적 목업을 먼저 만들어 유저 피드백을 받고
이후 Phase를 조정 가능한 구조**로 설계한다. 유저는 개발자가 아니므로,
목업은 브라우저에서 직접 클릭하며 피드백 가능한 형태여야 한다.

**유저 결정 사항 (본 세션에서 확정):**
- 목업 스택: **Next.js + Tailwind** (Phase 1 자산 재사용 목적)
- 화면 범위: **15화면 전체**
- 인터랙션 수준: **네비게이션 + 핵심 인터랙션** (시트 열림/닫힘, 탭 전환, 스켈레톤 연출 포함, 실제 드래그/스와이프는 정적 프리뷰)
- 디바이스: **모바일(375px) 우선 + 데스크톱(1280px) 레이아웃 1~2개**

**6관점으로 작성:** 🧑‍💻 개발자 / 📊 PM / ✏️ 기획자 / 🎨 디자이너 / 🧪 QA / 🔒 보안

---

## Phase 0 — 목업 페이지 제작 (상세)

> **목적:** 유저가 전체 앱의 분위기·흐름·레이아웃을 손으로 만지면서 피드백할 수 있도록
> 클릭 가능한 정적 목업을 제공한다. 실데이터 연결·인증·DB는 없고, 하드코딩된 mock 데이터만 사용한다.
>
> **완료 기준:** 유저가 모바일 해상도에서 15개 화면을 자유롭게 오가며 "이 화면 톤 어색해"
> "이 플로우 한 단계 더 필요해" 같은 피드백을 줄 수 있는 상태.

### 🎨 디자이너 관점

- **디자인 시스템 구현:**
  - `DESIGN.md`의 전 토큰을 Tailwind 테마로 번역 (색·타이포·spacing·radius·shadow·motion)
  - Pretendard Variable(한글 primary) + CursorGothic(라틴 display) + jjannon(editorial) 폰트 로드
  - `oklab()` 경계색은 Tailwind에서 직접 지원하지 않으므로 `rgba` fallback CSS 변수로 정의
  - Dark mode는 V1 스코프에서 제외 (스펙상 명시)
- **필수 컴포넌트 팔레트 (Storybook 대용 `/design` 라우트로 검증):**
  Button(5 variant) / Card / TextField / AppBar / BottomTabBar / FAB /
  BottomSheet / Toast / Dialog / EmptyState / Skeleton(shimmer) /
  PullToRefresh indicator(정적) / SwipeAction underlay(정적) / ListRow /
  ScheduleItem card / ExpenseRow / SectionHeader
- **모바일 토큰 적용:**
  `env(safe-area-inset-*)`, `backdrop-filter: blur(8px)` on AppBar/TabBar,
  44×44pt 터치 타겟 최소 준수
- **반응형:**
  모바일 375px(iPhone 13 mini) 기준 + 1280px 데스크톱 (`/trips`, `/trips/[id]` 2개만)

### ✏️ 기획자 관점 — 화면 인벤토리 (15화면)

| # | Route | 화면명 | 목업 포함 상태 |
|---|-------|--------|---------------|
| 01 | `/` | 랜딩 | 로그인 CTA |
| 02 | `/login` | 구글 로그인 | GIS 버튼 (더미) |
| 03 | `/trips` (empty) | 여행 목록 비어 있음 | 빈 상태 + CTA |
| 04 | `/trips` (filled) | 여행 목록 | 진행중/다가오는/지난 그루핑 |
| 05 | `/trips/new` | 여행 만들기 | 폼(제목/목적지/날짜/국내여부/통화) |
| 06 | `/trips/[id]` Schedule | 일정 탭 | Day Tab + List + 접힌 지도 placeholder |
| 07 | `/trips/[id]` Schedule (지도 펼침) | 일정 + 지도 | 번호 마커 placeholder |
| 08 | `/trips/[id]` Expenses | 경비 탭 | 날짜별 집계 + 카테고리 필터 |
| 09 | `/trips/[id]` Todos | 할 일 탭 | 체크리스트 |
| 10 | `/trips/[id]` Records | 기록 탭 | 텍스트 카드 리스트 |
| 11 | `/trips/[id]` Manage | 여행 관리 | 편집/파트너공유 토글/게스트 URL/삭제 |
| 12 | `/settings` | 설정 메뉴 | 프로필·커플·카테고리 3개 entry |
| 13 | `/invite/[code]` | 초대 수락 | 초대자 프로필 + 수락 버튼 |
| 14 | `/share/[token]` | 게스트 뷰 | 읽기전용 + 하단 CTA 배너 |
| 15 | `/design` (내부) | 디자인 시스템 팔레트 | 컴포넌트/토큰 전시 (유저·팀 검증용) |

### 🧑‍💻 개발자 관점 — 구현 작업 분해

**P0.1 프로젝트 부트스트랩** (반나절)
- Node 20 pin (`.nvmrc`), pnpm 채택
- `create-next-app@latest`: App Router, TS strict, Tailwind, ESLint, src-dir off
- 폰트: Pretendard는 `@fontsource-variable/pretendard`, CursorGothic·jjannon·berkeleyMono는
  `public/fonts/`에 배치하고 `next/font/local`로 선언 (라이선스 파일 있으면 확인, 없으면 system fallback으로 한정하고 TODO 남김)
- Tailwind config: DESIGN.md 토큰 → `theme.extend` (colors, fontFamily, boxShadow, borderRadius, spacing, transitionTimingFunction)
- `app/layout.tsx`: `viewport-fit=cover`, safe-area CSS vars, 기본 폰트 스택
- ESLint + Prettier + TypeScript strict

**P0.2 디자인 시스템 컴포넌트** (1일)
- `src/components/ui/` 하위에 18개 컴포넌트 구현 (위 팔레트 목록)
- 모든 컴포넌트는 **props만 받는 순수 presentational**, 서버 통신 없음
- `app/design/page.tsx`: 각 컴포넌트의 variant를 한 페이지에 나열
- Motion은 Tailwind의 `transition` + CSS keyframes로 구현 (Framer Motion은 Phase 1에서 도입 여부 결정)

**P0.3 Mock 데이터 레이어** (반나절)
- `src/mocks/data/` 아래에 TypeScript로 하드코딩:
  `trips.ts`, `scheduleItems.ts`, `expenses.ts`, `todos.ts`, `records.ts`, `profiles.ts`, `groups.ts`, `guestShares.ts`
- 일부러 realistic한 데이터(3개 여행, 국내·해외 섞임, 진행중/다가오는/지난 각 1개씩, 경비 10개, 일정 20개)
- `getMockTripById(id)` 같은 유틸도 제공 (Phase 1에서 Supabase client로 swap 예정)

**P0.4 화면 구현** (2.5일)
- 위 15개 route 각각의 `page.tsx` 작성
- 모든 페이지는 Client Component ("use client"), mock 데이터 직접 import
- 로딩 연출: 각 페이지 진입 시 500ms `setTimeout`으로 Skeleton → 실데이터 전환(유저가 연출 체감)
- BottomSheet는 실제 열고 닫히게 구현 (Headless UI `Dialog` 또는 커스텀 `<dialog>`)
- Tab 전환은 URL 해시 또는 nested route 둘 중 하나로 일관 (App Router parallel routes 까지는 과공학, 쿼리 파라미터로 단순화)
- 데스크톱 레이아웃은 `/trips`, `/trips/[id]`에만 적용 — `md:` breakpoint로 2-column
- 게스트 뷰(`/share/[token]`)는 의도적으로 SSR처럼 보이게 `async page` + `await` 시뮬레이션 (Phase 1 전환 대비)

**P0.5 배포 & 공유** (1시간)
- Vercel preview 배포 (GitHub 연동 or `vercel --prod=false`)
- 유저에게 preview URL 공유
- README에 "목업 전용, 하드코딩 데이터, 저장 안 됨" 명시

### 📊 PM 관점

- **예상 소요:** 순수 작업시간 약 4~5일 (영업일 기준)
- **의존성:** 없음 (모든 외부 시스템 mock)
- **리스크:**
  - **R1 (중):** CursorGothic·jjannon·berkeleyMono 폰트 파일 라이선스 미확인. → system fallback으로 시작, 라이선스 확보 후 교체 or Pretendard + Inter로 대체 고려
  - **R2 (낮):** 지도 영역은 placeholder 이미지만 — 실제 Google/Naver SDK는 Phase 5 이후
  - **R3 (중):** 목업 피드백이 DESIGN.md 토큰 변경으로 이어지면 재작업 발생 → Phase 0 피드백 라운드를 **최대 2회**로 제한, 3회차 변경은 Phase 1 이후 반영
- **산출물:**
  - Vercel preview URL
  - `docs/mockup/mockup-review.md` (유저 피드백 취합 문서)
  - `docs/qa/mockup-qa.md` (수동 QA 체크리스트)
  - `/design` 라우트 (컴포넌트 팔레트)
- **Exit criteria:**
  - 유저가 모바일 화면에서 15개 라우트 자유 탐색 가능
  - 유저 피드백 문서화 완료, 반영할 항목·이월할 항목 구분

### 🧪 QA 관점

- **Phase 0 테스트 방침:** 자동화 테스트는 **제외** (mock 데이터라 의미 없음, Phase 1부터 TDD 재개).
  대신 **체크리스트 기반 수동 QA + 시각 회귀 스냅샷**으로 대체.
- **수동 QA 체크리스트 (`docs/qa/mockup-qa.md`로 관리):**
  - 15개 라우트 전수 로딩 (404/white screen 0건)
  - 각 탭 상호 이동 (Schedule↔Expenses↔Todos↔Records↔Manage)
  - BottomSheet 열기/닫기/backdrop 탭 닫기/drag handle 존재
  - Skeleton → 실콘텐츠 전환 연출 (500ms 이내)
  - Empty state 6종(trips·schedule·expenses·todos·records·group 미연결) 모두 노출 확인
  - FAB/Tab bar의 `env(safe-area-inset-bottom)` iOS Safari에서 정상
  - 버튼 press scale(0.97), hover crimson(#cf2d56) 적용
  - 44×44pt 터치 타겟 (Chrome DevTools Pointer 검사)
  - 데스크톱 1280px에서 `/trips`, `/trips/[id]` 2-column 정상
- **시각 회귀:** Playwright screenshot 15개 라우트 캡처 → `tests/visual/baseline/`에 저장.
  이후 피드백 반영 시 diff로 의도치 않은 변경 감지.
- **접근성 기본선:** axe-core DevTools 익스텐션으로 critical 위반 0건 확인.
  키보드 포커스 가시성, 버튼 aria-label, form 라벨 연결.
- **디바이스 매트릭스:** iPhone 13 mini(375×812), iPhone 14 Pro Max(430×932),
  iPad mini(768×1024), Desktop(1280×800) Chrome + Safari
- **Exit criteria 추가:**
  - 수동 QA 체크리스트 100% 통과
  - Lighthouse mobile Accessibility ≥ 95
  - 시각 회귀 baseline 15장 저장

### 🔒 보안 관점

- **Phase 0의 보안 원칙: "실데이터·실 크리덴셜 유입 차단"**
  - mock 데이터에 실제 이메일·이름·좌표·결제정보 금지 (가공 데이터만, 예: `trip_01@example.com`)
  - Supabase URL/anon key 환경변수는 **이 Phase에서는 배치하지 않음** (Phase 1에서 추가)
  - `.env.local`에 API key 실수 주입 방지 — `.env.example`만 커밋, `.gitignore` 검증
  - Google GIS 클라이언트 ID도 **더미값** (`PHASE0_PLACEHOLDER`), 실제 로그인 시도 불가능하게 차단
- **목업 단계 공격 표면:**
  - 목업은 정적 Vercel preview지만 **preview URL이 검색엔진 인덱싱되지 않도록** `robots.txt` + 응답 헤더 `X-Robots-Tag: noindex, nofollow` + `next.config.mjs`에 헤더 설정
  - Preview URL은 **이해관계자에게만 공유**, public SNS 공개 금지 (내부 리뷰용)
- **목업에서 검증할 보안-관련 UX (정적으로라도 반드시 노출):**
  - 여행 삭제 확인 다이얼로그 — "파트너의 데이터도 함께 삭제됩니다" 메시지 (스펙 준수)
  - 커플 해제 확인 다이얼로그 — "파트너가 더 이상 접근할 수 없습니다"
  - 게스트 뷰(`/share/[token]`)에서 **노출되지 않아야 할 필드가 목업에서도 숨겨져 있는지** 확인
    (이메일, paid_by 유저 ID, 기타 PII) — 디자이너/개발자가 실수로 넣지 않게 Phase 0부터 패턴 확립
  - 초대 링크 목업도 code는 더미(`INVITE-DEMO-CODE`)로만 노출, 실 UUID 포맷 암시 금지
- **의존성 보안:**
  - `pnpm audit` 실행, high/critical 취약점 0건 유지
  - `package.json`에 설치할 라이브러리는 주요 OSS(downloads ≥ 50k/week)로 제한,
    낯선 소규모 npm 패키지 금지 (supply chain 방어)
- **콘텐츠 보안:**
  - `next.config.mjs`에 기본 CSP 헤더 (`default-src 'self'`, 폰트/이미지 예외),
    inline script/style 금지 — Phase 1에서 Supabase·Maps 도메인 추가 예정
- **Exit criteria 추가:**
  - `.env.local` 누출 스캔(`git log -p | grep -i key`) 깨끗
  - robots.txt + noindex 헤더 적용 확인
  - `pnpm audit` high/critical 0건
  - CSP 헤더 설정 + 브라우저 콘솔 violation 0건

---

### 🚀 Phase 0 착수 순서 (이번 세션)

> 이 순서대로 진행한다. 각 단계는 커밋 단위로 끊고, 단계 완료 시 유저에게 확인받는다.

**Step 1 — 부트스트랩 (P0.1)**
1. Node 20 `.nvmrc` 생성, pnpm 세팅
2. `pnpm create next-app@latest . --typescript --app --tailwind --eslint --no-src-dir --import-alias "@/*"`
3. Prettier + TypeScript strict 설정
4. `.env.example` 생성(placeholder 키만), `.gitignore`에 `.env.local` 확인
5. `next.config.mjs`에 `noindex` 헤더 + 기본 CSP
6. `app/layout.tsx`에 Pretendard 폰트 로드 + safe-area CSS vars
7. `pnpm dev` 동작 확인 → 커밋

**Step 2 — 디자인 토큰 이식 (P0.1 후반)**
1. `DESIGN.md` 토큰을 `tailwind.config.ts` `theme.extend`로 번역
2. `app/globals.css`에 CSS 변수(색·spacing·shadow) 정의
3. CursorGothic·jjannon·berkeleyMono는 라이선스 확인 전까지 fallback 사용, TODO 주석
4. `/design` 라우트 스켈레톤 페이지 만들고 토큰 색상 칩만 렌더 → 커밋

**Step 3 — UI 컴포넌트 팔레트 (P0.2)**
1. `src/components/ui/` 에 18개 컴포넌트 순차 구현
   (Button → Card → TextField → AppBar → BottomTabBar → FAB → BottomSheet →
    Toast → Dialog → EmptyState → Skeleton → PullToRefresh → SwipeAction →
    ListRow → ScheduleItem → ExpenseRow → SectionHeader)
2. 각 컴포넌트는 `/design` 페이지에 variant 전시
3. BottomSheet는 Headless UI `Dialog` 사용, 열림/닫힘 실동작
4. 컴포넌트 3~4개 단위로 커밋

**Step 4 — Mock 데이터 (P0.3)**
1. `src/mocks/data/` 에 TS 파일 작성 (trips·scheduleItems·expenses·todos·records·profiles·groups·guestShares)
2. 가공 이메일·좌표·UUID 사용 (보안 원칙 준수)
3. `getMockTripById(id)` 같은 유틸 추가 → 커밋

**Step 5 — 15개 화면 구현 (P0.4)**
1. 라우트 순서: `/` → `/login` → `/trips`(empty·filled) → `/trips/new` →
   `/trips/[id]/*`(5탭) → `/settings` → `/invite/[code]` → `/share/[token]`
2. 각 페이지 진입 시 500ms setTimeout skeleton 연출
3. 탭 전환은 쿼리 파라미터 (`?tab=schedule`) 단순 구조
4. 데스크톱 레이아웃은 `/trips`, `/trips/[id]` 2개만 `md:` breakpoint
5. 화면 3~4개 단위로 커밋

**Step 6 — 배포 & 공유 (P0.5)**
1. GitHub 저장소 생성, Vercel 프로젝트 연결
2. Preview 배포 + `X-Robots-Tag: noindex` 최종 확인
3. `docs/mockup/mockup-review.md` 템플릿 생성(피드백 수집용)
4. `docs/qa/mockup-qa.md` 템플릿 생성(QA 체크리스트)
5. Preview URL 유저에게 공유 → 피드백 라운드 시작

**Step 7 — 피드백 정리 & Phase 1 전환**
1. 피드백 항목을 `docs/mockup/mockup-review.md`에 분류(즉시반영·Phase1이월·V2이월)
2. 스펙·DESIGN.md·본 plan 필요 부분 업데이트
3. 위키 세션 로그 작성

---

## Phase 0 이후 (초안, 피드백 후 조정 가능)

> ⚠️ 아래 Phase는 **Phase 0 피드백 결과에 따라 재구성될 수 있다.**
> 톤·플로우·정보구조 피드백은 DESIGN.md / 스펙 업데이트로 돌아가고,
> 영향받는 Phase는 재작성한다. 본 초안은 스펙 §9 구현 순서를 기준으로 한다.

### Phase 1 — Foundation & Auth
- Supabase 프로젝트 생성, 환경 변수 설정
- Google GIS + `signInWithIdToken` (ADR: Supabase OAuth rate limit 회피)
- `profiles` 테이블 + auto-create trigger, RLS
  - `color` 컬럼(6색 팔레트, default 'orange') 포함 — `/settings` 프로필 편집에서 선택 (Step 7 피드백 #5 V1 구현본)
  - `lib/profile-colors.ts` 하드코딩 매핑을 `profile.color` 조회로 교체
- TanStack Query provider, Zustand store, Realtime client scaffold
- 로그인 → `/trips` 진입 flow 실동작
- **관점별 체크:** 🧑‍💻 auth 토큰 세션 관리 안정성 / 📊 rate limit monitoring / 🎨 로그인 화면 목업 그대로 유지 / ✏️ 로그인 실패 시 에러 흐름 확인 / 🧪 GIS 모킹(msw)으로 로그인 성공·실패·취소 3케이스 자동 테스트 / 🔒 JWT 저장 위치(httpOnly cookie 우선, localStorage 금지), CSRF 방어, GIS client ID·Supabase key 환경변수 관리

### Phase 2 — DB Schema & RLS
- 10개 테이블 전체 migration (`supabase/migrations/`)
- RLS policies (trip access = `created_by OR group_id IN active group`)
- `resize_trip_days` RPC (SECURITY INVOKER, 트랜잭션)
- `get_guest_trip_data` RPC (SECURITY DEFINER, 5단계 검증 순서)
- TypeScript 타입 자동 생성 (`supabase gen types`)
- **관점별 체크:** 🧑‍💻 migration 롤백 가능 / 📊 스키마 변경 영향도 기록 / 🎨 — / ✏️ 기능 접근 흐름 검증 / 🧪 RLS 정책 테스트(pgTAP or Supabase test helpers)로 "내 trip만 보임", "파트너 trip 보임", "타인 trip 불가" 케이스 자동화 / 🔒 SECURITY DEFINER 함수의 search_path 고정, `get_guest_trip_data` 파라미터 바인딩 검증, RLS 우회 경로 0건, PII 컬럼(email) RLS 컬럼 레벨 제한

### Phase 3 — Trips / Trip Days CRUD
- `/trips` 목록 (그루핑: 진행중/다가오는/지난)
- `/trips/new` 폼 + 검증 (Zod)
- `/trips/[id]` 읽기, Manage 탭 편집/삭제
- trip_days 자동 bulk insert
- 날짜 축소 시 confirm dialog (resize_trip_days RPC 호출)
- **관점별 체크:** 🧑‍💻 optimistic update + rollback / 📊 날짜 축소 사용률 metric hook / 🎨 빈 상태·스켈레톤 DESIGN.md 준수 / ✏️ empty → first-trip flow 체크 / 🧪 trips CRUD E2E(Playwright) + RPC 트랜잭션 롤백 유닛 테스트 + 날짜 축소 시 schedule_items 이동 정확성 시나리오 테스트 / 🔒 입력 검증(Zod): XSS 스크립트 제목·SQL 특수문자 제출 차단, trips.created_by 위변조 불가 확인(RLS), 삭제 RPC는 소유자 only

### Phase 4 — Schedule Tab (복잡도 최고)
- Day Tab + List + Map split
- Google Maps SDK (해외) / Naver Maps SDK (국내) lazy load
- Place 검색, 번호 마커, 리스트↔지도 스크롤 동기화
- 드래그앤드롭 reorder (same-day first, cross-day V1.1로 미룰 수 있음)
- Realtime 변경 invalidate
- **관점별 체크:** 🧑‍💻 지도 SDK 번들 분리 / 📊 지도 API 비용 추정 / 🎨 카테고리 컬러 일관성 / ✏️ 드래그 실패 시 복구 플로우 / 🧪 드래그 reorder E2E + 동시 편집(last-write-wins) 시나리오 + Place 검색 mocking / 🔒 Map API key 도메인·HTTP referrer 제한(Google Cloud Console, Naver Cloud), 키 노출 방지, Place 검색 결과 XSS(HTML 주입) sanitize

### Phase 5 — Expenses / Todos / Records
- Expenses: 날짜별/카테고리별 집계, 카테고리 필터, expense_date 독립
- Todos: 완료/미완료 정렬, assigned_to
- Records: 텍스트 전용 (V1), 날짜 UI 제한
- BottomSheet 기반 CRUD 통일
- **관점별 체크:** 🧑‍💻 환율 없이 통화별 별도 합계 / 📊 카테고리 사용 분포 / 🎨 통화 뱃지 디자인 / ✏️ 경비 바로가기(일정→경비 프리필) 검증 / 🧪 집계 유닛테스트(date × currency × category 매트릭스) + expense_date 트립 범위 외 입력 UI 차단 E2E + Todo 정렬 안정성 / 🔒 amount numeric overflow·음수 금지, paid_by에 그룹 외 유저 ID 주입 차단(RLS), records.content XSS sanitize(렌더 시 `DOMPurify` or 텍스트-only 렌더)

### Phase 6 — Groups / Partner Connection
- Invite code 생성 · 수락 flow (`/invite/[code]`)
- `group_members`, groups.status 전이
- Partner share 토글 (Manage 탭), 기본값 규칙 (새 여행 ON, 기존 OFF)
- 커플 해제: 생성자 유지, 파트너 접근 차단, profiles RLS로 display_name은 계속 보임
- 카테고리 migration (개인 → 그룹, 그룹 해제 시 개인 복귀)
- **관점별 체크:** 🧑‍💻 동시 초대 링크 무효화 / 📊 invite → connect 전환율 / 🎨 초대 화면 톤 / ✏️ 해제 후 데이터 흐름 경고 메시지 / 🧪 초대 수락 E2E(정상·만료·타그룹 소속·이미 수락) + 파트너 공유 토글 ON/OFF 시 RLS 반영 즉시성 / 🔒 invite_code는 암호학적 난수(UUIDv4 or 16바이트 nonce), 일회성 사용 후 무효화, 초대 수락 시 그룹 max_members 서버 측 재검증, 커플 해제 시 파트너 RLS 즉시 끊김 확인, 카테고리 migration 원자성(트랜잭션)

### Phase 7 — Guest Share & Security
- `/share/[token]` SSR (RPC 기반)
- `guest_shares` CRUD + toggle UI
- Vercel Edge Middleware: rate limit (`/invite` 10/min, `/share` 30/min, 인증 API 60/min)
- RPC 보안 회귀 테스트 (만료·비활성·잘못된 토큰)
- OG 태그, 게스트 CTA 배너
- **관점별 체크:** 🧑‍💻 middleware cold start / 📊 게스트 뷰 PV / 🎨 읽기전용 시각 구분 / ✏️ 링크 복사 UX / 🧪 게스트 RPC 회귀 테스트 풀세트(유효/만료/비활성/잘못된 토큰/show_* 플래그 조합) + rate limit 임계 돌파 시 429 E2E / 🔒 **이 Phase는 OWASP Top 10 전수 점검 대상** — token 타이밍 공격 방어(constant-time compare), RPC가 token 존재 누설하지 않음(항상 NULL 반환), PII 필드(email·paid_by 유저 ID) 게스트 페이로드에서 완전 제거, 게스트 URL crawler·bot 인덱싱 차단(`noindex`), guest_shares.expires_at 타임존 일관성, Edge Middleware rate limit 우회(IP spoofing X-Forwarded-For 신뢰 체인) 검증

### Phase 8 — PWA & Polish
- Workbox shell pre-cache (인증 페이지 shell)
- Manifest, 아이콘, 설치 프롬프트
- Empty state·Toast·Error 패턴 전면 적용 점검
- 성능 측정 (Lighthouse, CLS=0 검증)
- **관점별 체크:** 🧑‍💻 workbox 업데이트 전략 / 📊 설치율 / 🎨 스플래시·아이콘 / ✏️ 오프라인 안내 배너 / 🧪 Lighthouse CI로 PR마다 Performance ≥90·Accessibility ≥95 자동 게이트, 시각 회귀 baseline 갱신, axe-core CI 통합 / 🔒 Service Worker scope 최소화(`/`만), 캐시에 인증 응답 저장 금지(Authorization 헤더 요청 제외), CSP 최종화(Supabase·Maps·폰트 도메인만 allowlist), `Strict-Transport-Security`·`X-Content-Type-Options`·`Referrer-Policy` 설정, manifest에 민감 URL 노출 X

### Phase 9 — QA & Deploy
- E2E 시나리오 10개 (Playwright): 로그인, 여행 생성, 일정 추가, 경비 집계, 커플 연결, 게스트 링크, 날짜 축소, 삭제, 파트너 공유 토글, 로그아웃
- Unit test: RPC 래퍼, 집계 로직, 날짜 유틸 (80%+ coverage per user rules)
- Vercel production 배포 (도메인 연결)
- Supabase prod project + RLS 회귀
- **관점별 체크:** 🧑‍💻 배포 rollback 계획 / 📊 런칭 metric dashboard / 🎨 실제 도메인에서 폰트 로딩 / ✏️ 핵심 플로우 실사용 검증 / 🧪 E2E 10 시나리오 통과 + 유닛 커버리지 80%+ 게이트 + smoke test prod 배포 후 자동 실행 + 접근성 회귀 + 시각 회귀 / 🔒 **런칭 전 보안 최종 점검**: `pnpm audit` high/critical 0, OWASP ZAP 기본 스캔, secrets 스캔(gitleaks), Vercel 환경변수에 prod/preview 분리, Supabase prod Service Role key는 서버에서만, 로그에 PII 마스킹, 4xx/5xx 에러 응답에 stack trace·DB 정보 누출 X, 실제 도메인 HTTPS·HSTS preload 적용

---

## 수정된 Phase 가능성 (유저 피드백 시나리오)

| 피드백 유형 | 영향 Phase | 대응 |
|------------|-----------|------|
| 톤·색 수정 | DESIGN.md 업데이트 → Phase 0 P0.2 재실행 | Tailwind theme만 변경, 컴포넌트 구조 유지 |
| 화면 레이아웃 변경 (예: 지도 위치) | Phase 0 P0.4 재작업 + Phase 4 영향 | 목업 재배포 |
| 플로우 변경 (예: 초대 3단계 → 2단계) | 스펙 §3 업데이트 + Phase 6 재설계 | ADR 추가 기록 |
| 화면 추가·삭제 | Phase 0 화면 목록 조정 | 영향 Phase 재분해 |
| 기능 추가 (V2→V1 승격) | 스펙 §2 업데이트 | Phase 순서 재배치 |

---

## Critical Files (Phase 0에서 건드릴 파일)

**생성:**
- `/Users/sh/Library/CloudStorage/SynologyDrive-home/1.Projects/Apps/travel-manager/package.json`
- `.../pnpm-lock.yaml`, `.nvmrc`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`
- `.../app/layout.tsx`, `.../app/page.tsx`, `.../app/design/page.tsx`
- `.../app/login/page.tsx`, `.../app/trips/page.tsx`, `.../app/trips/new/page.tsx`
- `.../app/trips/[id]/layout.tsx` + 5 tab pages
- `.../app/settings/page.tsx`, `.../app/invite/[code]/page.tsx`, `.../app/share/[token]/page.tsx`
- `.../src/components/ui/*` (18 컴포넌트)
- `.../src/mocks/data/*` (mock data)
- `.../public/fonts/` (라이선스 확보 폰트만)
- `.../docs/mockup/mockup-review.md` (유저 피드백 기록)
- `.../docs/qa/mockup-qa.md` (QA 체크리스트)
- `.../docs/plans/2026-04-17-implementation-plan.md` (본 plan의 공식 사본)

**참조 (읽기):**
- `.../DESIGN.md` (410줄) — 토큰 원본
- `.../docs/superpowers/specs/2026-04-16-travel-manager-design.md` — 스펙 원본
- `/Users/sh/Library/CloudStorage/SynologyDrive-home/앱/MY_AI_WIKI/projects/travel-manager/decisions/*` — ADR 5개

**재사용 가능한 기존 자산:**
- `.superpowers/brainstorm/92348-1776316083/content/schedule-view.html` — 일정 탭 레이아웃 참고
- `.superpowers/brainstorm/92348-1776316083/content/schedule-interactions.html` — 드래그 인터랙션 연출 참고

---

## Verification (Phase 0 완료 확인)

1. `pnpm dev` → 로컬 3000 포트에서 15개 라우트 모두 로드 (404 없음)
2. `pnpm build` → 타입 에러·ESLint 에러 0
3. `/design` 페이지에서 모든 컴포넌트 렌더 확인
4. Chrome DevTools device mode (iPhone 13 mini)에서 전 화면 스크롤·탭·BottomSheet 동작
5. Vercel preview 배포 URL이 유저 접근 가능
6. Lighthouse mobile score: Performance ≥ 80, Accessibility ≥ 95
7. 유저가 preview URL을 열고 "전체 15화면 확인 완료" 서면 피드백 제공
8. 피드백 항목은 `docs/mockup/mockup-review.md`에 기록하고, 반영 범위에 따라 이 plan 파일(`docs/plans/2026-04-17-implementation-plan.md`) 또는 스펙을 업데이트한 뒤 Phase 1 진입

---

## 비고

- **위키 반영:** Phase 0 완료 후 `sessions/YYYY-MM-DD-phase0-mockup.md` + `status.md` 업데이트
- **ADR 필요 가능성:** 폰트 대체(사설 → 오픈소스), 상태관리 세부, BottomSheet 라이브러리 선택은 Phase 1 초입에 결정
- **테스트 전략:** Phase 0에서는 E2E·유닛 테스트 제외 (mock이라 의미 없음). Phase 1부터 TDD 재개
