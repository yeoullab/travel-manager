---
type: design-spec
project: travel-manager
date: 2026-04-20
status: current (Phase 1·2 implemented, Phase 3+ planned)
author: AI + human collaborative design
supersedes: docs/superpowers/specs/2026-04-16-travel-manager-design.md
merges: docs/specs/2026-04-19-phase2-trip-core-design.md
---

# travel-manager Design Spec (Updated 2026-04-20)

> 2026-04-16 최초 스펙을 기준으로, Phase 1(인증·프로필) 및 Phase 2(groups·trips·Realtime) 실행 과정에서
> 결정·변경된 사항을 모두 반영한 **현행화** 문서. 구현 상태가 "implemented" 인 항목은 코드·마이그레이션에
> 실재하며, "planned" 는 Phase 3+ 설계 대상. Phase 2 Design Spec (`2026-04-19-phase2-trip-core-design.md`) 의
> 결정은 이 문서에 흡수되었으며 원본은 이력 참조용으로 유지.

---

## 0. Implementation Status (2026-04-20 기준)

| Phase | Scope | 상태 | Git tag |
|---|---|---|---|
| Phase 0 | 목업 (15 화면) + 디자인 시스템 토큰 + 공통 컴포넌트 | ✅ Complete | — |
| Phase 1 | Google 로그인(GIS + signInWithIdToken) + `profiles` + middleware + color palette | ✅ Complete | `phase-1-foundation-auth` |
| Phase 2 | `groups`·`group_members`·`trips`·`trip_days` + 6 RPC + Realtime (3 채널) + `/trips/*`·`/settings/*`·`/invite/[code]` 실 DB 연결 | ✅ Complete | `phase-2-trip-core` |
| Phase 3 | `schedule_items` + `trip_days` 활용 일정 탭 + 지도 API + 드래그앤드롭 + E2E 자동화 복귀 | ⏳ Planned | — |
| Phase 4 | `expenses` + `categories` + 통화별 합계 + 일정↔경비 연동 | ⏳ Planned | — |
| Phase 5 | `todos` + `records` | ⏳ Planned | — |
| Phase 6 | `guest_shares` + `/share/[token]` SSR + CTA 배너 | ⏳ Planned | — |
| Phase 7 | Realtime 전면 확장 (schedule/expenses/todos) + 충돌 병합 | ⏳ Planned | — |
| Phase 8 | PWA (Workbox 쉘 프리캐시) + 마이크로 인터랙션 폴리시 | ⏳ Planned | — |

현재 main HEAD: `0c710a2` (2026-04-20). tsc 0 · lint 0 errors · unit 22/22 · integration 36/36 · build 12 routes · manual E2E 5/5 PASS.

---

## 1. Overview

### Purpose

커플이 함께 여행을 계획하고 경비·기록을 관리하는 모바일 퍼스트 웹앱 (PWA).

### User Types

| Type | Description | Auth |
|------|-------------|------|
| Owner | 여행 생성자 | Google 로그인 |
| Partner | 초대 코드로 연결된 파트너 | Google 로그인 |
| Guest | 공유 URL로 조회만 | 인증 없음 (토큰 기반) |

### Tech Stack

| Area | Technology | Status |
|------|-----------|--------|
| Framework | **Next.js 16 App Router** (Turbopack) | implemented |
| Backend | Supabase (PostgreSQL + Realtime) | implemented |
| Auth | Google Identity Services (GIS) + Supabase `signInWithIdToken` (hex SHA-256 nonce) | implemented |
| Server Data | TanStack Query | implemented |
| UI State | Zustand | implemented |
| Style | Tailwind CSS + CSS Modules | implemented |
| Font | Pretendard Variable | implemented |
| Type gen | `@supabase/ssr` + `pnpm db:types` (PostgrestVersion "12" workaround 적용) | implemented |
| Deploy | Vercel | implemented (preview) |
| Maps | Google Maps (해외) + Naver/Kakao (국내) — **ADR 대기** | planned (Phase 3) |

**중요 변경(Phase 1):**
- Google OAuth 은 Supabase `signInWithOAuth` 대신 GIS → `signInWithIdToken`. 이유: Supabase OAuth 시간당 2회 rate limit 우회. nonce 는 **hex SHA-256** (base64url 아님).
- CSP `connect-src` 는 scheme-strict — Supabase Realtime 을 위해 `https://` + **`wss://`** 둘 다 명시 필수.

---

## 2. Scope

### In Scope (V1)

| Feature | Status | Phase |
|---------|--------|-------|
| 인증 | ✅ | Phase 1 |
| 프로필 color 팔레트 (6색) | ✅ | Phase 1 |
| 그룹 연결 (V1: 2인 커플) | ✅ | Phase 2 |
| 여행 CRUD + 파트너 공유 토글 | ✅ | Phase 2 |
| 실시간 동기 (trips/group_members/groups 3 채널) | ✅ | Phase 2 |
| 일정 관리 (List + Map, 드래그앤드롭) | ⏳ | Phase 3 |
| 경비 관리 (날짜별·통화별·카테고리) | ⏳ | Phase 4 |
| Todo | ⏳ | Phase 5 |
| 기록 (텍스트) | ⏳ | Phase 5 |
| 게스트 공유 URL (SSR) | ⏳ | Phase 6 |
| 멤버 관리 (display_name) | ✅ | Phase 2 |
| 카테고리 관리 (기본 + 커스텀) | ⏳ | Phase 4 |
| 지도 연동 | ⏳ | Phase 3 |
| PWA | ⏳ | Phase 8 |

### Out of Scope (V1)

- 오프라인 지원, 카카오 로그인, 환율 변환, 사진/미디어 첨부, 네이티브 앱

### V2 후보

- 게스트 접근 로그, 인앱 Activity Feed / Push 알림, 여행 목록 검색, 데이터 내보내기 (CSV/PDF), Day Tab 드래그로 일정 이동

---

## 3. Architecture

### Rendering Strategy — Route-Based

| Route | Rendering | Reason |
|-------|-----------|--------|
| `/`, `/login` | Static (SSG) | 동적 데이터 없음 |
| `/trips`, `/trips/*` | Skeleton → Client fetch | 인증 필요, 빠른 쉘 |
| `/settings/*` | Skeleton → Client fetch | 인증 필요 |
| `/invite/[code]` | Skeleton → Client fetch (metadata 는 `layout.tsx` 에서 server export) | 인증 필요 + `referrer: 'no-referrer'` |
| `/share/[token]` | SSR | OG 태그, 링크 프리뷰 (Phase 6) |

### Shell-First Principle

```
[1] 앱 쉘 즉시 렌더 (Skeleton or PWA 프리캐시)
 ↓
[2] 클라이언트에서 TanStack Query 로 fetch
 ↓
[3] TanStack 캐시 (탭 이동 시 재사용, persistQueryClient)
 ↓
[4] Supabase Realtime 구독으로 실시간 갱신
```

### State Management

| Layer | Tool | Purpose |
|-------|------|---------|
| Server Data | TanStack Query | CRUD, 캐싱, optimistic updates |
| Realtime | Supabase Realtime | 파트너 간 변경 즉시 반영 |
| UI State | Zustand (`useUiStore`) | 활성 탭, 지도 토글, 드래그 상태, flash toast |

### Code Splitting

- 여행 상세의 비활성 탭은 `next/dynamic` lazy load
- 모달/피커류는 상호작용 시점에 로드
- 지도 SDK 는 일정 탭 진입 시에만 로드 (Phase 3)

### Rate Limiting

Vercel Edge Middleware 로 API rate limit (Phase 2+ 준비, 실 적용 Phase 8 전):

| 대상 | 정책 |
|------|------|
| `/invite/[code]` | IP당 분당 10회 |
| `/share/[token]` | IP당 분당 30회 |
| CRUD API 전체 | 유저당 분당 60회 |
| Google OAuth | Supabase 기본 제한에 위임 |

### Session Management

- Supabase 기본 JWT (access 1h, refresh 자동). GIS + `signInWithIdToken` 이므로 세션은 Supabase 위임.

---

## 4. Data Model

### ER Diagram

```
profiles (from auth.users trigger)                     [Phase 1 ✅]
  │
  ├─── groups                                          [Phase 2 ✅]
  │       │
  │       ├─── group_members                           [Phase 2 ✅]
  │       │
  │       └─── trips                                   [Phase 2 ✅]
  │              │
  │              ├─── trip_days                        [Phase 2 ✅]
  │              │       └─── schedule_items           [Phase 3 ⏳]
  │              │
  │              ├─── expenses (독립 날짜)              [Phase 4 ⏳]
  │              ├─── todos                            [Phase 5 ⏳]
  │              ├─── records                          [Phase 5 ⏳]
  │              └─── guest_shares                     [Phase 6 ⏳]
  │
  └─── categories (default + custom)                   [Phase 4 ⏳]
```

### Migration files (Phase 2 시점)

| 파일 | 내용 |
|---|---|
| `0001_profiles.sql` | profiles + color CHECK + RLS + view + trigger (auth.users → profiles 자동 생성) |
| `0002_groups.sql` | groups + group_members + RLS + 인덱스 + 트리거 (`check_active_group_uniqueness`, `enforce_group_status_transition`, `on_group_dissolved`) + RPC (`create_invite`, `accept_invite`, `cancel_invite`, `dissolve_group`) + `profiles.display_name` 길이 CHECK |
| `0003_trips.sql` | trips + trip_days + RLS + 인덱스 + CHECK + 트리거 (`trips_set_updated_at`) + Helper (`can_access_trip`) + RPC (`create_trip`, `resize_trip_days`) + Realtime publication (profiles 제거, trips/group_members/groups 추가) |
| `0004_fix_group_members_rls.sql` | `group_members` RLS 무한 재귀 fix. `is_group_member(group_id, user_id)` SECURITY DEFINER helper 도입. `create_trip`·`resize_trip_days` 를 SECURITY INVOKER → **SECURITY DEFINER** 로 변경 (group_members 접근 시 RLS 재귀 회피). `query_publication_tables()` RPC 신규 (integration audit 용) |

### Tables

#### profiles  [Phase 1 ✅]

Auth 회원가입 시 trigger 로 자동 생성.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, FK → auth.users |
| email | text | NOT NULL (본인만 SELECT 가능 — view 로 노출 제어) |
| display_name | text | nullable, **CHECK (char_length ≤ 40)** |
| avatar_url | text | nullable |
| color | text | NOT NULL, CHECK (color IN ('orange','blue','gold','violet','green','rose')), default 'orange' |
| created_at | timestamptz | NOT NULL, default now() |

색상 팔레트 — DESIGN.md 토큰과 1:1 매핑 (ADR-007):

| color | token | 용도 |
|---|---|---|
| orange | `--color-accent-orange` (#F54E00) | 결제자·담당자 칩. 기본값 |
| blue | `--color-ti-read` (#9FBBE0) | |
| gold | `--color-accent-gold` (#C08532) | |
| violet | `--color-ti-edit` (#C0A8DD) | |
| green | `--color-ti-grep` (#9FC9A2) | |
| rose | `--color-ti-thinking` (#DFA88F) | |

**Public view — `profiles_public`**: email 을 제외한 display_name/avatar_url/color 만 인증 유저에게 노출. 앱 UI 는 본인 profile 은 직접, 타인은 `profiles_public` 경유.

#### groups  [Phase 2 ✅]

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK default gen_random_uuid() |
| invite_code | uuid | UNIQUE NOT NULL default gen_random_uuid() |
| status | text | NOT NULL CHECK (status IN (**'pending','active','cancelled','dissolved'**)) |
| max_members | int | NOT NULL default 2 |
| created_by | uuid | FK profiles(id) NOT NULL |
| created_at | timestamptz | NOT NULL default now() |

**`name` 컬럼 제거** — 최초 스펙의 `name text nullable` 은 실제로 미사용. V1 커플 전용이며 UI 는 정적 문자열(`"파트너와 연결됨"`) 로 처리. V2 에서 그룹 확장 시 재도입.

**상태 4개** (`pending / active / cancelled / dissolved`):
- `pending`: owner 가 초대 링크 생성, 미수락
- `active`: partner 수락 → 2인 연결
- `cancelled`: owner 가 pending 상태에서 `cancel_invite` RPC 호출
- `dissolved`: active 상태에서 owner 가 `dissolve_group` RPC 호출

`cancelled` / `dissolved` 구분 이유: dissolve 는 trips fanout(group_id→NULL) 발화하지만 cancel 은 active 된 적이 없어 fanout 불필요. 감사성 확보.

**인덱스:**
```sql
create index idx_groups_invite on groups(invite_code) where status = 'pending';
```

**보안 — `invite_code` 컬럼 노출 제어:**
- `groups` 테이블 직접 SELECT 에선 `invite_code` 제외 (GRANT 또는 policy)
- 생성자 전용 view `groups_with_invite` (security_invoker) 로 노출

#### group_members  [Phase 2 ✅]

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK default gen_random_uuid() |
| group_id | uuid | FK groups(id) ON DELETE CASCADE NOT NULL |
| user_id | uuid | FK profiles(id) NOT NULL |
| role | text | NOT NULL CHECK (role IN ('owner','member')) |
| joined_at | timestamptz | NOT NULL default now() |

**유일성:**
```sql
unique (group_id, user_id);
create index idx_group_members_user on group_members(user_id);
create index idx_group_members_group on group_members(group_id);
```

**유저당 active 그룹 1개 제약** — partial unique index 가 서브쿼리 WHERE 를 허용하지 않으므로 **트리거** `check_active_group_uniqueness` BEFORE INSERT 로 대체.

**Group dissolution — trigger `on_group_dissolved` AFTER UPDATE:**
- `old.status='active' AND new.status='dissolved'` 시: `trips.group_id = new.id` → `NULL` fanout
- Phase 4 에서 `categories.group_id → NULL` 도 여기에 추가

**Status transition 강제 — trigger `enforce_group_status_transition` BEFORE UPDATE:**
- pending → active / cancelled ✓
- active → dissolved ✓
- cancelled / dissolved → * ✗ (revive 불가)

#### trips  [Phase 2 ✅]

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK default gen_random_uuid() |
| group_id | uuid | FK groups(id) ON DELETE SET NULL nullable (null=개인 여행) |
| created_by | uuid | FK profiles(id) NOT NULL |
| title | text | NOT NULL, **CHECK (char_length BETWEEN 1 AND 100)** |
| destination | text | NOT NULL, **CHECK (char_length BETWEEN 1 AND 100)** |
| start_date | date | NOT NULL |
| end_date | date | NOT NULL, **CHECK (end_date >= start_date)** |
| is_domestic | boolean | NOT NULL default true |
| currencies | text[] | NOT NULL default '{}', **CHECK (array_length ≤ 5)** |
| created_at | timestamptz | NOT NULL default now() |
| updated_at | timestamptz | NOT NULL default now() (trigger `trips_set_updated_at` 자동 갱신) |

**기간 캡:** `CHECK (end_date - start_date <= 90)` — DoS 방어 + trip_days bulk INSERT 입력 제한.

**통화 상수:** `lib/trip/constants.ts::TRIP_CURRENCIES` 에 정의 (UI 옵션 소스).

**파트너 공유 토글:**
- ON: `group_id` = owner 의 active group
- OFF: `group_id` = NULL
- 생성 시 active group 있으면 자동 ON (`create_trip` RPC 가 fanout)
- Owner 만 토글. Partner 측 UI 는 disabled + tooltip
- OFF 전환 시 inline 확인 ("파트너가 이 여행을 더 이상 볼 수 없게 됩니다")

```sql
create index idx_trips_created_by on trips(created_by);
create index idx_trips_group on trips(group_id);
```

#### trip_days  [Phase 2 ✅]

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK default gen_random_uuid() |
| trip_id | uuid | FK trips(id) ON DELETE CASCADE NOT NULL |
| day_number | int | NOT NULL |
| date | date | NOT NULL |

```sql
unique (trip_id, day_number);
create index idx_trip_days_trip on trip_days(trip_id);
```

Phase 2 에선 `schedule_items` 없으므로 날짜 컨테이너 역할만. `create_trip` 이 bulk INSERT, `resize_trip_days` 가 DELETE+INSERT 로 atomic 재구성.

**Phase 3 확장 지점:** `resize_trip_days` 의 body 가 축소 시 삭제 대상 day 의 `schedule_items` 를 last-kept day 로 재배치. 시그니처·호출부 불변.

#### schedule_items  [Phase 3 ⏳]

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| trip_day_id | uuid | FK → trip_days ON DELETE CASCADE, NOT NULL |
| title | text | NOT NULL |
| category_id | uuid | FK → categories, nullable |
| time | time | nullable |
| order | int | NOT NULL |
| place_name, place_address | text | nullable |
| place_lat, place_lng | double precision | nullable |
| map_provider | text | CHECK ('google','naver','kakao') (Phase 3 ADR 결정) |
| memo, url | text | nullable (url: https?:// 스킴만 허용, UI 검증) |
| created_at, updated_at | timestamptz | |

Drag & drop: 같은 날 내 order 재배치 / 다른 날 trip_day_id 변경 + order 재배치. Optimistic + last-write-wins.

#### expenses  [Phase 4 ⏳]

trip_days 와 독립 — 실제 지출 날짜 `expense_date` 를 직접 기록.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| trip_id | uuid | FK → trips ON DELETE CASCADE |
| expense_date | date | NOT NULL |
| title | text | NOT NULL |
| amount | decimal(12,2) | NOT NULL |
| currency | text | NOT NULL, default 'KRW' |
| category_id | uuid | FK → categories, nullable |
| paid_by | uuid | FK → profiles, nullable |
| schedule_item_id | uuid | FK → schedule_items ON DELETE SET NULL, nullable (일정 삭제 시 경비는 유지) |
| memo | text | nullable |

집계: 일별/통화별/카테고리별 합계. 환율 변환 없음.
일정 ↔ 경비 연동: 일정 상세 "경비 추가" · 경비 상세 연결된 일정명 + 해제.

#### todos · records · guest_shares · categories

최초 스펙 유지. 세부는 `docs/superpowers/specs/2026-04-16-travel-manager-design.md` §4 참조.

### Helper Functions

| 함수 | 언어 | 보안 | 용도 |
|---|---|---|---|
| `can_access_trip(p_trip_id uuid) → boolean` | plpgsql | **SECURITY DEFINER** | trip 접근 가능자 판정. schedule/expenses/todos/records RLS 에서 재사용 (Phase 3+) |
| `is_group_member(p_group_id uuid, p_user_id uuid) → boolean` | sql | **SECURITY DEFINER** | group_members RLS 무한 재귀 회피용 (0004 마이그레이션) |
| `query_publication_tables() → table(tablename text)` | sql | SECURITY DEFINER | Realtime publication 감사 쿼리. pg_publication_tables 은 PostgREST 로 직접 쿼리 불가하여 RPC 로 노출 |
| `set_updated_at()` | plpgsql trigger | — | trips UPDATE 시 updated_at 자동 갱신 |

### RPC Functions (Phase 2 기준)

| RPC | 시그니처 | 보안 | 설명 |
|---|---|---|---|
| `create_invite()` | `→ json` | SECURITY DEFINER | owner pending group 생성. 이미 pending 존재 시 **멱등** (`reused: true`) |
| `accept_invite(p_invite_code uuid)` | `→ json` | SECURITY DEFINER | partner 수락. atomic UPDATE pending→active + group_members INSERT. race 방어 |
| `cancel_invite()` | `→ void` | SECURITY INVOKER | owner pending→cancelled |
| `dissolve_group()` | `→ void` | SECURITY INVOKER | owner active→dissolved. trigger 가 trips fanout |
| `create_trip(...)` | `→ uuid` | **SECURITY DEFINER** (0004 fix) | trip + trip_days bulk 생성. active group 있으면 auto-link |
| `resize_trip_days(trip_id, new_start, new_end)` | `→ void` | **SECURITY DEFINER** (0004 fix) | trip_days DELETE+INSERT 재구성 + trips.start/end_date 업데이트. owner 만 |

**에러 코드 (UI 카피 매핑 참조):**
`unauthenticated`, `invite_invalid_or_consumed`, `cannot_accept_own_invite`, `already_in_active_group`, `no_pending_invite`, `no_active_group`, `invalid_date_range`, `trip_not_found_or_forbidden`, `user_already_in_active_group`, `group_invalid_transition_*`.

### RLS Policies

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| profiles | 본인: 전체 / 인증 유저: `profiles_public` view 경유 (display_name·avatar·color) | trigger only | 본인만 | ❌ |
| groups | 본인 소속 (`is_group_member`) 또는 본인 생성 | `auth.uid() = created_by` | `created_by = auth.uid() AND status NOT IN ('cancelled','dissolved')` | ❌ (상태 전이로만 표현) |
| group_members | `is_group_member(group_id, auth.uid())` | **WITH CHECK (false)** — `accept_invite` RPC 만 허용 | 본인 row, role 불변 | owner 는 자기삭제 금지 (`dissolve_group` 만), 본인 또는 owner |
| trips | `can_access_trip(id)` | `auth.uid() = created_by` | `can_access_trip(id) AND created_by = auth.uid()` | `auth.uid() = created_by` |
| trip_days | `can_access_trip(trip_id)` | 〃 | 〃 | 〃 |

Phase 3+ (`schedule_items`, `expenses`, `todos`, `records`) 도 동일하게 `can_access_trip(trip_id)` 재사용.

### Realtime Publication

`supabase_realtime` publication 에 **명시적 관리** (0003 마이그레이션):

```sql
alter publication supabase_realtime drop table if exists public.profiles;
alter publication supabase_realtime add table public.trips;
alter publication supabase_realtime add table public.group_members;
alter publication supabase_realtime add table public.groups;
```

**이유:** Supabase Realtime 은 column-level GRANT 를 우회해 전체 row 를 WebSocket 으로 송출. `profiles` 가 publication 에 있으면 `email` 이 전송됨. 명시 관리로 컬럼 누출 차단.

Phase 3+ 확장: `ALTER PUBLICATION supabase_realtime ADD TABLE schedule_items, expenses, todos, records;`

### Security Tradeoffs (의도적 수용)

1. **`already_in_active_group` 에러의 멤버십 상태 leak** — 공격자가 피해자 세션 + pending invite_code 동시 소유 시에만 문제. 실질 marginal. UX 회복 경로 유지 가치 큼.
2. **`invite_code` URL path 노출** — `<meta name="referrer" content="no-referrer">` 로 Referer leak 차단. UUID v4 122-bit + status gate 로 brute-force 불가.
3. **`trip_not_found_or_forbidden` 의 404/403 미구분** — 존재 여부 info leak 차단. UI 는 "여행을 찾을 수 없어요" 단일 카피.

---

## 5. Page Structure & Routing

```
/                          → 랜딩 (비로그인) or /trips 리다이렉트          [Phase 1 ✅]
/login                     → Google 로그인 (Static)                       [Phase 1 ✅]
/trips                     → 여행 목록 (Skeleton → Client fetch)           [Phase 2 ✅]
/trips/new                 → 여행 생성                                    [Phase 2 ✅]
/trips/[id]                → 여행 상세 — 탭 기반
  ├─ 일정 탭 (기본)         → mock UI + "다음 단계" 배너                  [Phase 3 ⏳]
  ├─ 경비 탭               → mock UI + 배너                              [Phase 4 ⏳]
  ├─ Todo 탭               → mock UI + 배너                              [Phase 5 ⏳]
  ├─ 기록 탭               → mock UI + 배너                              [Phase 5 ⏳]
  └─ 관리 탭               → 실 DB (share toggle + delete + edit)         [Phase 2 ✅]
/settings                  → 전역 설정 허브                               [Phase 2 ✅]
  ├─ /settings/profile     → display_name + color palette                [Phase 2 ✅]
  ├─ /settings/couple      → 초대 생성·취소·해제 (3 모드: no-group/pending/active) [Phase 2 ✅]
  └─ /settings/categories  → 일정/경비 커스텀 카테고리                     [Phase 4 ⏳]
/invite/[code]             → 초대 수락 — 5-branch 상태 머신                [Phase 2 ✅]
/share/[token]             → 게스트 조회 (SSR, 인증 불필요)                [Phase 6 ⏳]
/auth/logout               → logout route                                 [Phase 1 ✅]
```

### `/invite/[code]` 5-branch State Machine (Phase 2 구현됨)

- `loading` → RPC 호출 중
- `success` → 수락 완료, 1.5s 후 `/trips` 리다이렉트
- `own_invite` (`cannot_accept_own_invite`) → 본인 링크 안내 + [링크 복사] [설정으로]
- `already_connected` (`already_in_active_group`) → 기존 연결 해제 안내 + [설정 > 파트너]
- `invalid` (`invite_invalid_or_consumed`) → [여행 목록으로]

Metadata (`referrer: 'no-referrer'`) 는 `app/invite/[code]/layout.tsx` (Server Component) 에서 export. Page 는 `"use client"`.

### Navigation

Top AppBar + 여행 상세 내 탭 전환 (일정 | 경비 | Todo | 기록 | 관리).

---

## 6. Feature Details

### 6.1 Authentication  [Phase 1 ✅]

- Google Identity Services (GIS) 로 클라이언트 인증
- nonce 생성: **hex SHA-256** (base64url 아님 — Supabase `signInWithIdToken` 내부 구현에 맞춤)
- Supabase 가 토큰 검증 → 세션 생성 (OAuth rate limit 우회)
- 로그인 후 profiles 테이블에 DB trigger 자동 생성
- 세션: Supabase JWT (access 1h, refresh 자동)
- CSP: dev 한정 `unsafe-eval` (Next.js 16 Turbopack HMR), `connect-src` 에 **`https://` + `wss://`** Supabase 둘 다 명시

### 6.2 Group Connection  [Phase 2 ✅]

**초대 플로우:**
1. Owner `/settings/couple` → "초대 링크 생성" → `create_invite` RPC (멱등) → pending 모드 UI
2. URL `/invite/{uuid-token}` out-of-band 공유
3. Partner 링크 클릭 → middleware 인증 가드 → `accept_invite` RPC → 5 분기
4. SUCCESS → `/trips` 라우팅 + Realtime 이벤트로 Owner 탭 자동 active 전환

**해제 플로우:**
1. Owner `/settings/couple` → "파트너 연결 해제" (빨강) → 2단 확인
2. `dissolve_group` RPC → trigger `on_group_dissolved` → `trips.group_id → NULL` fanout
3. Partner Realtime 수신 → toast "파트너와의 공유가 종료되었어요" + `/trips` list refetch
4. Partner 가 공유되던 `/trips/{id}` 에 있으면 → PGRST116 → `<TripUnavailable />`

**Owner 자기삭제 방지:** `group_members_self_or_owner_delete` policy 가 owner self-DELETE 차단. `dissolve_group` RPC 경로로만 탈퇴.

### 6.3 Trip Management  [Phase 2 ✅]

**생성:** 제목 · 위치 · 기간(start/end) · 국내/해외 · 통화(해외). active group 있으면 자동 group_id 설정.

**편집 UI 패턴 (중요):** 관리 탭의 여행 정보 섹션은 제목/목적지/기간을 **읽기 전용 행**으로 나열하고, 섹션 하단의 단일 "여행 정보 수정" 버튼으로 **모달 내 전체 필드 동시 편집**. 행별 인라인 편집 금지. 이유: 기간 축소 → 일정 이동 경고 같은 필드 간 의존성을 모달 안에서 보여야 일관됨.

**날짜 변경:**
- 확장: optimistic 가능
- 축소: **pessimistic** + `<DateShrinkConfirm />` 확인 다이얼로그 ("Day N~M 의 일정은 마지막 Day 로 이동돼요" — forward-compatible 카피)
- RPC `resize_trip_days` 호출 → trip_days DELETE+INSERT + trips UPDATE

**삭제:** 생성자만. CASCADE 로 모든 하위 삭제. 공유 중이면 경고 강화 ("파트너의 데이터도 함께 삭제됩니다").

**파트너 공유 토글:** Owner 만 interactive. Partner 측은 disabled + tooltip. ON→OFF 시 inline 확인, pessimistic (서버 확정까지 disabled + spinner).

### 6.4 Realtime Sync  [Phase 2 ✅]

**구독 대상 (3 채널):** `trips`, `group_members`, `groups`.

| 채널 | Event | Filter | Invalidate | UI 부작용 |
|---|---|---|---|---|
| trips | INSERT/UPDATE/DELETE | RLS (내 접근 가능 trip) | `['trips','list']` + `['trips','detail',id]` | detail fresh |
| group_members | INSERT/DELETE | RLS (self row) | `['profile','me']` + `['trips','list']` | 초대 수락 반영 |
| groups | UPDATE | `status=eq.dissolved` | `['profile','me']` + `['trips','list']` | **Toast** "파트너와의 공유가 종료되었어요" |

**Lifecycle (`<RealtimeGateway />` in `app/providers.tsx`):**
- Mount: `useProfile().data?.id` 존재 시 3 채널 구독
- Unmount/세션 전환: `session.user.id` 키 의존. `onAuthStateChange` 리스너 + `removeAllChannels()` 재구독
- 재연결 복구: Supabase SDK backoff + 재연결 콜백에서 `invalidateQueries(['trips','list'])`
- Dev 전용: `window.__realtimeEvents = []` (NODE_ENV!=='production') — Playwright 결정적 대기용

**충돌:** last-write-wins (2명 사용이라 충분).

**Known limitation (Phase 3 follow-up):** Partner 측 share-toggle OFF 시 `TripUnavailable` 자동 전환 안 됨 — 새로고침 필요. trips UPDATE `group_id: X → null` 이벤트를 RLS 상 DELETE 로 취급하는 ADR 필요.

### 6.5 Schedule  [Phase 3 ⏳]

- View: Day Tab (수평 스크롤) + 지도(접기/펼치기) + 일정 리스트
- 장소 검색: 국내 Naver/Kakao, 해외 Google Maps (ADR 대기)
- ⋮ 메뉴: 편집 / 다른 날로 이동 / **경비 추가 바로가기** / 삭제
- Drag & Drop: long press → drag (drag 없으면 무동작, 메뉴는 별도 트리거)
- Optimistic update + rollback + 토스트

### 6.6 Expenses  [Phase 4 ⏳]

- 날짜 기반 (`expense_date`) — trip_days 독립
- 해외: `trips.currencies` 에 설정된 통화 선택 / 국내: KRW 고정
- 집계: 일별/통화별/카테고리별 (환율 변환 없음)
- 일정↔경비 양방향 링크 (schedule_items 삭제 시 경비는 유지, FK NULL)

### 6.7 Todo / 6.8 Records  [Phase 5 ⏳]

최초 스펙 유지.

### 6.9 Guest Sharing  [Phase 6 ⏳]

- 관리 탭에서 공유 URL 생성, show_* 플래그로 공개 항목 선택
- RPC `get_guest_trip_data(share_token)` SECURITY DEFINER — anon 직접 테이블 접근 불허
- SSR + OG 메타 태그
- 게스트 뷰 하단 "나도 여행 계획 세우기 →" CTA

### 6.10 Member Management  [Phase 2 ✅]

- `/settings/profile` 에서 display_name 설정 + color 팔레트 선택
- display_name 없으면 이메일 표시 (본인만 — 타인은 profiles_public view 라 email 없음)

### 6.11 Category Management  [Phase 4 ⏳]

최초 스펙 유지 — 기본 카테고리 + 커스텀. 그룹 형성 시 개인 카테고리 fanout (trigger `on_group_dissolved` 에 `categories.group_id → null` 추가).

### 6.12 Maps Integration  [Phase 3 ⏳]

- 국내/해외 분리. Phase 3 전 지도 API ADR 필요 (Kakao / Naver / Mapbox / Google)
- 지도 SDK lazy load (일정 탭 진입 시)

---

## 7. UI/UX Design Direction

DESIGN.md 참조. 핵심만 요약:

### Visual Tone

Cursor 웹사이트 영감 + 모바일 앱 패턴. 따뜻한 크림 (#f2f1ed), 어둡고 따뜻한 텍스트 (#26251e), 오렌지 액센트 (#f54e00), Pretendard Variable.

### Mobile-First (DESIGN.md §10)

터치 타겟 44x44pt · Bottom/Action Sheet · Skeleton · Pull-to-Refresh · Safe Area · Swipe Gesture.

### Micro-interactions

`:active { transform: scale(0.97) }` · 3단 shadow · slideUp/fadeIn · 드래그 lift shadow + rotate · 전역 `transform 150ms ease`.

### Empty State Pattern

모든 빈 화면에 동일 구조 (아이콘 → 안내 1줄 → 보조 1줄 → CTA). 최초 스펙 §7 Empty State Pattern 표 참조.

### Trip List Grouping (computed)

진행 중 (start≤today≤end) / 다가오는 (start>today) / 지난 (end<today). DB 변경 없음. 지난 여행 편집 가능 유지.

### Error Handling

하단 슬라이드업 토스트 3s · Optimistic 실패 시 rollback + "변경 사항을 저장하지 못했습니다" · 네트워크 끊김 시 상단 배너.

### Phase 2 UI 카피 (신규, Korean)

| Component | 카피 |
|---|---|
| `couple-section` no-group | "파트너와 함께 여행을 계획해보세요" · [파트너 초대하기] |
| 〃 pending | "초대 링크를 생성했어요" + 링크 + [복사] [QR] + "파트너가 수락하면 연결됩니다" + [초대 취소] |
| 〃 active | 파트너 프로필 카드 + [파트너 연결 해제] (빨강) |
| `delete-trip-dialog` solo | "'{title}'을(를) 삭제하시겠어요?" · "일정·경비·기록이 모두 함께 사라집니다." |
| 〃 공유 중 | + "파트너의 데이터도 함께 삭제됩니다" |
| `date-shrink-confirm` | "Day {n1}~{n2} 의 일정은 마지막 Day 로 이동돼요" |
| `trip-unavailable` | "파트너와의 연결이 해제되어 이 여행은 더 이상 볼 수 없어요" · [내 여행 목록으로] |
| `partner-share-toggle` ON→OFF | inline "파트너가 이 여행을 더 이상 볼 수 없게 됩니다" · [취소] [확인] |
| 〃 Partner view | disabled + tooltip "여행 생성자만 변경할 수 있어요" |
| `invite-accept-card` SUCCESS | toast "파트너와 연결되었어요" |
| `invite-copy-screen` own_invite | "이 링크는 당신이 만들었어요. 파트너에게 보내주세요" · [링크 복사] [설정으로] |

**용어 통일:** "파트너 연결 해제" (action) / "파트너와의 연결이 해제되었어요" (post-state). "해체"·"종료" 금지.

### Error Code → UI Copy Map

§4 Security Tradeoffs 및 RPC 에러 코드에 대응하는 카피는 `docs/specs/2026-04-19-phase2-trip-core-design.md` §3.9 표 참조 (이 문서에도 흡수되었으나 전문은 Phase 2 spec 유지).

---

## 8. Folder Structure (실제)

**최초 스펙의 `src/features/` 구조는 채택하지 않음.** Next.js 16 App Router + 루트 직접 폴더:

```
travel-manager/
├── app/                          # Next.js App Router
│   ├── auth/logout/              # logout route
│   ├── invite/[code]/            # layout.tsx(metadata) + page.tsx("use client")
│   ├── login/                    # Google GIS
│   ├── trips/
│   │   ├── page.tsx              # 목록 (useTripsList + groupTripsByStatus)
│   │   ├── new/page.tsx          # 생성 (useCreateTrip)
│   │   └── [id]/page.tsx         # 상세 (TripUnavailable 분기)
│   ├── settings/
│   │   ├── page.tsx              # 허브
│   │   ├── profile/              # display_name + color
│   │   └── couple/               # 초대 3-mode
│   ├── share/[token]/            # Phase 6
│   ├── design/                   # DESIGN 페이지
│   ├── layout.tsx, providers.tsx, page.tsx, globals.css
│
├── components/
│   ├── invite/                   # invite-accept-card, invite-copy-screen
│   ├── realtime/                 # realtime-gateway
│   ├── settings/                 # profile-display-name, couple-section, color-palette
│   ├── trip/                     # trip-card, trip-list, create-trip-form, edit-trip-modal,
│   │                             # delete-trip-dialog, date-shrink-confirm, trip-unavailable,
│   │                             # partner-share-toggle, manage-tab, {schedule,expenses,todos,records}-tab
│   └── ui/                       # primitives (TextField, Button, ConfirmDialog, etc.)
│
├── lib/
│   ├── auth/                     # GIS loader, signInWithIdToken wrapper, nonce
│   ├── group/                    # use-my-group, use-*-invite, use-dissolve-group, invite-url
│   ├── trip/                     # use-trips-list, use-trip-detail, use-create-trip,
│   │                             # use-update-trip, use-resize-trip-days, use-delete-trip,
│   │                             # use-partner-share-toggle, trip-grouping, constants
│   ├── profile/                  # use-profile, use-update-display-name, use-trip-members
│   ├── realtime/                 # channel.ts, trips/group-members/groups-channel, use-realtime-gateway
│   ├── mocks/                    # factory.ts (NODE_ENV guard) + mock data (Phase 3+ 에서 탭 재배선 시 제거)
│   ├── query/keys.ts             # TanStack Query key 규약
│   ├── store/                    # Zustand ui-store (flash toast)
│   ├── supabase/                 # browser/server/admin clients
│   ├── env.ts                    # Zod validated env (client/server 분리)
│   └── cn.ts, types.ts, use-simulated-load.ts
│
├── supabase/
│   ├── config.toml
│   └── migrations/               # 0001_profiles → 0002_groups → 0003_trips → 0004_fix_group_members_rls
│
├── tests/
│   ├── unit/                     # color-schema, colors, nonce, trip-grouping, invite-url, trip-date-validation
│   ├── integration/              # rls-*, accept-invite-race, create-trip, resize-trip-days,
│   │                             # dissolve-group-cascade, updated-at-trigger, realtime-publication-audit,
│   │                             # display-name-xss, cancel-invite, create-invite-idempotent
│   ├── e2e/                      # (Phase 3 복귀 예정 — Playwright, service_role auth helper)
│   └── mocks/
│
├── types/database.ts             # pnpm db:types 생성 (PostgrestVersion "12" workaround)
├── docs/                         # 설계·계획·리뷰·QA (CLAUDE.md 규칙)
├── middleware.ts                 # session refresh + 보호 라우트
├── next.config.ts                # CSP (https:// + wss:// Supabase, dev unsafe-eval)
├── eslint.config.mjs             # no-restricted-imports guard (lib/mocks/factory*)
├── playwright.config.ts
├── vitest.config.ts, vitest.integration.config.ts
├── public/                       # manifest.json (Phase 8), sw.js (Phase 8)
├── AGENTS.md, CLAUDE.md, DESIGN.md, README.md
├── package.json, pnpm-lock.yaml, pnpm-workspace.yaml
├── tsconfig.json, postcss.config.mjs
```

**핵심 차이 (최초 스펙 vs 실제):**
- `src/features/{trip,schedule,expense,...}/{components,hooks,queries,utils}/` 구조 → `lib/{group,trip,profile,realtime}/` 기능별 평평한 폴더 + `components/` 루트 공용
- 이유: Next.js 16 App Router 와의 경로 일치, 작은 파일 우선 원칙, import path 단축

---

## 9. Implementation Order (실제 진행)

| Phase | Feature | Status | Tag / Commit |
|---|---|---|---|
| 0 | 목업 + 디자인 시스템 토큰 + 공통 컴포넌트 + Empty State | ✅ | (Phase 1 직전 head) |
| 1 | 인증 (Google GIS + signInWithIdToken) + 프로필 + 레이아웃 + 6색 팔레트 | ✅ | `phase-1-foundation-auth` |
| 2 | 여행 CRUD + 그룹 연결 + 파트너 공유 토글 + Realtime 3채널 | ✅ | `phase-2-trip-core` |
| 3 | 일정 (schedule_items + List + Map + 드래그앤드롭 + 경비 추가 바로가기) + E2E 자동화 복귀 | ⏳ | — |
| 4 | 경비 + 카테고리 | ⏳ | — |
| 5 | Todo + 기록 | ⏳ | — |
| 6 | 게스트 공유 URL (SSR + CTA 배너) | ⏳ | — |
| 7 | Realtime 전면 확장 (schedule·expenses·todos) + 충돌 병합 | ⏳ | — |
| 8 | PWA + 마이크로 인터랙션 폴리시 | ⏳ | — |

### Phase 3 Entry Criteria (다음 세션 준비 체크)

- [ ] 지도 API 선택 ADR (Kakao / Naver / Mapbox / Google)
- [ ] Playwright E2E 자동화 복귀 인프라 — `auth.admin.createUser` + `signInWithPassword` helper + storageState 프로그램적 생성으로 Google OAuth 우회
- [ ] `schedule_items` 스키마 확정 (최초 스펙 §4 기준, map_provider CHECK 는 ADR 후 반영)
- [ ] `resize_trip_days` 의 Phase 3 확장 — 축소 시 last-kept day 로 `schedule_items` 재배치 (body 변경만, 시그니처·호출부 불변)
- [ ] Partner 측 share-toggle OFF 자동 Realtime 전환 설계 ADR (trips UPDATE group_id:X→null 을 RLS DELETE 로 취급 or REPLICA IDENTITY FULL)
- [ ] `categories` 테이블 + 기본 카테고리 시드 + 그룹 형성 fanout (Phase 4 와 함께도 가능)

### 미완 / 기술 부채 (Phase 3 이후 정리 후보)

- `useFlashToast()` 공용 훅 도입 — settings/couple/profile/manage/invite 5+ 파일의 flash + setTimeout cleanup 중복 통일
- `pnpm db:types` sed 후처리로 `PostgrestVersion "12"` 자동 유지 (ADR 후보)
- Phase 1 / Phase 2 retrospective 를 각 plan 문서 끝에 append
- `lib/mocks/factory.ts` 는 Phase 3+ 에서 탭 실 DB 재배선 시 자연 소멸 예정
- Vercel preview 재배포 → preview 도메인 GIS origin 추가

---

## 10. Design Notes (확장 메모)

### 미디어 확장 (V2+)

사진/미디어 첨부는 V2+. 확장 시 별도 `media` 테이블 + polymorphic FK (entity_type, entity_id) + Supabase Storage. records/schedule_items 에 연결.

### 그룹 확장 (V2+)

V1 max_members=2. 확장 시:
- `groups.max_members` 값만 변경 + `groups.name` 컬럼 재도입
- `group_members` 역할 추가 (admin, viewer)
- UI 멤버 관리 화면 추가
- RLS 정책 변경 불필요 (이미 group_members 기반)
- `check_active_group_uniqueness` 트리거는 유지 (다중 그룹 허용 시 재검토)

---

## 참고 문서

- 원 스펙: [`docs/superpowers/specs/2026-04-16-travel-manager-design.md`](../superpowers/specs/2026-04-16-travel-manager-design.md)
- Phase 2 Design: [`docs/specs/2026-04-19-phase2-trip-core-design.md`](./2026-04-19-phase2-trip-core-design.md)
- Phase 1 Plan: `docs/plans/2026-04-17-phase1-auth.md`
- Phase 2 Plan: `docs/plans/2026-04-19-phase2-trip-core.md`
- Phase 2 Manual E2E: `docs/qa/phase2-e2e-manual-checklist.md`
- DESIGN.md (토큰): 프로젝트 루트
- ADR 목차 (위키): `/Users/sh/Library/CloudStorage/SynologyDrive-home/앱/MY_AI_WIKI/projects/travel-manager/decisions/`

## 변경 이력 (2026-04-16 원본 대비)

| § | 변경 |
|---|---|
| 0 | **신규** — Implementation Status 표 |
| 1 Tech Stack | Next.js 16 App Router 명시 / GIS nonce 는 hex SHA-256 / CSP wss:// 노트 |
| 2 Scope | Phase 매핑 + status 컬럼 추가 |
| 3 Architecture | 변경 없음 (문구 정리) |
| 4 profiles | `display_name` CHECK ≤ 40, `profiles_public` view |
| 4 groups | `name` 컬럼 제거, status 4 상태 (cancelled 추가), `groups_with_invite` view |
| 4 group_members | `check_active_group_uniqueness` 트리거, `WITH CHECK (false)` + RPC-only INSERT, owner self-DELETE 방지, `is_group_member` helper (0004) |
| 4 trips | CHECK 제약 5종 (title/destination 길이, 날짜 범위, 90일 캡, currencies ≤5), `trips_set_updated_at` 트리거, `TRIP_CURRENCIES` 상수 |
| 4 trip_days | CASCADE + DELETE+INSERT 재구성 |
| 4 Helpers | `can_access_trip`, `is_group_member`, `query_publication_tables`, `set_updated_at` 신규 |
| 4 RPC | `create_invite`, `accept_invite`, `cancel_invite`, `dissolve_group`, `create_trip`, `resize_trip_days` 전체 추가 (0004 에서 create/resize SECURITY DEFINER) |
| 4 Triggers | `enforce_group_status_transition`, `on_group_dissolved` 추가 |
| 4 Realtime | publication 명시 관리 (profiles 제외, trips/group_members/groups) |
| 4 Security Tradeoffs | 신규 — 3개 의도 수용 문서화 |
| 5 Routing | `/settings/profile`, `/settings/couple` 분리, `/invite/[code]` 5-branch state machine, `/auth/logout` |
| 6.1 Auth | nonce hex, CSP wss:// 주의 |
| 6.2 Group | `cancel_invite` 경로 + owner self-DELETE 금지 |
| 6.3 Trip | 관리 탭 편집 UI 패턴 (행별 금지 → 모달 일괄) 명시 |
| 6.4 Realtime | 신규 §6.4 — 3 채널 구독 계약 + lifecycle + known limitation |
| 7 | Phase 2 UI 카피 표 추가, "파트너 연결 해제" 용어 통일 |
| 8 Folder | `src/features/` 폐기 → `app/` + `lib/` + `components/` 실제 구조로 재작성 |
| 9 | Implementation Order 에 진행 상태 표시 + Phase 3 Entry Criteria + 기술 부채 섹션 |
| 10 | V2 그룹 확장 시 `groups.name` 재도입 및 `check_active_group_uniqueness` 재검토 노트 |
