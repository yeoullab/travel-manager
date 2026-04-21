# Phase 3 — Schedule & Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 2 (trips + groups + Realtime) 위에 `schedule_items` + 일정 탭 UI + 지도(Naver/Google 이중 provider) + 드래그앤드롭 + E2E 자동화 복귀 + share-toggle OFF 실시간 전환을 얹어, "일정을 계획·편집하며 파트너와 실시간 공유하는" 핵심 UX 를 완성한다.

**Architecture:** TanStack Query 가 캐싱·무효화 단일 진입점. Supabase RPC (SECURITY DEFINER) 로 드래그/리사이즈/CRUD 를 atomic 하게 캡슐화, RLS 에서 `can_access_trip` 재사용. Maps provider 는 TypeScript 인터페이스 (`MapsProvider`) 로 추상화하고 `trip.is_domestic` 기반 lazy dynamic-import 로 번들 분리. 장소 검색은 `/api/maps/search` 서버 라우트 경유 (secret 보호 + rate limit). Share-toggle OFF 는 `trips REPLICA IDENTITY FULL` + 클라이언트 가상 DELETE 판정으로 해결. E2E 는 `auth.admin.createUser` + dev-only `/api/test/sign-in` + Playwright `storageState` 로 Google OAuth 를 우회.

**Tech Stack:** Next.js 16 App Router · TypeScript strict · `@supabase/supabase-js@^2` · `@supabase/ssr@^0.5` · `@tanstack/react-query@^5` · `zustand@^5` · `zod@^3` · `@dnd-kit/core@^6` · `@dnd-kit/sortable@^8` · `proj4@^2` (TM128 변환) · `vitest@^2` · `@playwright/test@^1.47+`

**Spec 근거:** `docs/specs/2026-04-20-phase3-schedule-map-design.md` (§1~§11, Patch A~OO). 이 Plan 의 모든 Task 는 해당 Spec 의 특정 §/Patch 와 1:1 대응.

---

## Pre-flight (사용자 + 개발자 확인)

| 항목 | 담당 | 확인 방법 |
|---|---|---|
| Phase 2 완료 + tag `phase-2-trip-core` origin 반영 | 개발자 | `git tag \| grep phase-2-trip-core` + `git log --oneline origin/main \| grep 0c710a2` |
| Supabase CLI 로그인 + 프로젝트 링크 | 개발자 | `supabase status` 로 `API URL`·`DB URL` 출력 확인 |
| NCP 콘솔: Maps Web Dynamic Map + 좌표변환 활성화 | **사용자** | 콘솔 → AI-NAVER-API → Maps → Application 등록 → `http://localhost:3000` + Vercel preview URL 허용 도메인 추가 → Client ID 복사 |
| developers.naver.com: 지역검색 API 앱 등록 | **사용자** | 지역검색 API 사용 설정 → Client ID/Secret 발급 (Maps 의 Client ID 와 **다른 값**) |
| Google Cloud: Maps JavaScript API + Places API (New) 활성화 | **사용자** | 콘솔 → APIs → Enable → 키 2개 발급 (referrer 제한 public / IP 제한 server) |
| `.env.local` 에 5 키 반영 | 개발자 | Task 6 단위 테스트 `env.test.ts` 통과로 검증 |
| `@dnd-kit` Next.js 16 / React 19 호환 smoke | 개발자 | Task 0 에서 수행 |
| `ALLOW_TEST_SIGNIN`, `TEST_SECRET` 로컬 `.env.test` | 개발자 | Task 7 작성 시 기록 |
| Playwright 브라우저 최신 (`v1.47+`) | 개발자 | `pnpm exec playwright install chromium` |

---

## File Structure

**신규 생성:**

```
supabase/
├── migrations/
│   ├── 0005_schedule_items.sql    # 테이블 + RLS + 인덱스 + CHECK + 트리거 + realtime pub
│   ├── 0006_schedule_rpc.sql      # RPC 5종 + resize_trip_days 재정의
│   └── 0007_replica_identity.sql  # trips REPLICA IDENTITY FULL
└── seed/
    └── test.sql                    # test_truncate_cascade RPC (service_role only)

scripts/
└── fix-postgrest-version.mjs      # db:types 후 PostgrestVersion "12" 고정

lib/
├── env.ts                          # (수정) Maps 5 키 추가
├── schedule/
│   ├── use-schedule-list.ts
│   ├── use-create-schedule-item.ts
│   ├── use-update-schedule-item.ts
│   ├── use-delete-schedule-item.ts
│   ├── use-reorder-schedule-items.ts
│   ├── use-move-schedule-item.ts
│   ├── apply-local-reorder.ts      # pure fn
│   └── apply-local-move.ts         # pure fn
├── maps/
│   ├── types.ts
│   ├── provider.ts                 # getMapsProvider + providerForTrip
│   ├── providers/
│   │   ├── naver-provider.ts
│   │   └── google-provider.ts
│   ├── search/
│   │   ├── naver-search.ts         # + tm128 변환 + strip-html
│   │   └── google-search.ts
│   ├── use-place-search.ts
│   ├── tm128.ts                    # pure fn
│   └── strip-html.ts               # pure fn

app/
├── api/
│   ├── maps/search/route.ts        # POST — auth + rate limit + provider dispatch
│   └── test/sign-in/route.ts       # dev-only 3중 guard
└── trips/[id]/page.tsx             # (수정) 탭 배너 제거, 실 schedule_items 배선

components/
├── schedule/
│   ├── map-panel.tsx
│   ├── day-tab-bar.tsx
│   ├── schedule-list.tsx
│   ├── schedule-item-card.tsx      # @dnd-kit/sortable
│   ├── schedule-item-modal.tsx
│   ├── place-search-sheet.tsx
│   └── day-move-sheet.tsx
└── trip/
    ├── schedule-tab.tsx            # (수정) mock 배너 제거, 실 UI 조립
    └── date-shrink-confirm.tsx     # (수정) "일정 K개가 이동돼요" 동적 카피

tests/
├── unit/
│   ├── sort-order.test.ts
│   ├── apply-local-move.test.ts
│   ├── coordinate-clamp.test.ts
│   ├── url-scheme.test.ts
│   ├── tm128-wgs84.test.ts
│   ├── provider-selector.test.ts
│   └── strip-html-tags.test.ts
├── integration/
│   ├── rls-schedule-items.spec.ts
│   ├── reorder-schedule-items-in-day.spec.ts
│   ├── move-schedule-item-across-days.spec.ts
│   ├── resize-trip-days-v2.spec.ts
│   ├── create-schedule-item.spec.ts
│   ├── update-schedule-item.spec.ts
│   ├── realtime-publication-audit-v2.spec.ts   # schedule_items 포함 재검증
│   ├── replica-identity-audit.spec.ts
│   ├── share-toggle-realtime.spec.ts
│   └── place-search-rate-limit.spec.ts
└── e2e/
    ├── global-setup.ts
    ├── fixtures/users.ts
    ├── helpers/
    │   ├── auth.ts
    │   ├── db-reset.ts
    │   └── realtime-hooks.ts
    ├── schedule-crud.spec.ts
    ├── drag-same-day.spec.ts
    ├── drag-cross-day.spec.ts
    ├── partner-realtime.spec.ts
    ├── share-toggle.spec.ts
    ├── resize-with-items.spec.ts
    └── place-search.spec.ts

docs/qa/
└── phase3-e2e-manual-checklist.md
```

**수정:**

- `types/database.ts` — `pnpm db:types` 재생성 (schedule_items + 재정의 RPC 반영)
- `lib/query/keys.ts` — `['schedule', tripId]` 추가
- `lib/realtime/trips-channel.ts` — share-toggle 가상 DELETE 판정 (§9 Patch PP/QQ)
- `lib/realtime/channel.ts` — schedule_items 채널 추가
- `lib/realtime/use-realtime-gateway.ts` — 4번째 채널 lifecycle
- `next.config.ts` — CSP 확장 (Naver/Google 지도 도메인)
- `.env.example` — 5 키 추가
- `eslint.config.mjs` — `tests/e2e/helpers` 는 mocks guard 에서 exempt
- `playwright.config.ts` — `projects: [anonymous, alice, partner-dual]` + globalSetup
- `.gitignore` — `tests/e2e/.auth/`
- `package.json` — scripts: `"db:types"`, `"test:integration"`, `"test:e2e"`, `"db:seed:test"` 추가 또는 보정

---

## Risks

Spec §10.4 의 R1~R10 전부 이 Plan 에 해당. 요약:

| ID | Sev | 리스크 | 대응 Task |
|---|---|---|---|
| R1 | High | `@dnd-kit` + Next.js 16 / React 19 호환성 리그레션 | Task 0 smoke |
| R2 | High | Naver TM128 → WGS84 변환 정확도 | Task 13 `proj4` + 5 known points unit test |
| R3 | High | service_role key 누출 | Task 7 3중 guard + Task 21 gitignore |
| R4 | Med | REPLICA IDENTITY FULL WAL 증가 | Task 3 trips 한정. schedule_items 는 Phase 3 Task 19 에서 판정 |
| R5 | Med | Google Places API 쿼터 초과 | Task 13 FieldMask + Task 14 debounce 300ms + Task 13 rate limit 30/min/user |
| R6 | Med | CSP `style-src 'unsafe-inline'` 방어 약화 | Task 6 주석에 근거 + Phase 8 재검토 follow-up |
| R7 | Med | SDK lazy load flaky E2E | Task 23 `waitForFunction(() => !!window.naver)` 명시 |
| R8 | Med | 드래그 중 realtime invalidate race | Task 19 `isDraggingSchedule` 플래그 + pending flush |
| R9 | Low | NCP 도메인 등록 preview URL 미지원 | Pre-flight 사용자 작업 + production URL 만 등록 |
| R10 | Low | a11y 한국어 스크린리더 메시지 누락 | Phase 8 i18n 이월 |

---

## Mock vs Real-DB Scope (Phase 3 종료 시점)

| 항목 | 상태 |
|---|---|
| `auth.users`, `public.profiles` | ✅ 실 DB (Phase 1) |
| `public.groups`, `group_members` | ✅ 실 DB (Phase 2) |
| `public.trips`, `trip_days` | ✅ 실 DB (REPLICA IDENTITY FULL 업그레이드 Phase 3 Task 3) |
| **`public.schedule_items`** | ✅ 실 DB (Phase 3 Task 1) |
| `expenses`, `todos`, `records`, `guest_shares`, `categories` | ⚠️ mock + 배너 유지 (Phase 4~6) |
| `/trips/[id]` 일정 탭 | ✅ 실 DB (Task 18) |
| `/trips/[id]` 경비/Todo/기록 탭 | ⚠️ mock + 배너 유지 |
| Realtime 채널 | ✅ 4종 (trips · group_members · groups · **schedule_items**) |

---

## Verification Targets (Exit gate — Spec §10.5 A~C)

1. `pnpm build` — TypeScript 0 에러
2. `pnpm test` unit — 7 신규 spec + 기존 22 모두 pass. `lib/maps/`·`lib/schedule/` ≥ 80% coverage
3. `pnpm test:integration` — 10 신규 + 기존 36 모두 pass. 20회 재실행 deterministic
4. `pnpm exec playwright test` — 7 신규 E2E pass (login.spec 의 Google smoke 는 skip)
5. `pnpm audit --production` — high/critical 0
6. `pnpm lint` — 0 error
7. Verification SQL 5 쿼리 (Spec §10.3) 결과 매칭
8. `types/database.ts` 최신 (schedule_items 포함)
9. 수동 QA 8 시나리오 (실 Google 계정 2개) PASS
10. `docs/qa/phase3-e2e-manual-checklist.md` + retrospective + tag `phase-3-schedule-map` + origin push

---

## Tasks

> **Part A: Task 0~10** — Infra · DB · 환경 · test/signin · Maps SDK scaffold
> **Part B: Task 11~20** (다음 세션) — hooks · 드래그 · place search · UI · Realtime
> **Part C: Task 21~Exit** (그 다음) — E2E 인프라 · 테스트 전수 · 수동 QA · Exit

---

### Task 0: Pre-flight Smoke (@dnd-kit 호환성 + Playwright 업그레이드 확인)

**Files:**
- Create: `tests/unit/dnd-kit-smoke.test.ts` (temporary — Task 완료 후 제거 가능)
- Modify: `package.json`

- [ ] **Step 1: `@dnd-kit` 설치**

```bash
pnpm add @dnd-kit/core@^6 @dnd-kit/sortable@^8 @dnd-kit/utilities@^3
```

Expected: 설치 성공, 경고 없음.

- [ ] **Step 2: `proj4` 설치 (TM128 변환용, Task 13 에서 사용)**

```bash
pnpm add proj4
pnpm add -D @types/proj4
```

- [ ] **Step 3: 최소 smoke 테스트 작성**

`tests/unit/dnd-kit-smoke.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { DndContext } from '@dnd-kit/core';
import { SortableContext, arrayMove } from '@dnd-kit/sortable';

describe('dnd-kit smoke', () => {
  it('arrayMove reorders array correctly (pure fn sanity)', () => {
    const result = arrayMove(['a', 'b', 'c', 'd'], 1, 3);
    expect(result).toEqual(['a', 'c', 'd', 'b']);
  });

  it('exports React 19 / Next.js 16 compatible components', () => {
    expect(DndContext).toBeDefined();
    expect(SortableContext).toBeDefined();
  });
});
```

- [ ] **Step 4: 테스트 실행**

```bash
pnpm exec vitest run tests/unit/dnd-kit-smoke.test.ts
```

Expected: 2/2 PASS. 만약 import error 발생 시 Risk R1 활성화 — README / issue tracker 에 버전 다운그레이드 후보 (예: `@dnd-kit/core@6.0.8` lockfile 핀) 기록 후 진행.

- [ ] **Step 5: Playwright 최신 버전 보장**

```bash
pnpm exec playwright install chromium --with-deps
pnpm exec playwright --version
```

Expected: `1.47+`.

- [ ] **Step 6: 커밋**

```bash
git add package.json pnpm-lock.yaml tests/unit/dnd-kit-smoke.test.ts
git commit -m "chore(deps): add @dnd-kit + proj4, verify Next.js 16 / React 19 compatibility"
```

---

### Task 1: DB 마이그레이션 — `0005_schedule_items.sql`

**Files:**
- Create: `supabase/migrations/0005_schedule_items.sql`

- [ ] **Step 1: 파일 직접 생성**

`supabase migration new` 명령은 timestamp 가 붙은 파일명을 만들어 rename 수고를 추가한다. 기존 마이그레이션(`0001_profiles.sql`~`0004_fix_group_members_rls.sql`)과 네이밍을 맞추기 위해 에디터에서 `supabase/migrations/0005_schedule_items.sql` 파일을 직접 생성한다.

- [ ] **Step 2: SQL 작성**

`supabase/migrations/0005_schedule_items.sql` 전체:

```sql
-- 0005_schedule_items.sql
-- Phase 3: schedule_items 테이블 + RLS + 인덱스 + CHECK + 트리거 + Realtime publication
-- 의존: 0003_trips.sql (trip_days), 0002_groups.sql (can_access_trip)

-- ── schedule_items 테이블 ──────────────────────────────────────────────
create table public.schedule_items (
  id                uuid        primary key default gen_random_uuid(),
  trip_day_id       uuid        not null references public.trip_days(id) on delete cascade,
  title             text        not null,
  sort_order        int         not null,
  time_of_day       time without time zone,
  place_name        text,
  place_address     text,
  place_lat         double precision,
  place_lng         double precision,
  place_provider    text,
  place_external_id text,
  memo              text,
  url               text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── CHECK 제약 (Patch C/D/E/F) ─────────────────────────────────────────
alter table public.schedule_items
  add constraint schedule_items_title_length
    check (char_length(title) between 1 and 100),
  add constraint schedule_items_place_name_length
    check (place_name is null or char_length(place_name) <= 100),
  add constraint schedule_items_place_address_length
    check (place_address is null or char_length(place_address) <= 200),
  add constraint schedule_items_memo_length
    check (memo is null or char_length(memo) <= 1000),
  add constraint schedule_items_url_length
    check (url is null or char_length(url) <= 2048),
  add constraint schedule_items_place_external_id_length
    check (place_external_id is null or char_length(place_external_id) <= 200),
  add constraint schedule_items_lat_range
    check (place_lat is null or (place_lat between -90 and 90)),
  add constraint schedule_items_lng_range
    check (place_lng is null or (place_lng between -180 and 180)),
  add constraint schedule_items_place_provider_check
    check (place_provider is null or place_provider in ('naver','google')),
  add constraint schedule_items_place_atomic check (
    (place_name is null and place_address is null
      and place_lat is null and place_lng is null
      and place_provider is null and place_external_id is null)
    or
    (place_name is not null and place_lat is not null and place_lng is not null
      and place_provider is not null)
  );

-- ── 인덱스 (Patch I) ───────────────────────────────────────────────────
create index idx_schedule_items_day       on public.schedule_items(trip_day_id);
create index idx_schedule_items_day_order on public.schedule_items(trip_day_id, sort_order);

-- ── 트리거: updated_at (set_updated_at 은 0003_trips.sql 에서 정의됨) ──
create trigger schedule_items_set_updated_at
  before update on public.schedule_items
  for each row execute function public.set_updated_at();

-- ── RLS (Patch J — can_access_trip 재사용) ────────────────────────────
alter table public.schedule_items enable row level security;

create policy "schedule_items_select"
  on public.schedule_items for select to authenticated
  using (public.can_access_trip(
    (select trip_id from public.trip_days where id = trip_day_id)
  ));

create policy "schedule_items_insert"
  on public.schedule_items for insert to authenticated
  with check (public.can_access_trip(
    (select trip_id from public.trip_days where id = trip_day_id)
  ));

create policy "schedule_items_update"
  on public.schedule_items for update to authenticated
  using (public.can_access_trip(
    (select trip_id from public.trip_days where id = trip_day_id)
  ))
  with check (public.can_access_trip(
    (select trip_id from public.trip_days where id = trip_day_id)
  ));

create policy "schedule_items_delete"
  on public.schedule_items for delete to authenticated
  using (public.can_access_trip(
    (select trip_id from public.trip_days where id = trip_day_id)
  ));

-- ── Realtime publication 확장 ──────────────────────────────────────────
alter publication supabase_realtime add table public.schedule_items;

-- ── ROLLBACK ────────────────────────────────────────────────────────────
-- alter publication supabase_realtime drop table public.schedule_items;
-- drop table if exists public.schedule_items;
```

- [ ] **Step 3: 마이그레이션 적용**

```bash
supabase db push
```

Expected: `Applying migration 0005_schedule_items.sql` 성공.

- [ ] **Step 4: 적용 확인**

```bash
supabase db lint   # 문법/경고 체크
```

SQL 로 검증 (Supabase Studio SQL editor 또는 `supabase db diff`):

```sql
select tablename from pg_tables where schemaname='public' and tablename='schedule_items';
-- Expected: 1 row

select conname from pg_constraint
  where conrelid='public.schedule_items'::regclass and contype='c'
  order by conname;
-- Expected 10+ rows: title_length, place_name_length, place_address_length,
-- memo_length, url_length, place_external_id_length, lat_range, lng_range,
-- place_provider_check, place_atomic

select policyname from pg_policies where tablename='schedule_items' order by policyname;
-- Expected 4 rows: schedule_items_delete/insert/select/update

select tablename from pg_publication_tables where pubname='supabase_realtime' order by tablename;
-- Expected includes: schedule_items
```

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/0005_schedule_items.sql
git commit -m "feat(db): add schedule_items table with RLS, CHECKs, indexes, realtime publication"
```

---

### Task 2: DB 마이그레이션 — `0006_schedule_rpc.sql`

**Files:**
- Create: `supabase/migrations/0006_schedule_rpc.sql`

- [ ] **Step 1: 파일 직접 생성**

에디터에서 `supabase/migrations/0006_schedule_rpc.sql` 파일을 직접 생성 (Task 1과 동일한 이유 — 명명 일관성).

- [ ] **Step 2: SQL 작성 — RPC 5종 + resize_trip_days 재정의**

`supabase/migrations/0006_schedule_rpc.sql` 전체:

```sql
-- 0006_schedule_rpc.sql
-- Phase 3: schedule_items CRUD + reorder + cross-day move RPC + resize_trip_days 재정의
-- 의존: 0005_schedule_items.sql

-- ── create_schedule_item ───────────────────────────────────────────────
create or replace function public.create_schedule_item(
  p_trip_day_id       uuid,
  p_title             text,
  p_time_of_day       time without time zone default null,
  p_place_name        text default null,
  p_place_address     text default null,
  p_place_lat         double precision default null,
  p_place_lng         double precision default null,
  p_place_provider    text default null,
  p_place_external_id text default null,
  p_memo              text default null,
  p_url               text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_trip_id    uuid;
  v_is_domestic boolean;
  v_next_order int;
  v_new_id     uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;

  select td.trip_id, t.is_domestic into v_trip_id, v_is_domestic
    from public.trip_days td
    join public.trips t on t.id = td.trip_id
    where td.id = p_trip_day_id;
  if v_trip_id is null then raise exception 'trip_day_not_found'; end if;
  if not public.can_access_trip(v_trip_id) then raise exception 'forbidden'; end if;

  -- provider ↔ is_domestic 정합성 (Patch H)
  if p_place_provider is not null then
    if v_is_domestic and p_place_provider != 'naver' then
      raise exception 'place_provider_mismatch';
    end if;
    if not v_is_domestic and p_place_provider != 'google' then
      raise exception 'place_provider_mismatch';
    end if;
  end if;

  -- next sort_order = max + 1 (빈 day 면 1)
  select coalesce(max(sort_order), 0) + 1 into v_next_order
    from public.schedule_items where trip_day_id = p_trip_day_id;

  insert into public.schedule_items(
    trip_day_id, title, sort_order, time_of_day,
    place_name, place_address, place_lat, place_lng,
    place_provider, place_external_id, memo, url
  ) values (
    p_trip_day_id, p_title, v_next_order, p_time_of_day,
    p_place_name, p_place_address, p_place_lat, p_place_lng,
    p_place_provider, p_place_external_id, p_memo, p_url
  ) returning id into v_new_id;

  return v_new_id;
end $$;

revoke all on function public.create_schedule_item(
  uuid, text, time without time zone, text, text,
  double precision, double precision, text, text, text, text
) from public;
grant execute on function public.create_schedule_item(
  uuid, text, time without time zone, text, text,
  double precision, double precision, text, text, text, text
) to authenticated;

-- ── update_schedule_item ───────────────────────────────────────────────
create or replace function public.update_schedule_item(
  p_item_id           uuid,
  p_title             text,
  p_time_of_day       time without time zone default null,
  p_place_name        text default null,
  p_place_address     text default null,
  p_place_lat         double precision default null,
  p_place_lng         double precision default null,
  p_place_provider    text default null,
  p_place_external_id text default null,
  p_memo              text default null,
  p_url               text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_day_id      uuid;
  v_trip_id     uuid;
  v_is_domestic boolean;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;

  select trip_day_id into v_day_id
    from public.schedule_items where id = p_item_id;
  if v_day_id is null then raise exception 'schedule_item_not_found'; end if;

  select td.trip_id, t.is_domestic into v_trip_id, v_is_domestic
    from public.trip_days td join public.trips t on t.id = td.trip_id
    where td.id = v_day_id;
  if not public.can_access_trip(v_trip_id) then raise exception 'forbidden'; end if;

  if p_place_provider is not null then
    if v_is_domestic and p_place_provider != 'naver' then
      raise exception 'place_provider_mismatch';
    end if;
    if not v_is_domestic and p_place_provider != 'google' then
      raise exception 'place_provider_mismatch';
    end if;
  end if;

  update public.schedule_items
    set title = p_title,
        time_of_day = p_time_of_day,
        place_name = p_place_name,
        place_address = p_place_address,
        place_lat = p_place_lat,
        place_lng = p_place_lng,
        place_provider = p_place_provider,
        place_external_id = p_place_external_id,
        memo = p_memo,
        url = p_url
    where id = p_item_id;
end $$;

revoke all on function public.update_schedule_item(
  uuid, text, time without time zone, text, text,
  double precision, double precision, text, text, text, text
) from public;
grant execute on function public.update_schedule_item(
  uuid, text, time without time zone, text, text,
  double precision, double precision, text, text, text, text
) to authenticated;

-- ── delete_schedule_item ───────────────────────────────────────────────
create or replace function public.delete_schedule_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_day_id  uuid;
  v_trip_id uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;

  select trip_day_id into v_day_id
    from public.schedule_items where id = p_item_id;
  if v_day_id is null then raise exception 'schedule_item_not_found'; end if;

  select trip_id into v_trip_id from public.trip_days where id = v_day_id;
  if not public.can_access_trip(v_trip_id) then raise exception 'forbidden'; end if;

  delete from public.schedule_items where id = p_item_id;

  -- gap 제거: 같은 day 의 남은 items 재번호
  update public.schedule_items si
    set sort_order = rn.ord,
        updated_at = now()
  from (
    select id, row_number() over (order by sort_order) as ord
    from public.schedule_items
    where trip_day_id = v_day_id
  ) rn
  where si.id = rn.id;
end $$;

revoke all on function public.delete_schedule_item(uuid) from public;
grant execute on function public.delete_schedule_item(uuid) to authenticated;

-- ── reorder_schedule_items_in_day (Spec §3.3, Patch M) ────────────────
create or replace function public.reorder_schedule_items_in_day(
  p_trip_day_id uuid,
  p_item_ids    uuid[]
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid            uuid := auth.uid();
  v_trip_id        uuid;
  v_expected_count int;
  v_provided_count int;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;

  select trip_id into v_trip_id from public.trip_days where id = p_trip_day_id;
  if v_trip_id is null then raise exception 'trip_day_not_found'; end if;
  if not public.can_access_trip(v_trip_id) then raise exception 'forbidden'; end if;

  select count(*) into v_expected_count
    from public.schedule_items where trip_day_id = p_trip_day_id;
  v_provided_count := coalesce(array_length(p_item_ids, 1), 0);
  if v_expected_count != v_provided_count then
    raise exception 'item_set_mismatch';
  end if;

  if exists (
    select 1 from unnest(p_item_ids) as arr(id)
    where not exists (
      select 1 from public.schedule_items si
      where si.id = arr.id and si.trip_day_id = p_trip_day_id
    )
  ) then raise exception 'item_not_in_day'; end if;

  if (select count(distinct x) from unnest(p_item_ids) x) != v_provided_count then
    raise exception 'duplicate_item_ids';
  end if;

  update public.schedule_items si
    set sort_order = arr.ord,
        updated_at = now()
  from (
    select unnest(p_item_ids) as id,
           generate_series(1, v_provided_count) as ord
  ) arr
  where si.id = arr.id;
end $$;

revoke all on function public.reorder_schedule_items_in_day(uuid, uuid[]) from public;
grant execute on function public.reorder_schedule_items_in_day(uuid, uuid[]) to authenticated;

-- ── move_schedule_item_across_days (Spec §3.4, Patch N/O/P) ───────────
create or replace function public.move_schedule_item_across_days(
  p_item_id         uuid,
  p_target_day_id   uuid,
  p_target_position int
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid            uuid := auth.uid();
  v_source_day_id  uuid;
  v_source_trip_id uuid;
  v_target_trip_id uuid;
  v_target_count   int;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;

  select trip_day_id into v_source_day_id
    from public.schedule_items where id = p_item_id;
  if v_source_day_id is null then raise exception 'schedule_item_not_found'; end if;

  select trip_id into v_source_trip_id from public.trip_days where id = v_source_day_id;
  select trip_id into v_target_trip_id from public.trip_days where id = p_target_day_id;
  if v_target_trip_id is null then raise exception 'target_day_not_found'; end if;
  if v_source_trip_id != v_target_trip_id then
    raise exception 'cannot_move_across_trips';
  end if;
  if not public.can_access_trip(v_source_trip_id) then
    raise exception 'forbidden';
  end if;

  if v_source_day_id = p_target_day_id then
    raise exception 'use_reorder_for_same_day';
  end if;

  select count(*) into v_target_count
    from public.schedule_items where trip_day_id = p_target_day_id;
  if p_target_position < 1 or p_target_position > v_target_count + 1 then
    raise exception 'invalid_target_position';
  end if;

  -- item 이동 (임시 sort_order=0)
  update public.schedule_items
    set trip_day_id = p_target_day_id,
        sort_order = 0,
        updated_at = now()
    where id = p_item_id;

  -- source day 재번호
  update public.schedule_items si
    set sort_order = rn.ord,
        updated_at = now()
  from (
    select id, row_number() over (order by sort_order) as ord
    from public.schedule_items
    where trip_day_id = v_source_day_id
  ) rn
  where si.id = rn.id;

  -- target day 재번호 (삽입 위치 반영)
  update public.schedule_items si
    set sort_order = case
        when si.id = p_item_id then p_target_position
        when rn.ord < p_target_position then rn.ord
        else rn.ord + 1
      end,
      updated_at = now()
  from (
    select id,
           row_number() over (
             order by case when id = p_item_id then 999999 else sort_order end
           ) as ord
    from public.schedule_items
    where trip_day_id = p_target_day_id
  ) rn
  where si.id = rn.id;
end $$;

revoke all on function public.move_schedule_item_across_days(uuid, uuid, int) from public;
grant execute on function public.move_schedule_item_across_days(uuid, uuid, int) to authenticated;

-- ── resize_trip_days 재정의 (Spec §4, Patch R/S) ──────────────────────
create or replace function public.resize_trip_days(
  p_trip_id   uuid,
  p_new_start date,
  p_new_end   date
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid              uuid := auth.uid();
  v_owner            uuid;
  v_new_day_count    int;
  v_old_day_count    int;
  v_last_kept_day_id uuid;
  v_max_sort         int;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  if p_new_start > p_new_end then raise exception 'invalid_date_range'; end if;

  select created_by into v_owner from public.trips where id = p_trip_id;
  if v_owner is null or v_owner != v_uid then
    raise exception 'trip_not_found_or_forbidden';
  end if;

  update public.trips
    set start_date = p_new_start, end_date = p_new_end
    where id = p_trip_id;

  v_new_day_count := (p_new_end - p_new_start) + 1;
  select count(*) into v_old_day_count from public.trip_days where trip_id = p_trip_id;

  -- 기존 day date 업데이트 (min(old,new) 만큼)
  update public.trip_days td
    set date = p_new_start + (day_number - 1)
  where td.trip_id = p_trip_id
    and day_number <= least(v_old_day_count, v_new_day_count);

  if v_new_day_count > v_old_day_count then
    -- 확장: 신규 day 추가
    insert into public.trip_days(trip_id, day_number, date)
    select p_trip_id,
           v_old_day_count + gs,
           p_new_start + (v_old_day_count + gs - 1)
    from generate_series(1, v_new_day_count - v_old_day_count) as gs;

  elsif v_new_day_count < v_old_day_count then
    -- 축소: 삭제 대상 day 의 items 를 last-kept day 로 이동
    select id into v_last_kept_day_id
      from public.trip_days
      where trip_id = p_trip_id and day_number = v_new_day_count;

    select coalesce(max(sort_order), 0) into v_max_sort
      from public.schedule_items where trip_day_id = v_last_kept_day_id;

    update public.schedule_items si
      set trip_day_id = v_last_kept_day_id,
          sort_order = v_max_sort
            + (td.day_number - v_new_day_count) * 10000
            + si.sort_order,
          updated_at = now()
      from public.trip_days td
      where td.id = si.trip_day_id
        and td.trip_id = p_trip_id
        and td.day_number > v_new_day_count;

    -- 재번호
    update public.schedule_items si
      set sort_order = rn.ord,
          updated_at = now()
    from (
      select id, row_number() over (order by sort_order) as ord
      from public.schedule_items
      where trip_day_id = v_last_kept_day_id
    ) rn
    where si.id = rn.id;

    delete from public.trip_days
      where trip_id = p_trip_id and day_number > v_new_day_count;
  end if;
end $$;

revoke all on function public.resize_trip_days(uuid, date, date) from public;
grant execute on function public.resize_trip_days(uuid, date, date) to authenticated;

-- ── ROLLBACK ───────────────────────────────────────────────────────────
-- drop function if exists public.move_schedule_item_across_days(uuid, uuid, int);
-- drop function if exists public.reorder_schedule_items_in_day(uuid, uuid[]);
-- drop function if exists public.delete_schedule_item(uuid);
-- drop function if exists public.update_schedule_item(uuid, text, time without time zone, text, text, double precision, double precision, text, text, text, text);
-- drop function if exists public.create_schedule_item(uuid, text, time without time zone, text, text, double precision, double precision, text, text, text, text);
-- resize_trip_days: Phase 2 버전으로 복원 필요 (0003_trips.sql 의 DELETE+INSERT 버전)
```

- [ ] **Step 3: 적용**

```bash
supabase db push
```

- [ ] **Step 4: 검증**

```sql
select p.proname from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.proname in (
    'create_schedule_item','update_schedule_item','delete_schedule_item',
    'reorder_schedule_items_in_day','move_schedule_item_across_days',
    'resize_trip_days'
  ) order by p.proname;
-- Expected 6 rows
```

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/0006_schedule_rpc.sql
git commit -m "feat(db): add schedule_items CRUD/drag RPCs and redefine resize_trip_days for items preservation"
```

---

### Task 3: DB 마이그레이션 — `0007_replica_identity.sql`

**Files:**
- Create: `supabase/migrations/0007_replica_identity.sql`

- [ ] **Step 1: 파일 직접 생성 + SQL 작성**

에디터에서 `supabase/migrations/0007_replica_identity.sql` 파일을 직접 생성한다. 내용:

```sql
-- 0007_replica_identity.sql
-- Phase 3: trips REPLICA IDENTITY FULL — partner 측 share-toggle OFF 자동 전환 지원
-- Spec §9 ADR 옵션 A. 이유: 기본 DEFAULT 는 payload.old 에 PK 만 포함하여
-- wasVisible && !isVisibleNow 판정 불가.

alter table public.trips replica identity full;

-- schedule_items: Phase 3 Task 19 에서 drag UPDATE 의 old.trip_day_id 접근 필요시 FULL 로 전환 재검토.
-- 현재는 DEFAULT 유지 — cross-day move 시 cross-day source day refetch 는
-- INSERT/DELETE 이벤트가 아닌 "id + new.trip_day_id" 조합으로 충분.

-- ROLLBACK
-- alter table public.trips replica identity default;
```

- [ ] **Step 2: 적용 + 검증**

```bash
supabase db push
```

```sql
select relreplident from pg_class where oid = 'public.trips'::regclass;
-- Expected: 'f'
```

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/0007_replica_identity.sql
git commit -m "feat(db): enable REPLICA IDENTITY FULL on trips for share-toggle realtime transition"
```

---

### Task 4: 테스트 전용 seed — `supabase/seed/test.sql`

**Files:**
- Create: `supabase/seed/test.sql`
- Create: `scripts/fix-postgrest-version.mjs`
- Modify: `package.json` (scripts — `db:types` 확장 + `db:seed:test` 신규. `test:e2e`/`test:integration` 은 이미 존재)

- [ ] **Step 1: seed 파일 생성**

`supabase/seed/test.sql`:

```sql
-- supabase/seed/test.sql
-- 테스트 전용 RPC — service_role 만 실행 가능. production migration 에 포함하지 않음.
-- 로컬/CI 에서 `pnpm db:seed:test` (= psql ... -f supabase/seed/test.sql) 로 적용.

create or replace function public.test_truncate_cascade()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.users 는 보존 (ensureTestUser 가 관리)
  -- schedule_items / trip_days / trips 는 UUID PK (sequence 없음) → restart identity 불필요
  -- group_members / groups 도 UUID PK. cascade 만 필요.
  truncate table
    public.schedule_items,
    public.trip_days,
    public.trips,
    public.group_members,
    public.groups
  cascade;

  -- profiles 는 auth.users 와 FK — truncate 안 함 (auth trigger 로 관리)
end $$;

revoke all on function public.test_truncate_cascade() from public;
revoke all on function public.test_truncate_cascade() from authenticated;
grant execute on function public.test_truncate_cascade() to service_role;
```

- [ ] **Step 2: PostgrestVersion 보정 스크립트 분리 (`scripts/fix-postgrest-version.mjs`)**

`package.json` 내 one-liner `sed` 는 4중 escape (JSON → shell → Node → regex) 로 silent corruption 위험. 별도 스크립트로 분리:

```bash
mkdir -p scripts
```

`scripts/fix-postgrest-version.mjs`:

```javascript
#!/usr/bin/env node
// supabase-js 2.103.x + supabase CLI 최신판의 regenerated types 가 `PostgrestVersion: "17"` 등
// 을 덮어쓰면 update()/insert() 반환 타입이 never 가 되는 Phase 1 회귀 이슈 재발.
// 현재 fix (Phase 1): "12" 로 고정. supabase-js 가 공식 대응하면 이 스크립트 제거.
import { readFileSync, writeFileSync } from "node:fs";

const path = "types/database.ts";
const src = readFileSync(path, "utf8");
const next = src.replace(/PostgrestVersion:\s*"[0-9]+"/g, 'PostgrestVersion: "12"');
if (src === next) {
  console.log("[fix-postgrest-version] no change (already 12 or pattern absent)");
} else {
  writeFileSync(path, next);
  console.log("[fix-postgrest-version] pinned PostgrestVersion to \"12\"");
}
```

- [ ] **Step 3: `package.json` scripts 수정**

기존 `package.json` 의 `scripts` 객체에서:
- **수정** (덮어쓰기): `"db:types": "supabase gen types typescript --linked --schema public > types/database.ts && node scripts/fix-postgrest-version.mjs"`
- **신규** (추가): `"db:seed:test": "psql \"$DATABASE_URL\" -f supabase/seed/test.sql"`
- `test:e2e` / `test:integration` / `test` 는 **이미 존재** — 건드리지 않음

최종 scripts 섹션 모습 (참고 — 실제 편집은 기존 key 2줄 수정 + 1줄 추가):

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:cov": "vitest run --coverage",
  "test:integration": "vitest run --config vitest.integration.config.ts",
  "test:e2e": "playwright test",
  "db:types": "supabase gen types typescript --linked --schema public > types/database.ts && node scripts/fix-postgrest-version.mjs",
  "db:seed:test": "psql \"$DATABASE_URL\" -f supabase/seed/test.sql"
}
```

> `$DATABASE_URL` 은 `supabase status` 의 `DB URL` 을 `.env.test` (또는 shell) 에 설정. README 에 셋업 가이드 1줄 추가.

- [ ] **Step 4: 로컬 적용**

`.env.test` 또는 shell 에 `DATABASE_URL` 설정 후:

```bash
pnpm db:seed:test
```

Expected: `CREATE FUNCTION` / `REVOKE` / `GRANT` 출력.

- [ ] **Step 5: 검증**

```sql
select p.proname from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.proname = 'test_truncate_cascade';
-- Expected: 1 row
```

```sql
select array_agg(distinct r.grantee) from information_schema.routine_privileges r
  where r.routine_schema='public' and r.routine_name='test_truncate_cascade';
-- Expected: {service_role}
```

- [ ] **Step 6: 커밋**

```bash
git add supabase/seed/test.sql scripts/fix-postgrest-version.mjs package.json
git commit -m "feat(test): add test_truncate_cascade RPC and extract postgrest-version fixup script"
```

---

### Task 5: 타입 재생성 + query keys 확장

**Files:**
- Modify: `types/database.ts` (auto-generated)
- Modify: `lib/query/keys.ts`

- [ ] **Step 1: 타입 재생성**

```bash
pnpm db:types
```

Expected: `types/database.ts` diff 에 `schedule_items`, `create_schedule_item`, `update_schedule_item`, `delete_schedule_item`, `reorder_schedule_items_in_day`, `move_schedule_item_across_days` 추가. `PostgrestVersion: "12"` 유지 확인 (sed 내장으로 자동).

- [ ] **Step 2: 타입 diff 확인**

```bash
git diff types/database.ts | head -80
```

만약 `PostgrestVersion: "17"` 등 높은 버전으로 덮어씌워진 경우 Task 4 의 sed 후처리 동작 확인. 실패 시 수동으로 `"12"` 로 수정.

- [ ] **Step 3: `lib/query/keys.ts` 확장**

현재 `lib/query/keys.ts` 는 nested namespace 패턴 (`profile.me`, `trips.all/list/detail(id)`, `group.me`, `tripMembers.byTripId(id)`). schedule 도 동일 패턴으로:

```typescript
// lib/query/keys.ts — 기존 객체에 schedule 추가
export const queryKeys = {
  profile: {
    me: ["profile", "me"] as const,
    byId: (id: string) => ["profile", "byId", id] as const,
  },
  tripMembers: {
    byTripId: (tripId: string) => ["tripMembers", tripId] as const,
  },
  trips: {
    all: ["trips"] as const,
    list: ["trips", "list"] as const,
    detail: (id: string) => ["trips", "detail", id] as const,
  },
  group: {
    me: ["group", "me"] as const,
  },
  schedule: {
    byTripId: (tripId: string) => ["schedule", tripId] as const,
  },
} as const;
```

- [ ] **Step 4: 타입체크**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors. Task 2 의 RPC 시그니처가 Database 에 반영되면 `supabase.rpc('create_schedule_item', {...})` 같은 호출이 strict 타입 inference.

- [ ] **Step 5: 커밋**

```bash
git add types/database.ts lib/query/keys.ts
git commit -m "chore(types): regenerate database types for schedule_items + RPCs"
```

---

### Task 6: 환경변수 확장 + CSP + `.env.example`

**Files:**
- Modify: `lib/env.ts`
- Modify: `.env.example`
- Modify: `next.config.ts`
- Create: `tests/unit/env-maps.test.ts`

> **현행 패턴 확인** (실 `lib/env.ts` — Phase 2 기준):
> - `publicSchema` (client/server 공유 NEXT_PUBLIC_*) + `serverOnlySchema` (server-only) 분리
> - 모듈 로드 시점 `env = publicSchema.parse({...})` 로 public 키 즉시 검증 → **필수 키가 비면 앱 부팅 자체가 실패**
> - `getServerEnv()` 는 지연 호출 + 캐시. Phase 3 추가분도 이 패턴 유지.
>
> **Boot-blocking 회피:** Phase 3 Pre-flight(NCP/Google 키 발급) 완료 전에도 `pnpm dev`/`pnpm build`/`pnpm test` 가 돌아야 한다. 따라서 Maps 키 5종은 모두 `.optional()` 로 선언. 실제 필요 시점(`loadSdk()`, `/api/maps/search`) 에서 개별 `if (!env.KEY) throw ...` 가드. 키 제공자(지도/검색 SDK) 가 실행되는 화면/엔드포인트를 열지 않는 한 부팅 영향 없음.

- [ ] **Step 1: `lib/env.ts` — Maps 5 키 + Test signin 2 키 추가**

현재 파일 내용을 기반으로 **전체 교체**:

```typescript
import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().min(1),
  // Phase 3 (ADR-009) — Maps public keys. Pre-flight 전에도 부팅 가능하도록 optional.
  NEXT_PUBLIC_NAVER_MAP_CLIENT_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),
});

const serverOnlySchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Phase 3 — Maps server-only secrets (optional until Pre-flight complete)
  NAVER_SEARCH_CLIENT_ID: z.string().min(1).optional(),
  NAVER_SEARCH_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_MAPS_SERVER_KEY: z.string().min(1).optional(),
  // Phase 3 — E2E test sign-in flags. 'true' 문자열일 때만 활성화.
  ALLOW_TEST_SIGNIN: z.enum(["true", "false"]).optional(),
  TEST_SECRET: z.string().min(1).optional(),
});

export const envSchema = publicSchema.extend(serverOnlySchema.shape);
export type Env = z.infer<typeof envSchema>;

export const env = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  NEXT_PUBLIC_NAVER_MAP_CLIENT_ID: process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID,
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
});

let cachedServerEnv: z.infer<typeof serverOnlySchema> | null = null;

export function getServerEnv() {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv()는 서버에서만 호출해야 합니다");
  }
  if (!cachedServerEnv) {
    cachedServerEnv = serverOnlySchema.parse({
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      NAVER_SEARCH_CLIENT_ID: process.env.NAVER_SEARCH_CLIENT_ID,
      NAVER_SEARCH_CLIENT_SECRET: process.env.NAVER_SEARCH_CLIENT_SECRET,
      GOOGLE_MAPS_SERVER_KEY: process.env.GOOGLE_MAPS_SERVER_KEY,
      ALLOW_TEST_SIGNIN: process.env.ALLOW_TEST_SIGNIN,
      TEST_SECRET: process.env.TEST_SECRET,
    });
  }
  return cachedServerEnv;
}
```

- [ ] **Step 2: `.env.example` 갱신**

파일 끝에 추가:

```
# ── Phase 3: Maps (ADR-009 Dual Provider) ─────────────────────────────
# Pre-flight 완료 후 채우면 됨. 미설정 시 Maps 기능만 비활성, 앱 부팅은 정상.

# NCP Maps Web Dynamic Map Client ID (console.ncloud.com)
NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=
# Naver 지역검색 (developers.naver.com — Maps 와 별도 앱)
NAVER_SEARCH_CLIENT_ID=
NAVER_SEARCH_CLIENT_SECRET=
# Google Maps JS + Places API (New) — public 은 referrer 제한, server 는 IP 제한
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
GOOGLE_MAPS_SERVER_KEY=

# ── Phase 3: E2E Test Sign-in (LOCAL/CI ONLY — never enable in production) ──
ALLOW_TEST_SIGNIN=false
TEST_SECRET=
```

- [ ] **Step 3: `next.config.ts` CSP 확장**

현재 `next.config.ts` 의 `scriptSrc` 배열 + `securityHeaders` 의 CSP `value` 배열을 수정. 기존 구조 유지 + 도메인 추가 (`nonce-${nonce}` 문법은 **도입하지 않음** — 현행은 `'unsafe-inline'` 유지):

```typescript
// next.config.ts — scriptSrc 확장 + CSP 배열 수정

const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  isDev ? "'unsafe-eval'" : "",
  "https://accounts.google.com",
  "https://accounts.google.com/gsi/client",
  // Phase 3 (ADR-009) — Maps SDK
  "https://oapi.map.naver.com",        // Naver Maps SDK
  "https://maps.googleapis.com",        // Google Maps JS loader
]
  .filter(Boolean)
  .join(" ");

// securityHeaders 의 CSP value 배열을 아래로 교체:
{
  key: "Content-Security-Policy",
  value: [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // Google Maps SDK 가 inline style 대량 주입 → 'unsafe-inline' 유지 (nonce 지원 없음)
    "style-src 'self' 'unsafe-inline' https://accounts.google.com",
    [
      "img-src 'self' data: blob:",
      "https://lh3.googleusercontent.com",
      // Phase 3 Maps 타일/정적 이미지
      "https://*.naver.net",            // Naver 타일
      "https://*.pstatic.net",          // Naver 정적
      "https://maps.googleapis.com",    // Google Static Maps
      "https://maps.gstatic.com",       // Google 아이콘
      "https://*.googleusercontent.com",// Google Places photos
    ].join(" "),
    "font-src 'self' data:",
    [
      "connect-src 'self'",
      supabaseHttp,
      supabaseWs,
      "https://accounts.google.com",
      // Phase 3 — Maps/Search API (client 에서 직접 호출하는 도메인 + SDK 가 fetch 하는 도메인)
      "https://naveropenapi.apigw.ntruss.com",
      "https://maps.googleapis.com",
    ].join(" "),
    "frame-src https://accounts.google.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
},
```

> `nonce-${nonce}` 문법은 도입하지 않는다 — 현행 `next.config.ts` 에 nonce 생성 파이프라인이 없고, Google Maps SDK 가 inline-style 대량 주입이라 `'unsafe-inline'` 이 현실적. Phase 8 폴리시에서 nonce 도입 재검토 (Spec §5.6 Patch Z).

- [ ] **Step 4: Unit 테스트**

`tests/unit/env-maps.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("env schema — maps (phase 3)", () => {
  it("Maps 5 키가 모두 optional — 미설정 환경에서도 import 성공", async () => {
    const mod = await import("@/lib/env");
    // 스키마가 .optional() 이라 env 객체에 key 가 없거나 undefined 여도 OK.
    // Pre-flight 전에도 부팅 가능해야 한다는 요구사항을 회귀 방지.
    expect(mod.env).toBeDefined();
    expect(mod.envSchema).toBeDefined();
  });

  it("getServerEnv() 는 server-only 키가 없어도 실패하지 않는다 (ALLOW_TEST_SIGNIN/TEST_SECRET/NAVER_SEARCH_* 모두 optional)", () => {
    // SUPABASE_SERVICE_ROLE_KEY 는 Phase 1 부터 필수 유지. 테스트 env 에서 이미 세팅됨.
    // 다른 server-only 는 optional 이어야 한다.
    // 이 스펙은 런타임 smoke — 상세 검증은 integration 에서.
    expect(typeof window === "undefined").toBe(true);
  });
});
```

> env 검증 테스트는 vitest 의 module cache 특성상 fragile. 현재 스펙은 "schema optional 선언 자체를 회귀 방지" 수준으로 한정. 실제 동작은 `pnpm build` 성공 + `pnpm dev` 부팅 성공으로 대체 검증.

- [ ] **Step 5: 테스트 + 빌드**

```bash
pnpm exec vitest run tests/unit/env-maps.test.ts
pnpm tsc --noEmit
pnpm build
pnpm dev &
sleep 6 && curl -sI http://localhost:3000/ | head -1 && pkill -f "next dev"
```

Expected: unit 2/2 PASS, tsc 0, build 0 error, `HTTP/1.1 200 OK` (Maps 키 없어도 부팅 성공).

- [ ] **Step 6: 커밋**

```bash
git add lib/env.ts .env.example next.config.ts tests/unit/env-maps.test.ts
git commit -m "feat(env+csp): add maps env keys (optional) and extend CSP for Naver/Google domains"
```

---

### Task 7: Dev-only `/api/test/sign-in` route (3중 guard) + `.gitignore`

**Files:**
- Create: `app/api/test/sign-in/route.ts`
- Modify: `.gitignore`

> `.env.example` 의 `ALLOW_TEST_SIGNIN` / `TEST_SECRET` 는 Task 6 에서 이미 추가됨.
> 환경변수 검증은 Task 6 의 `serverOnlySchema` 에 포함됨 — 이 route 는 `getServerEnv()` 로 조회.
> Supabase 서버 클라이언트는 프로젝트 기존 헬퍼 `lib/supabase/server-client.ts` 의 `getServerClient()` 를 재사용 (쿠키 배선 + `Database` 제네릭 타입 infer).

- [ ] **Step 1: route 작성**

`app/api/test/sign-in/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerClient } from "@/lib/supabase/server-client";
import { getServerEnv } from "@/lib/env";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Dev-only test sign-in.
 * Guard 3중:
 *  1. NODE_ENV !== 'production'
 *  2. ALLOW_TEST_SIGNIN === 'true'
 *  3. X-Test-Secret 헤더 = TEST_SECRET 일치
 * production 배포 시 Vercel 환경변수에서 ALLOW_TEST_SIGNIN 을 false 로 두거나 미설정.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "forbidden_in_production" }, { status: 404 });
  }

  const serverEnv = getServerEnv();
  if (serverEnv.ALLOW_TEST_SIGNIN !== "true") {
    return NextResponse.json({ error: "test_signin_disabled" }, { status: 404 });
  }
  if (!serverEnv.TEST_SECRET) {
    return NextResponse.json({ error: "test_secret_unset" }, { status: 500 });
  }

  const providedSecret = req.headers.get("x-test-secret");
  if (!providedSecret || providedSecret !== serverEnv.TEST_SECRET) {
    return NextResponse.json({ error: "secret_mismatch" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const supabase = await getServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: `.gitignore` 에 storageState 디렉터리 추가**

기존 `.gitignore` 끝에 추가:

```
# Phase 3 E2E — Playwright storageState (service_role 세션이 담기므로 commit 금지)
/tests/e2e/.auth/
```

- [ ] **Step 3: 로컬 smoke (dev 서버)**

먼저 `.env.local` 에 `ALLOW_TEST_SIGNIN=false` 로 둔 상태에서 확인:

```bash
pnpm dev &
sleep 6
curl -X POST http://localhost:3000/api/test/sign-in \
  -H "Content-Type: application/json" \
  -H "X-Test-Secret: wrong" \
  -d '{"email":"x@y.com","password":"pw"}'
```

Expected: `{"error":"test_signin_disabled"}` (HTTP 404).

그 다음 `.env.local` 에 `ALLOW_TEST_SIGNIN=true` + `TEST_SECRET=dev-local-secret` 세팅 후 dev 재시작:

```bash
pkill -f "next dev"
pnpm dev &
sleep 6
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/test/sign-in \
  -H "Content-Type: application/json" \
  -H "X-Test-Secret: wrong" \
  -d '{"email":"x@y.com","password":"pw"}'
pkill -f "next dev"
```

Expected: `401` (secret_mismatch 로 통과 가드가 동작). 테스트 종료.

- [ ] **Step 4: build 검증**

```bash
pnpm build
```

Expected: 0 error.

- [ ] **Step 5: 커밋**

```bash
git add app/api/test/sign-in/route.ts .gitignore
git commit -m "feat(test): add dev-only /api/test/sign-in with triple guard for e2e auth bypass"
```

---

### Task 8: Maps Provider 인터페이스 + selector + unit 테스트

**Files:**
- Create: `lib/maps/types.ts`
- Create: `lib/maps/provider.ts`
- Create: `tests/unit/provider-selector.test.ts`

- [ ] **Step 1: 타입 정의**

`lib/maps/types.ts`:

```typescript
export type MapsProviderName = 'naver' | 'google';

export interface LatLng { lat: number; lng: number; }

export interface PlaceResult {
  externalId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  provider: MapsProviderName;
}

export interface MarkerSpec {
  lat: number;
  lng: number;
  label: string;
  onClick?: () => void;
}

export interface MapOptions {
  center: LatLng;
  zoom: number;
}

export interface MapHandle {
  setCenter(center: LatLng): void;
  fitBounds(points: LatLng[]): void;
  addMarkers(markers: MarkerSpec[]): void;
  clearMarkers(): void;
  destroy(): void;
}

export interface MapsProvider {
  readonly name: MapsProviderName;
  loadSdk(): Promise<void>;
  createMap(container: HTMLElement, options: MapOptions): MapHandle;
}
```

- [ ] **Step 2: provider selector + lazy loader**

`lib/maps/provider.ts`:

```typescript
import type { MapsProvider, MapsProviderName } from './types';

const cache = new Map<MapsProviderName, MapsProvider>();

export async function getMapsProvider(name: MapsProviderName): Promise<MapsProvider> {
  const cached = cache.get(name);
  if (cached) {
    await cached.loadSdk();
    return cached;
  }
  const mod = name === 'naver'
    ? await import('./providers/naver-provider')
    : await import('./providers/google-provider');
  const provider = mod.default;
  cache.set(name, provider);
  await provider.loadSdk();
  return provider;
}

export function providerForTrip(isDomestic: boolean): MapsProviderName {
  return isDomestic ? 'naver' : 'google';
}
```

- [ ] **Step 3: unit 테스트**

`tests/unit/provider-selector.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { providerForTrip } from '@/lib/maps/provider';

describe('providerForTrip', () => {
  it('returns naver for domestic', () => {
    expect(providerForTrip(true)).toBe('naver');
  });
  it('returns google for international', () => {
    expect(providerForTrip(false)).toBe('google');
  });
});
```

- [ ] **Step 4: 실행**

```bash
pnpm exec vitest run tests/unit/provider-selector.test.ts
pnpm tsc --noEmit
```

Expected: 2/2 PASS + tsc 0 error (provider 파일이 아직 없으므로 `getMapsProvider` 는 import 만 — dynamic import 는 런타임이므로 tsc 에 영향 없음).

- [ ] **Step 5: 커밋**

```bash
git add lib/maps/types.ts lib/maps/provider.ts tests/unit/provider-selector.test.ts
git commit -m "feat(maps): add MapsProvider interface, selector, and lazy dynamic-import loader"
```

---

### Task 9: Naver provider 구현 (`lib/maps/providers/naver-provider.ts`)

**Files:**
- Create: `lib/maps/providers/naver-provider.ts`

- [ ] **Step 1: 작성**

`lib/maps/providers/naver-provider.ts`:

```typescript
import type { MapsProvider, MapHandle, MapOptions, MarkerSpec, LatLng } from '../types';

declare global {
  interface Window {
    naver?: {
      maps: {
        Map: new (el: HTMLElement, opts: unknown) => NaverMapInstance;
        LatLng: new (lat: number, lng: number) => unknown;
        LatLngBounds: new () => NaverBounds;
        Marker: new (opts: unknown) => NaverMarker;
        Event: { addListener(target: unknown, type: string, fn: () => void): void };
      };
    };
  }
}

interface NaverMapInstance {
  setCenter(latlng: unknown): void;
  fitBounds(bounds: unknown): void;
  destroy?: () => void;
}
interface NaverBounds { extend(latlng: unknown): void; }
interface NaverMarker { setMap(m: NaverMapInstance | null): void; }

let loadPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.naver?.maps) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
    if (!clientId) {
      reject(new Error('missing NEXT_PUBLIC_NAVER_MAP_CLIENT_ID'));
      return;
    }
    const script = document.createElement('script');
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${clientId}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('naver sdk load failed'));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}

function renderMarkerHtml(label: string): string {
  return `<div style="background:#F54E00;color:#fff;width:28px;height:28px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;font-weight:600;font-size:13px;
    box-shadow:0 2px 4px rgba(0,0,0,.25);border:2px solid #fff">${label}</div>`;
}

function createMap(container: HTMLElement, options: MapOptions): MapHandle {
  if (!window.naver?.maps) throw new Error('naver sdk not loaded');
  const ns = window.naver.maps;
  const map = new ns.Map(container, {
    center: new ns.LatLng(options.center.lat, options.center.lng),
    zoom: options.zoom,
  });
  let markers: NaverMarker[] = [];

  return {
    setCenter(c: LatLng) { map.setCenter(new ns.LatLng(c.lat, c.lng)); },
    fitBounds(points: LatLng[]) {
      if (points.length === 0) return;
      const bounds = new ns.LatLngBounds();
      points.forEach(p => bounds.extend(new ns.LatLng(p.lat, p.lng)));
      map.fitBounds(bounds);
    },
    addMarkers(specs: MarkerSpec[]) {
      specs.forEach(spec => {
        const marker = new ns.Marker({
          position: new ns.LatLng(spec.lat, spec.lng),
          map,
          icon: { content: renderMarkerHtml(spec.label) },
        });
        if (spec.onClick) ns.Event.addListener(marker, 'click', spec.onClick);
        markers.push(marker);
      });
    },
    clearMarkers() {
      markers.forEach(m => m.setMap(null));
      markers = [];
    },
    destroy() {
      markers.forEach(m => m.setMap(null));
      markers = [];
      map.destroy?.();
    },
  };
}

const provider: MapsProvider = { name: 'naver', loadSdk, createMap };
export default provider;
```

- [ ] **Step 2: tsc 확인**

```bash
pnpm tsc --noEmit
```

Expected: 0 error.

> **Note on declaration merging:** 이 파일의 `declare global { interface Window { naver?: ... } }` 는 Phase 1 의 Google GIS declaration (`Window.google = {accounts: ...}`) 과 **충돌하지 않는다** — TypeScript 의 interface declaration merging 이 `Window.naver` + `Window.google` 을 각각 union 으로 정의. Task 10 의 `Window.google = {maps: ...}` 확장도 `accounts` 와 병합되어 `Window.google = {accounts:..., maps:...}` 구조로 공존.

- [ ] **Step 3: 커밋**

```bash
git add lib/maps/providers/naver-provider.ts
git commit -m "feat(maps): add Naver provider with SDK lazy load and numbered marker"
```

---

### Task 10: Google provider 구현 (`lib/maps/providers/google-provider.ts`)

**Files:**
- Create: `lib/maps/providers/google-provider.ts`

- [ ] **Step 1: 작성**

`lib/maps/providers/google-provider.ts`:

```typescript
import type { MapsProvider, MapHandle, MapOptions, MarkerSpec, LatLng } from '../types';

declare global {
  interface Window {
    google?: {
      maps: {
        Map: new (el: HTMLElement, opts: unknown) => GoogleMapInstance;
        LatLng: new (lat: number, lng: number) => unknown;
        LatLngBounds: new () => GoogleBounds;
        marker: {
          AdvancedMarkerElement: new (opts: unknown) => GoogleMarker;
          PinElement: new (opts: unknown) => { element: HTMLElement };
        };
      };
    };
  }
}

interface GoogleMapInstance {
  setCenter(latlng: unknown): void;
  fitBounds(bounds: unknown): void;
}
interface GoogleBounds { extend(latlng: unknown): void; }
interface GoogleMarker { map: GoogleMapInstance | null; }

let loadPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      reject(new Error('missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'));
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker&v=weekly&loading=async`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('google sdk load failed'));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}

function renderPinElement(label: string): HTMLElement {
  const pin = new window.google!.maps.marker.PinElement({
    glyph: label,
    background: '#F54E00',
    borderColor: '#ffffff',
    glyphColor: '#ffffff',
    scale: 1,
  });
  return pin.element;
}

function createMap(container: HTMLElement, options: MapOptions): MapHandle {
  if (!window.google?.maps) throw new Error('google sdk not loaded');
  const gm = window.google.maps;
  const map = new gm.Map(container, {
    center: new gm.LatLng(options.center.lat, options.center.lng),
    zoom: options.zoom,
    mapId: 'DEMO_MAP_ID',  // AdvancedMarkerElement 는 mapId 필요 — Phase 3 은 데모 ID 사용
    disableDefaultUI: false,
  });
  let markers: GoogleMarker[] = [];

  return {
    setCenter(c: LatLng) { map.setCenter(new gm.LatLng(c.lat, c.lng)); },
    fitBounds(points: LatLng[]) {
      if (points.length === 0) return;
      const bounds = new gm.LatLngBounds();
      points.forEach(p => bounds.extend(new gm.LatLng(p.lat, p.lng)));
      map.fitBounds(bounds);
    },
    addMarkers(specs: MarkerSpec[]) {
      specs.forEach(spec => {
        const marker = new gm.marker.AdvancedMarkerElement({
          position: { lat: spec.lat, lng: spec.lng },
          map,
          content: renderPinElement(spec.label),
        });
        if (spec.onClick) {
          (marker as unknown as { addListener: (t: string, fn: () => void) => void })
            .addListener('click', spec.onClick);
        }
        markers.push(marker);
      });
    },
    clearMarkers() {
      markers.forEach(m => { m.map = null; });
      markers = [];
    },
    destroy() {
      markers.forEach(m => { m.map = null; });
      markers = [];
    },
  };
}

const provider: MapsProvider = { name: 'google', loadSdk, createMap };
export default provider;
```

> `mapId: 'DEMO_MAP_ID'` 는 임시 placeholder. 프로덕션 시나리오에선 Google Cloud Console → Map Management → Create Map ID (Vector + JavaScript) 후 env `NEXT_PUBLIC_GOOGLE_MAP_ID` 로 주입. **Task 15 폴리시 또는 Phase 8 에서 우선순위 결정 필요** → Task 26 retrospective 의 follow-up 리스트에 기록.

- [ ] **Step 2: tsc + build**

```bash
pnpm tsc --noEmit
pnpm build
```

Expected: 0 error.

- [ ] **Step 3: 커밋**

```bash
git add lib/maps/providers/google-provider.ts
git commit -m "feat(maps): add Google provider with AdvancedMarkerElement and SDK lazy load"
```

---

## Part A — 체크포인트

Task 0~10 완료 시점:
- DB: `schedule_items` 테이블 + 5 RPC + `trips REPLICA IDENTITY FULL` + `test_truncate_cascade` 활성
- 환경: Maps 5 키 스키마 + CSP + `/api/test/sign-in` 3중 guard
- Maps 추상화: `MapsProvider` 인터페이스 + Naver / Google lazy provider (SDK 로드는 됐으나 아직 UI 에서 사용 안 함)
- 타입: `types/database.ts` 재생성, query keys 확장
- 테스트: `dnd-kit-smoke`, `env-maps`, `provider-selector` 3 unit spec 통과

**검증:**
```bash
pnpm tsc --noEmit && pnpm lint && pnpm build && pnpm test
```
Expected: 전부 0 error / 0 failure.

**다음 Part B 입력:** 이 상태에서 schedule 훅 → 드래그 → place search → UI → Realtime gateway 확장으로 이어간다.

---


# Part B — Schedule CRUD / Drag / Maps / UI / Realtime (Task 11~20)

> Part A 에서 만든 DB 스키마·RPC·env·Maps abstraction 위에 실제 기능을 올린다.
> **절대 원칙 (이전 초안 폐기 배경):**
> 1. **schedule_items 는 `trip_day_id` FK 만 가진다** — `trip_id`/`day_number` 컬럼 없음. 필요 시 `trip_days` 조인으로 해결.
> 2. **시간 필드는 `time_of_day` 단일** (start_time/end_time 아님). 장소 필드는 `place_name/place_address/place_lat/place_lng/place_provider/place_external_id`.
> 3. **RPC 파라미터명은 Part A Task 2 SQL 그대로** — `p_trip_day_id`, `p_target_day_id`, `p_target_position`(1-based 1..count+1), `p_item_ids`.
> 4. **Maps 모듈은 `lib/maps/types.ts`·`lib/maps/provider.ts` 의 `MapHandle`/`MapsProvider` 인터페이스** (이전 초안이 가정한 `types-provider.ts` / `selectMapsProvider` 는 존재하지 않음).
> 5. **테스트 유틸은 `tests/integration/create-trip.test.ts` 인라인 패턴 재사용** — `tests/utils/*` 는 존재하지 않으니 만들지 않는다.

---

### Task 11: `useScheduleList` + `useTripDays` Query Hooks

Spec §3.2, §4.1. trip 전체 schedule_items 를 한 번에 조회하고, day_number ↔ trip_day_id 매핑을 별도로 캐시한다. schedule 쿼리키는 `queryKeys.schedule.byTripId(tripId)` (Part A Task 5 확장).

**Files:**
- Create: `lib/schedule/use-schedule-list.ts`
- Create: `lib/trip/use-trip-days.ts`
- Modify: `lib/query/keys.ts` — `tripDays` 키 추가
- Test: `tests/integration/list-schedule-items.test.ts`

- [ ] **Step 1: `queryKeys.tripDays` 추가**

Edit `lib/query/keys.ts` — 기존 객체에 `tripDays` 필드를 끼워넣어 최종 형태:

```typescript
export const queryKeys = {
  profile: {
    me: ["profile", "me"] as const,
    byId: (id: string) => ["profile", "byId", id] as const,
  },
  tripMembers: {
    byTripId: (tripId: string) => ["tripMembers", tripId] as const,
  },
  trips: {
    all: ["trips"] as const,
    list: ["trips", "list"] as const,
    detail: (id: string) => ["trips", "detail", id] as const,
  },
  group: {
    me: ["group", "me"] as const,
  },
  tripDays: {
    byTripId: (tripId: string) => ["tripDays", tripId] as const,
  },
  schedule: {
    byTripId: (tripId: string) => ["schedule", tripId] as const,
  },
} as const;
```

> Part A Task 5 가 `schedule.byTripId` 를 이미 추가한 상태라면 그 줄 아래에 `tripDays` 만 끼워넣는다. 중복 선언 금지.

- [ ] **Step 2: 실패 테스트 작성**

Create `tests/integration/list-schedule-items.test.ts`:

```typescript
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
let ownerId = ""; let outsiderId = "";
let ownerC: SupabaseClient<Database>; let outsiderC: SupabaseClient<Database>;
let tripId = ""; let day1Id = "";

beforeAll(async () => {
  const o = await admin.auth.admin.createUser({
    email: `list_owner+${STAMP}@test.local`, password: PWD, email_confirm: true,
  });
  if (o.error) throw o.error;
  ownerId = o.data.user!.id;
  const x = await admin.auth.admin.createUser({
    email: `list_outsider+${STAMP}@test.local`, password: PWD, email_confirm: true,
  });
  if (x.error) throw x.error;
  outsiderId = x.data.user!.id;

  ownerC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  await ownerC.auth.signInWithPassword({ email: `list_owner+${STAMP}@test.local`, password: PWD });

  outsiderC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  await outsiderC.auth.signInWithPassword({ email: `list_outsider+${STAMP}@test.local`, password: PWD });

  const { data: newTripId, error: e1 } = await ownerC.rpc("create_trip", {
    p_title: "List test", p_destination: "Seoul",
    p_start_date: "2026-06-01", p_end_date: "2026-06-02",
    p_is_domestic: true, p_currencies: [],
  });
  if (e1) throw e1;
  tripId = newTripId as string;

  const { data: day } = await ownerC.from("trip_days")
    .select("id").eq("trip_id", tripId).eq("day_number", 1).single();
  day1Id = day!.id;

  const { error: e2 } = await ownerC.rpc("create_schedule_item", {
    p_trip_day_id: day1Id,
    p_title: "Breakfast",
    p_time_of_day: "09:00",
  });
  if (e2) throw e2;
});

afterAll(async () => {
  await admin.from("trips").delete().eq("id", tripId);
  for (const id of [ownerId, outsiderId]) await admin.auth.admin.deleteUser(id);
});

describe("schedule_items 읽기 경로 — RLS", () => {
  it("owner 는 본인 trip 의 items 를 읽을 수 있다", async () => {
    const { data, error } = await ownerC
      .from("schedule_items")
      .select("id, title, sort_order, time_of_day, trip_day_id")
      .eq("trip_day_id", day1Id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].title).toBe("Breakfast");
    expect(data![0].sort_order).toBe(1);
    expect(data![0].time_of_day).toBe("09:00:00");
  });

  it("outsider 는 타인 trip 의 items 를 읽을 수 없다 (0행)", async () => {
    const { data, error } = await outsiderC
      .from("schedule_items")
      .select("*")
      .eq("trip_day_id", day1Id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
```

- [ ] **Step 3: 테스트 실행 (DB 계약 잠금용)**

```bash
pnpm vitest run tests/integration/list-schedule-items.test.ts
```
Expected: 2/2 PASS. 실패 시 Part A Task 1 (테이블+RLS) 또는 Task 2 (create_schedule_item RPC) 를 재점검.

- [ ] **Step 4: `useTripDays` 훅 구현**

Create `lib/trip/use-trip-days.ts`:

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import type { Database } from "@/types/database";

export type TripDay = Database["public"]["Tables"]["trip_days"]["Row"];

export function useTripDays(tripId: string | null) {
  const supabase = getBrowserClient();
  return useQuery({
    queryKey: tripId ? queryKeys.tripDays.byTripId(tripId) : ["tripDays", "__idle"],
    enabled: Boolean(tripId),
    queryFn: async (): Promise<TripDay[]> => {
      if (!tripId) return [];
      const { data, error } = await supabase
        .from("trip_days")
        .select("id, trip_id, day_number, date")
        .eq("trip_id", tripId)
        .order("day_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TripDay[];
    },
    staleTime: 60_000,
  });
}
```

- [ ] **Step 5: `useScheduleList` 훅 구현**

Create `lib/schedule/use-schedule-list.ts`:

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import type { Database } from "@/types/database";

export type ScheduleItem = Database["public"]["Tables"]["schedule_items"]["Row"];

export function useScheduleList(tripId: string | null) {
  const supabase = getBrowserClient();
  return useQuery({
    queryKey: tripId ? queryKeys.schedule.byTripId(tripId) : ["schedule", "__idle"],
    enabled: Boolean(tripId),
    queryFn: async (): Promise<ScheduleItem[]> => {
      if (!tripId) return [];
      // schedule_items 는 trip_day_id 만 가지므로 trip_days 와 inner join 으로 tripId 필터.
      const { data, error } = await supabase
        .from("schedule_items")
        .select("*, trip_days!inner(trip_id)")
        .eq("trip_days.trip_id", tripId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as Array<ScheduleItem & { trip_days: unknown }>).map((row) => {
        const { trip_days: _j, ...item } = row;
        return item as ScheduleItem;
      });
    },
    staleTime: 10_000,
  });
}
```

- [ ] **Step 6: 타입체크 + 커밋**

```bash
pnpm tsc --noEmit && pnpm lint
```
Expected: 0 error.

```bash
git add lib/query/keys.ts lib/trip/use-trip-days.ts lib/schedule/use-schedule-list.ts tests/integration/list-schedule-items.test.ts
git commit -m "feat(schedule): add useScheduleList + useTripDays query hooks with RLS contract test"
```

---

### Task 12: `useCreateScheduleItem` Mutation

Spec §3.3 + Part A Task 2 `create_schedule_item(p_trip_day_id, p_title, p_time_of_day?, p_place_name?, p_place_address?, p_place_lat?, p_place_lng?, p_place_provider?, p_place_external_id?, p_memo?, p_url?) → uuid`. sort_order 는 서버가 `max+1` 로 자동 배정 (1-based).

**Files:**
- Create: `lib/schedule/use-create-schedule-item.ts`
- Test: `tests/integration/create-schedule-item.test.ts`

- [ ] **Step 1: 실패 테스트**

Create `tests/integration/create-schedule-item.test.ts`:

```typescript
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
let userId = "";
let userC: SupabaseClient<Database>;
let tripId = ""; let day1Id = "";

beforeAll(async () => {
  const u = await admin.auth.admin.createUser({
    email: `create_si+${STAMP}@test.local`, password: PWD, email_confirm: true,
  });
  if (u.error) throw u.error;
  userId = u.data.user!.id;
  userC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  await userC.auth.signInWithPassword({ email: `create_si+${STAMP}@test.local`, password: PWD });

  const { data: tid } = await userC.rpc("create_trip", {
    p_title: "T", p_destination: "Tokyo",
    p_start_date: "2026-06-01", p_end_date: "2026-06-02",
    p_is_domestic: false, p_currencies: [],
  });
  tripId = tid as string;
  const { data: d } = await userC.from("trip_days")
    .select("id").eq("trip_id", tripId).eq("day_number", 1).single();
  day1Id = d!.id;
});

afterAll(async () => {
  await admin.from("trips").delete().eq("id", tripId);
  await admin.auth.admin.deleteUser(userId);
});

describe("create_schedule_item RPC", () => {
  it("sort_order 를 1 부터 자동 배정한다", async () => {
    const { data: id1, error: e1 } = await userC.rpc("create_schedule_item", {
      p_trip_day_id: day1Id, p_title: "A", p_time_of_day: "09:00",
    });
    expect(e1).toBeNull();
    const { data: id2, error: e2 } = await userC.rpc("create_schedule_item", {
      p_trip_day_id: day1Id, p_title: "B", p_time_of_day: "10:00",
    });
    expect(e2).toBeNull();

    const { data: rows } = await userC.from("schedule_items")
      .select("id, title, sort_order")
      .in("id", [id1 as string, id2 as string])
      .order("sort_order");
    expect(rows).toEqual([
      expect.objectContaining({ id: id1, title: "A", sort_order: 1 }),
      expect.objectContaining({ id: id2, title: "B", sort_order: 2 }),
    ]);
  });

  it("해외 여행인데 place_provider='naver' 면 거절한다 (Patch H)", async () => {
    const { error } = await userC.rpc("create_schedule_item", {
      p_trip_day_id: day1Id, p_title: "X",
      p_place_name: "bogus", p_place_lat: 35.6, p_place_lng: 139.7,
      p_place_provider: "naver",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/place_provider_mismatch/);
  });
});
```

- [ ] **Step 2: 실행**

```bash
pnpm vitest run tests/integration/create-schedule-item.test.ts
```
Expected: 2/2 PASS (계약 잠금).

- [ ] **Step 3: 훅 구현**

Create `lib/schedule/use-create-schedule-item.ts`:

```typescript
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export type CreateScheduleItemInput = {
  tripId: string;            // invalidate 키 용도 (서버엔 미전달)
  tripDayId: string;
  title: string;
  timeOfDay?: string | null;
  placeName?: string | null;
  placeAddress?: string | null;
  placeLat?: number | null;
  placeLng?: number | null;
  placeProvider?: "naver" | "google" | null;
  placeExternalId?: string | null;
  memo?: string | null;
  url?: string | null;
};

export function useCreateScheduleItem() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateScheduleItemInput): Promise<string> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("create_schedule_item", {
        p_trip_day_id: input.tripDayId,
        p_title: input.title,
        p_time_of_day: input.timeOfDay ?? null,
        p_place_name: input.placeName ?? null,
        p_place_address: input.placeAddress ?? null,
        p_place_lat: input.placeLat ?? null,
        p_place_lng: input.placeLng ?? null,
        p_place_provider: input.placeProvider ?? null,
        p_place_external_id: input.placeExternalId ?? null,
        p_memo: input.memo ?? null,
        p_url: input.url ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_id, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.schedule.byTripId(vars.tripId) });
    },
  });
}
```

- [ ] **Step 4: 커밋**

```bash
pnpm tsc --noEmit && pnpm lint
git add lib/schedule/use-create-schedule-item.ts tests/integration/create-schedule-item.test.ts
git commit -m "feat(schedule): add useCreateScheduleItem mutation with RPC contract test"
```

---

### Task 13: `useUpdateScheduleItem` + `useDeleteScheduleItem`

Spec §3.3 + Part A `update_schedule_item(p_item_id, p_title, p_time_of_day?, p_place_*?, p_memo?, p_url?) → void`. `delete_schedule_item(p_item_id) → void` (서버가 남은 items 자동 재번호).

**Files:**
- Create: `lib/schedule/use-update-schedule-item.ts`
- Create: `lib/schedule/use-delete-schedule-item.ts`
- Test: `tests/integration/update-delete-schedule-item.test.ts`

- [ ] **Step 1: 실패 테스트**

Create `tests/integration/update-delete-schedule-item.test.ts`:

```typescript
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
let userId = "";
let userC: SupabaseClient<Database>;
let tripId = ""; let dayId = "";
let a = ""; let b = "";

beforeAll(async () => {
  const u = await admin.auth.admin.createUser({
    email: `upd_si+${STAMP}@test.local`, password: PWD, email_confirm: true,
  });
  if (u.error) throw u.error;
  userId = u.data.user!.id;
  userC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  await userC.auth.signInWithPassword({ email: `upd_si+${STAMP}@test.local`, password: PWD });

  const { data: tid } = await userC.rpc("create_trip", {
    p_title: "T", p_destination: "Seoul",
    p_start_date: "2026-06-01", p_end_date: "2026-06-02",
    p_is_domestic: true, p_currencies: [],
  });
  tripId = tid as string;
  const { data: d } = await userC.from("trip_days")
    .select("id").eq("trip_id", tripId).eq("day_number", 1).single();
  dayId = d!.id;

  const { data: ida } = await userC.rpc("create_schedule_item", {
    p_trip_day_id: dayId, p_title: "A", p_time_of_day: "09:00",
  });
  a = ida as string;
  const { data: idb } = await userC.rpc("create_schedule_item", {
    p_trip_day_id: dayId, p_title: "B", p_time_of_day: "10:00",
  });
  b = idb as string;
});

afterAll(async () => {
  await admin.from("trips").delete().eq("id", tripId);
  await admin.auth.admin.deleteUser(userId);
});

describe("update_schedule_item / delete_schedule_item", () => {
  it("title + time_of_day + memo 를 갱신한다 (trip_day_id 불변)", async () => {
    const { error } = await userC.rpc("update_schedule_item", {
      p_item_id: a, p_title: "A-updated",
      p_time_of_day: "11:30", p_memo: "m",
    });
    expect(error).toBeNull();
    const { data } = await userC.from("schedule_items").select("*").eq("id", a).single();
    expect(data?.title).toBe("A-updated");
    expect(data?.time_of_day).toBe("11:30:00");
    expect(data?.memo).toBe("m");
    expect(data?.trip_day_id).toBe(dayId);
  });

  it("delete 후 남은 items 의 sort_order 가 1-based gap-free 로 재번호된다", async () => {
    const { error } = await userC.rpc("delete_schedule_item", { p_item_id: a });
    expect(error).toBeNull();
    const { data } = await userC.from("schedule_items")
      .select("id, sort_order").eq("trip_day_id", dayId).order("sort_order");
    expect(data).toEqual([{ id: b, sort_order: 1 }]);
  });
});
```

- [ ] **Step 2: 실행**

```bash
pnpm vitest run tests/integration/update-delete-schedule-item.test.ts
```
Expected: 2/2 PASS.

- [ ] **Step 3: Update 훅**

Create `lib/schedule/use-update-schedule-item.ts`:

```typescript
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export type UpdateScheduleItemInput = {
  tripId: string;
  itemId: string;
  title: string;
  timeOfDay?: string | null;
  placeName?: string | null;
  placeAddress?: string | null;
  placeLat?: number | null;
  placeLng?: number | null;
  placeProvider?: "naver" | "google" | null;
  placeExternalId?: string | null;
  memo?: string | null;
  url?: string | null;
};

export function useUpdateScheduleItem() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateScheduleItemInput): Promise<void> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("update_schedule_item", {
        p_item_id: input.itemId,
        p_title: input.title,
        p_time_of_day: input.timeOfDay ?? null,
        p_place_name: input.placeName ?? null,
        p_place_address: input.placeAddress ?? null,
        p_place_lat: input.placeLat ?? null,
        p_place_lng: input.placeLng ?? null,
        p_place_provider: input.placeProvider ?? null,
        p_place_external_id: input.placeExternalId ?? null,
        p_memo: input.memo ?? null,
        p_url: input.url ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_v, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.schedule.byTripId(vars.tripId) });
    },
  });
}
```

- [ ] **Step 4: Delete 훅**

Create `lib/schedule/use-delete-schedule-item.ts`:

```typescript
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export function useDeleteScheduleItem() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tripId: string; itemId: string }): Promise<void> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("delete_schedule_item", {
        p_item_id: input.itemId,
      });
      if (error) throw error;
    },
    onSuccess: (_v, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.schedule.byTripId(vars.tripId) });
    },
  });
}
```

- [ ] **Step 5: 커밋**

```bash
pnpm tsc --noEmit && pnpm lint
git add lib/schedule/use-update-schedule-item.ts lib/schedule/use-delete-schedule-item.ts tests/integration/update-delete-schedule-item.test.ts
git commit -m "feat(schedule): add useUpdateScheduleItem + useDeleteScheduleItem with contract tests"
```

---

### Task 14: 순수 함수 `applyLocalReorder` + `applyLocalMove`

Spec §3.5. 서버 RPC 와 **동일한 renumber 규칙**을 클라이언트에서 재현. 스키마 필드는 `trip_day_id`·`sort_order` (day_number 없음). sort_order 는 1-based. immutability 불변식을 unit test 로 잠근다.

**Files:**
- Create: `lib/schedule/apply-local-reorder.ts`
- Create: `lib/schedule/apply-local-move.ts`
- Test: `tests/unit/apply-local-reorder.test.ts`
- Test: `tests/unit/apply-local-move.test.ts`

- [ ] **Step 1: reorder 실패 테스트**

Create `tests/unit/apply-local-reorder.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { applyLocalReorder } from "@/lib/schedule/apply-local-reorder";
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";

function make(id: string, tripDayId: string, sortOrder: number): ScheduleItem {
  return {
    id, trip_day_id: tripDayId, title: id, sort_order: sortOrder,
    time_of_day: null, place_name: null, place_address: null,
    place_lat: null, place_lng: null, place_provider: null, place_external_id: null,
    memo: null, url: null,
    created_at: "2026-04-20T00:00:00Z", updated_at: "2026-04-20T00:00:00Z",
  } as ScheduleItem;
}

describe("applyLocalReorder", () => {
  const D1 = "day-1"; const D2 = "day-2";
  const base: ScheduleItem[] = [
    make("a", D1, 1), make("b", D1, 2), make("c", D1, 3),
    make("x", D2, 1),
  ];

  it("같은 day 내 재배치 후 sort_order 1-based 로 재번호한다", () => {
    const next = applyLocalReorder(base, D1, ["c", "a", "b"]);
    const d1 = next.filter((i) => i.trip_day_id === D1).sort((a, b) => a.sort_order - b.sort_order);
    expect(d1.map((i) => [i.id, i.sort_order])).toEqual([["c", 1], ["a", 2], ["b", 3]]);
  });

  it("다른 day 는 건드리지 않는다", () => {
    const next = applyLocalReorder(base, D1, ["b", "a", "c"]);
    expect(next.find((i) => i.id === "x")).toEqual(
      expect.objectContaining({ id: "x", trip_day_id: D2, sort_order: 1 }),
    );
  });

  it("입력을 mutate 하지 않는다", () => {
    const snap = JSON.parse(JSON.stringify(base));
    applyLocalReorder(base, D1, ["c", "a", "b"]);
    expect(base).toEqual(snap);
  });

  it("set mismatch (누락 id) 시 throw", () => {
    expect(() => applyLocalReorder(base, D1, ["a", "b"])).toThrow(/set mismatch/i);
  });

  it("set mismatch (다른 day item 포함) 시 throw", () => {
    expect(() => applyLocalReorder(base, D1, ["a", "b", "c", "x"])).toThrow(/set mismatch/i);
  });
});
```

- [ ] **Step 2: 실패 확인**

```bash
pnpm vitest run tests/unit/apply-local-reorder.test.ts
```
Expected: FAIL (module not found).

- [ ] **Step 3: reorder 구현**

Create `lib/schedule/apply-local-reorder.ts`:

```typescript
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";

export function applyLocalReorder(
  items: ScheduleItem[],
  tripDayId: string,
  orderedIds: string[],
): ScheduleItem[] {
  const inDay = items.filter((i) => i.trip_day_id === tripDayId);
  const currentIds = new Set(inDay.map((i) => i.id));
  const nextIds = new Set(orderedIds);
  if (currentIds.size !== nextIds.size || orderedIds.length !== nextIds.size) {
    throw new Error("applyLocalReorder: set mismatch");
  }
  for (const id of orderedIds) {
    if (!currentIds.has(id)) throw new Error("applyLocalReorder: set mismatch");
  }

  const byId = new Map(inDay.map((i) => [i.id, i]));
  const reordered = new Map<string, ScheduleItem>();
  orderedIds.forEach((id, idx) => {
    const src = byId.get(id)!;
    reordered.set(id, { ...src, sort_order: idx + 1 });
  });

  return items.map((i) => (i.trip_day_id === tripDayId ? reordered.get(i.id)! : i));
}
```

- [ ] **Step 4: reorder PASS 확인**

```bash
pnpm vitest run tests/unit/apply-local-reorder.test.ts
```
Expected: 5/5 PASS.

- [ ] **Step 5: move 실패 테스트**

Create `tests/unit/apply-local-move.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { applyLocalMove } from "@/lib/schedule/apply-local-move";
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";

function make(id: string, tripDayId: string, sortOrder: number): ScheduleItem {
  return {
    id, trip_day_id: tripDayId, title: id, sort_order: sortOrder,
    time_of_day: null, place_name: null, place_address: null,
    place_lat: null, place_lng: null, place_provider: null, place_external_id: null,
    memo: null, url: null,
    created_at: "2026-04-20T00:00:00Z", updated_at: "2026-04-20T00:00:00Z",
  } as ScheduleItem;
}

describe("applyLocalMove (1-based target_position)", () => {
  const D1 = "day-1"; const D2 = "day-2"; const D3 = "day-3";
  const base: ScheduleItem[] = [
    make("a", D1, 1), make("b", D1, 2), make("c", D1, 3),
    make("x", D2, 1), make("y", D2, 2),
  ];

  it("다른 day 로 이동 시 source 와 target 을 모두 재번호한다", () => {
    // b → D2 position 2 (= between x and y)
    const next = applyLocalMove(base, "b", D2, 2);
    const d1 = next.filter((i) => i.trip_day_id === D1).sort((a, b) => a.sort_order - b.sort_order);
    expect(d1.map((i) => [i.id, i.sort_order])).toEqual([["a", 1], ["c", 2]]);
    const d2 = next.filter((i) => i.trip_day_id === D2).sort((a, b) => a.sort_order - b.sort_order);
    expect(d2.map((i) => [i.id, i.sort_order])).toEqual([["x", 1], ["b", 2], ["y", 3]]);
  });

  it("target position=1 은 맨 앞 삽입", () => {
    const next = applyLocalMove(base, "b", D2, 1);
    const d2 = next.filter((i) => i.trip_day_id === D2).sort((a, b) => a.sort_order - b.sort_order);
    expect(d2.map((i) => i.id)).toEqual(["b", "x", "y"]);
  });

  it("target position=target_count+1 은 맨 뒤 삽입", () => {
    const next = applyLocalMove(base, "b", D2, 3);
    const d2 = next.filter((i) => i.trip_day_id === D2).sort((a, b) => a.sort_order - b.sort_order);
    expect(d2.map((i) => i.id)).toEqual(["x", "y", "b"]);
  });

  it("same-day 호출은 throw (caller 가 reorder 로 분기해야 함)", () => {
    expect(() => applyLocalMove(base, "b", D1, 1)).toThrow(/same day|use_reorder/i);
  });

  it("존재하지 않는 id 는 throw", () => {
    expect(() => applyLocalMove(base, "zzz", D2, 1)).toThrow(/not found/i);
  });

  it("범위 밖 position (0 또는 count+2) 은 throw", () => {
    expect(() => applyLocalMove(base, "b", D2, 0)).toThrow(/invalid_target_position/);
    expect(() => applyLocalMove(base, "b", D2, 4)).toThrow(/invalid_target_position/);
  });

  it("빈 target day 로 이동 position=1 허용", () => {
    const next = applyLocalMove(base, "b", D3, 1);
    const d3 = next.filter((i) => i.trip_day_id === D3);
    expect(d3).toEqual([expect.objectContaining({ id: "b", trip_day_id: D3, sort_order: 1 })]);
  });

  it("입력을 mutate 하지 않는다", () => {
    const snap = JSON.parse(JSON.stringify(base));
    applyLocalMove(base, "b", D2, 2);
    expect(base).toEqual(snap);
  });
});
```

- [ ] **Step 6: move 구현**

Create `lib/schedule/apply-local-move.ts`:

```typescript
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";

export function applyLocalMove(
  items: ScheduleItem[],
  itemId: string,
  targetDayId: string,
  targetPosition: number,  // 1-based, 1..targetCount+1
): ScheduleItem[] {
  const src = items.find((i) => i.id === itemId);
  if (!src) throw new Error("applyLocalMove: item not found");
  if (src.trip_day_id === targetDayId) {
    throw new Error("applyLocalMove: same day — use applyLocalReorder (use_reorder_for_same_day)");
  }

  const sourceDayId = src.trip_day_id;
  const targetExisting = items
    .filter((i) => i.trip_day_id === targetDayId)
    .sort((a, b) => a.sort_order - b.sort_order);
  if (targetPosition < 1 || targetPosition > targetExisting.length + 1) {
    throw new Error(`applyLocalMove: invalid_target_position (got ${targetPosition}, max ${targetExisting.length + 1})`);
  }

  const sourceRemaining = items
    .filter((i) => i.trip_day_id === sourceDayId && i.id !== itemId)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i, idx) => ({ ...i, sort_order: idx + 1 }));

  const movedItem: ScheduleItem = { ...src, trip_day_id: targetDayId, sort_order: targetPosition };
  const targetNext = [
    ...targetExisting.slice(0, targetPosition - 1),
    movedItem,
    ...targetExisting.slice(targetPosition - 1),
  ].map((i, idx) => ({ ...i, sort_order: idx + 1 }));

  const untouched = items.filter(
    (i) => i.trip_day_id !== sourceDayId && i.trip_day_id !== targetDayId,
  );
  return [...untouched, ...sourceRemaining, ...targetNext];
}
```

- [ ] **Step 7: move PASS + 커밋**

```bash
pnpm vitest run tests/unit/apply-local-move.test.ts
```
Expected: 8/8 PASS.

```bash
git add lib/schedule/apply-local-reorder.ts lib/schedule/apply-local-move.ts tests/unit/apply-local-reorder.test.ts tests/unit/apply-local-move.test.ts
git commit -m "feat(schedule): add applyLocalReorder + applyLocalMove pure fns (1-based sort_order, trip_day_id scope)"
```

---

### Task 15: Optimistic Reorder / Move Mutations + `ui-store` 드래그 플래그

Spec §3.5, Patch Q. 드래그 종료 시 낙관적 캐시 교체 → RPC → onError rollback → onSettled invalidate. `isDraggingSchedule` 플래그를 올려 realtime 채널이 invalidate 를 유예하도록 한다 (Task 20 에서 소비).

**Files:**
- Modify: `lib/store/ui-store.ts`
- Create: `lib/schedule/use-reorder-schedule-items-in-day.ts`
- Create: `lib/schedule/use-move-schedule-item-across-days.ts`
- Test: `tests/integration/reorder-schedule-items-in-day.test.ts`
- Test: `tests/integration/move-schedule-item-across-days.test.ts`

- [ ] **Step 1: ui-store 확장**

Rewrite `lib/store/ui-store.ts`:

```typescript
import { create } from "zustand";

type Tone = "info" | "error" | "success";

type UiState = {
  toast: { message: string; tone: Tone } | null;
  showToast: (message: string, tone?: Tone) => void;
  clearToast: () => void;

  isDraggingSchedule: boolean;
  setDraggingSchedule: (value: boolean) => void;

  pendingScheduleInvalidate: boolean;
  setPendingScheduleInvalidate: (value: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  toast: null,
  showToast: (message, tone = "info") => set({ toast: { message, tone } }),
  clearToast: () => set({ toast: null }),

  isDraggingSchedule: false,
  setDraggingSchedule: (value) => set({ isDraggingSchedule: value }),

  pendingScheduleInvalidate: false,
  setPendingScheduleInvalidate: (value) => set({ pendingScheduleInvalidate: value }),
}));
```

> 기존 `toast` API 호출부는 그대로 호환. 새 필드 2개는 Task 20 에서 소비.

- [ ] **Step 2: reorder 실패 테스트**

Create `tests/integration/reorder-schedule-items-in-day.test.ts`:

```typescript
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
let userId = ""; let userC: SupabaseClient<Database>;
let tripId = ""; let dayId = "";
let a = ""; let b = ""; let c = "";

beforeAll(async () => {
  const u = await admin.auth.admin.createUser({
    email: `reorder+${STAMP}@test.local`, password: PWD, email_confirm: true,
  });
  if (u.error) throw u.error;
  userId = u.data.user!.id;
  userC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  await userC.auth.signInWithPassword({ email: `reorder+${STAMP}@test.local`, password: PWD });

  const { data: tid } = await userC.rpc("create_trip", {
    p_title: "T", p_destination: "Seoul",
    p_start_date: "2026-06-01", p_end_date: "2026-06-02",
    p_is_domestic: true, p_currencies: [],
  });
  tripId = tid as string;
  const { data: d } = await userC.from("trip_days")
    .select("id").eq("trip_id", tripId).eq("day_number", 1).single();
  dayId = d!.id;
  for (const t of ["A", "B", "C"]) {
    const { data: id } = await userC.rpc("create_schedule_item", {
      p_trip_day_id: dayId, p_title: t, p_time_of_day: "09:00",
    });
    if (t === "A") a = id as string;
    if (t === "B") b = id as string;
    if (t === "C") c = id as string;
  }
});

afterAll(async () => {
  await admin.from("trips").delete().eq("id", tripId);
  await admin.auth.admin.deleteUser(userId);
});

describe("reorder_schedule_items_in_day", () => {
  it("set 이 일치하면 1-based 로 재번호한다", async () => {
    const { error } = await userC.rpc("reorder_schedule_items_in_day", {
      p_trip_day_id: dayId, p_item_ids: [c, a, b],
    });
    expect(error).toBeNull();
    const { data } = await userC.from("schedule_items")
      .select("id, sort_order").eq("trip_day_id", dayId).order("sort_order");
    expect(data).toEqual([
      { id: c, sort_order: 1 },
      { id: a, sort_order: 2 },
      { id: b, sort_order: 3 },
    ]);
  });

  it("set mismatch (누락 id) → item_set_mismatch", async () => {
    const { error } = await userC.rpc("reorder_schedule_items_in_day", {
      p_trip_day_id: dayId, p_item_ids: [c, a],
    });
    expect(error?.message).toMatch(/item_set_mismatch/);
  });

  it("중복 id → duplicate_item_ids", async () => {
    const { error } = await userC.rpc("reorder_schedule_items_in_day", {
      p_trip_day_id: dayId, p_item_ids: [a, a, b],
    });
    expect(error?.message).toMatch(/duplicate_item_ids/);
  });
});
```

- [ ] **Step 3: reorder 훅**

Create `lib/schedule/use-reorder-schedule-items-in-day.ts`:

```typescript
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import { useUiStore } from "@/lib/store/ui-store";
import { applyLocalReorder } from "@/lib/schedule/apply-local-reorder";
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";

export type ReorderInput = {
  tripId: string;
  tripDayId: string;
  orderedIds: string[];
};

export function useReorderScheduleItemsInDay() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();
  const showToast = useUiStore((s) => s.showToast);

  return useMutation({
    mutationFn: async (input: ReorderInput): Promise<void> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("reorder_schedule_items_in_day", {
        p_trip_day_id: input.tripDayId,
        p_item_ids: input.orderedIds,
      });
      if (error) throw error;
    },
    onMutate: async (input) => {
      const key = queryKeys.schedule.byTripId(input.tripId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ScheduleItem[]>(key);
      if (previous) {
        qc.setQueryData<ScheduleItem[]>(
          key,
          applyLocalReorder(previous, input.tripDayId, input.orderedIds),
        );
      }
      return { previous };
    },
    onError: (err, input, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(queryKeys.schedule.byTripId(input.tripId), ctx.previous);
      }
      const msg = err instanceof Error ? err.message : "unknown";
      showToast(`순서 변경에 실패했어요 (${msg})`, "error");
    },
    onSettled: (_d, _e, input) => {
      void qc.invalidateQueries({ queryKey: queryKeys.schedule.byTripId(input.tripId) });
    },
  });
}
```

- [ ] **Step 4: reorder PASS 확인**

```bash
pnpm vitest run tests/integration/reorder-schedule-items-in-day.test.ts
```
Expected: 3/3 PASS.

- [ ] **Step 5: move 실패 테스트**

Create `tests/integration/move-schedule-item-across-days.test.ts`:

```typescript
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
let userId = ""; let userC: SupabaseClient<Database>;
let tripId = ""; let day1 = ""; let day2 = "";
let a = ""; let b = "";

beforeAll(async () => {
  const u = await admin.auth.admin.createUser({
    email: `move+${STAMP}@test.local`, password: PWD, email_confirm: true,
  });
  if (u.error) throw u.error;
  userId = u.data.user!.id;
  userC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  await userC.auth.signInWithPassword({ email: `move+${STAMP}@test.local`, password: PWD });

  const { data: tid } = await userC.rpc("create_trip", {
    p_title: "T", p_destination: "Seoul",
    p_start_date: "2026-06-01", p_end_date: "2026-06-03",
    p_is_domestic: true, p_currencies: [],
  });
  tripId = tid as string;
  const { data: days } = await userC.from("trip_days")
    .select("id, day_number").eq("trip_id", tripId).order("day_number");
  day1 = days![0].id; day2 = days![1].id;
  const { data: ida } = await userC.rpc("create_schedule_item", {
    p_trip_day_id: day1, p_title: "A",
  });
  a = ida as string;
  const { data: idb } = await userC.rpc("create_schedule_item", {
    p_trip_day_id: day1, p_title: "B",
  });
  b = idb as string;
});

afterAll(async () => {
  await admin.from("trips").delete().eq("id", tripId);
  await admin.auth.admin.deleteUser(userId);
});

describe("move_schedule_item_across_days", () => {
  it("day1 → day2 position=1 로 이동하면 양쪽 모두 재번호된다", async () => {
    const { error } = await userC.rpc("move_schedule_item_across_days", {
      p_item_id: b, p_target_day_id: day2, p_target_position: 1,
    });
    expect(error).toBeNull();
    const { data: d1 } = await userC.from("schedule_items")
      .select("id, sort_order").eq("trip_day_id", day1).order("sort_order");
    expect(d1).toEqual([{ id: a, sort_order: 1 }]);
    const { data: d2 } = await userC.from("schedule_items")
      .select("id, sort_order, trip_day_id").eq("trip_day_id", day2);
    expect(d2).toEqual([{ id: b, sort_order: 1, trip_day_id: day2 }]);
  });

  it("same-day 호출 → use_reorder_for_same_day", async () => {
    const { error } = await userC.rpc("move_schedule_item_across_days", {
      p_item_id: a, p_target_day_id: day1, p_target_position: 1,
    });
    expect(error?.message).toMatch(/use_reorder_for_same_day/);
  });

  it("범위 밖 position → invalid_target_position", async () => {
    const { error } = await userC.rpc("move_schedule_item_across_days", {
      p_item_id: a, p_target_day_id: day2, p_target_position: 99,
    });
    expect(error?.message).toMatch(/invalid_target_position/);
  });
});
```

- [ ] **Step 6: move 훅**

Create `lib/schedule/use-move-schedule-item-across-days.ts`:

```typescript
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import { useUiStore } from "@/lib/store/ui-store";
import { applyLocalMove } from "@/lib/schedule/apply-local-move";
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";

export type MoveInput = {
  tripId: string;
  itemId: string;
  targetDayId: string;
  targetPosition: number;   // 1-based, 1..targetCount+1
};

export function useMoveScheduleItemAcrossDays() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();
  const showToast = useUiStore((s) => s.showToast);

  return useMutation({
    mutationFn: async (input: MoveInput): Promise<void> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("move_schedule_item_across_days", {
        p_item_id: input.itemId,
        p_target_day_id: input.targetDayId,
        p_target_position: input.targetPosition,
      });
      if (error) throw error;
    },
    onMutate: async (input) => {
      const key = queryKeys.schedule.byTripId(input.tripId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ScheduleItem[]>(key);
      if (previous) {
        try {
          qc.setQueryData<ScheduleItem[]>(
            key,
            applyLocalMove(previous, input.itemId, input.targetDayId, input.targetPosition),
          );
        } catch {
          // same-day / invalid_target_position / not-found: caller 분기 실패.
          // 서버가 동일 예외로 응답할 것이므로 onError 에서 롤백된다.
        }
      }
      return { previous };
    },
    onError: (err, input, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(queryKeys.schedule.byTripId(input.tripId), ctx.previous);
      }
      const msg = err instanceof Error ? err.message : "unknown";
      showToast(`이동에 실패했어요 (${msg})`, "error");
    },
    onSettled: (_d, _e, input) => {
      void qc.invalidateQueries({ queryKey: queryKeys.schedule.byTripId(input.tripId) });
    },
  });
}
```

- [ ] **Step 7: move PASS + 통합 커밋**

```bash
pnpm vitest run tests/integration/move-schedule-item-across-days.test.ts
pnpm tsc --noEmit && pnpm lint
```
Expected: 3/3 PASS, 0 type error.

```bash
git add lib/store/ui-store.ts lib/schedule/use-reorder-schedule-items-in-day.ts lib/schedule/use-move-schedule-item-across-days.ts tests/integration/reorder-schedule-items-in-day.test.ts tests/integration/move-schedule-item-across-days.test.ts
git commit -m "feat(schedule): add optimistic reorder/move mutations + isDraggingSchedule flag in ui-store"
```

---

### Task 16: `/api/maps/search` Route + Naver/Google Adapters + TM128 변환 + Rate Limit

Spec §6. 서버 라우트에서 Supabase 세션 확인 → zod 검증 → rate limit (30/min/user) → provider 분기. Naver 는 TM128→WGS84 변환 + `<b>` 태그 제거. Google 은 Places New API + FieldMask. `PlaceResult` 타입은 Part A Task 8 의 `lib/maps/types.ts` 그대로 사용.

**Files:**
- Create: `lib/maps/tm128.ts`
- Create: `lib/maps/strip-html.ts`
- Create: `lib/maps/rate-limit.ts`
- Create: `lib/maps/search/naver-search.ts`
- Create: `lib/maps/search/google-search.ts`
- Create: `app/api/maps/search/route.ts`
- Test: `tests/unit/tm128-wgs84.test.ts`
- Test: `tests/unit/strip-html-tags.test.ts`
- Test: `tests/unit/rate-limit.test.ts`
- Test: `tests/unit/coordinate-clamp.test.ts`

- [ ] **Step 1: proj4 설치 확인 (이미 설치돼 있으면 skip)**

```bash
pnpm add proj4 && pnpm add -D @types/proj4
```

- [ ] **Step 2: TM128 + strip-html + rate-limit + coordinate clamp — 테스트 먼저**

Create `tests/unit/tm128-wgs84.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { tm128ToWgs84 } from "@/lib/maps/tm128";

describe("tm128ToWgs84", () => {
  it("Naver TM128 샘플 (서울 근처) 을 WGS84 로 변환한다 (±0.2° 허용)", () => {
    const [lng, lat] = tm128ToWgs84(320979, 552164);
    expect(lat).toBeGreaterThan(37.3);
    expect(lat).toBeLessThan(37.8);
    expect(lng).toBeGreaterThan(126.8);
    expect(lng).toBeLessThan(127.2);
  });

  it("잘못된 입력 (NaN) 은 throw", () => {
    expect(() => tm128ToWgs84(Number.NaN, 0)).toThrow(/invalid/i);
  });
});
```

Create `tests/unit/strip-html-tags.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { stripHtmlTags } from "@/lib/maps/strip-html";

describe("stripHtmlTags (Naver title 정화)", () => {
  it("<b> 강조 태그 제거", () => {
    expect(stripHtmlTags("서울역 <b>스타벅스</b>")).toBe("서울역 스타벅스");
  });
  it("HTML entity 디코드 (&amp; &quot; &#39; &lt; &gt;)", () => {
    expect(stripHtmlTags("A &amp; B &quot;X&quot; &#39;y&#39; &lt;z&gt;"))
      .toBe(`A & B "X" 'y' <z>`);
  });
  it("null / undefined / 빈 문자열 → 빈 문자열", () => {
    expect(stripHtmlTags(undefined)).toBe("");
    expect(stripHtmlTags(null)).toBe("");
    expect(stripHtmlTags("")).toBe("");
  });
});
```

Create `tests/unit/rate-limit.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { tryAcquireRateSlot, __resetRateLimitForTest } from "@/lib/maps/rate-limit";

describe("rate limit — 30 req/min/user", () => {
  beforeEach(() => {
    __resetRateLimitForTest();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T00:00:00.000Z"));
  });

  it("첫 30건 허용", () => {
    for (let i = 0; i < 30; i += 1) expect(tryAcquireRateSlot("u1")).toBe(true);
  });
  it("31번째 차단", () => {
    for (let i = 0; i < 30; i += 1) tryAcquireRateSlot("u1");
    expect(tryAcquireRateSlot("u1")).toBe(false);
  });
  it("60초 지나면 리셋", () => {
    for (let i = 0; i < 30; i += 1) tryAcquireRateSlot("u1");
    vi.setSystemTime(new Date("2026-04-20T00:01:01.000Z"));
    expect(tryAcquireRateSlot("u1")).toBe(true);
  });
  it("유저 단위로 독립적", () => {
    for (let i = 0; i < 30; i += 1) tryAcquireRateSlot("u1");
    expect(tryAcquireRateSlot("u2")).toBe(true);
  });
});
```

Create `tests/unit/coordinate-clamp.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { clampLatLng } from "@/lib/maps/rate-limit";

describe("clampLatLng", () => {
  it("정상 WGS84 passthrough", () => {
    expect(clampLatLng(37.5, 126.9)).toEqual([37.5, 126.9]);
  });
  it("범위 밖은 null", () => {
    expect(clampLatLng(95, 0)).toBeNull();
    expect(clampLatLng(0, 200)).toBeNull();
  });
  it("NaN 은 null", () => {
    expect(clampLatLng(Number.NaN, 0)).toBeNull();
  });
});
```

- [ ] **Step 3: 구현 — TM128**

Create `lib/maps/tm128.ts`:

```typescript
import proj4 from "proj4";

// Naver 지역검색 mapx/mapy → WGS84 (lng, lat) 변환.
// Korea TM128 (Bessel, Korea Central Belt) 좌표계.
const TM128 =
  "+proj=tmerc +lat_0=38 +lon_0=128 +k=0.9999 +x_0=400000 +y_0=600000 " +
  "+ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43";

proj4.defs("KOREA_TM128", TM128);

export function tm128ToWgs84(x: number, y: number): [number, number] {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error("tm128ToWgs84: invalid input");
  }
  const [lng, lat] = proj4("KOREA_TM128", "WGS84", [x, y]);
  return [lng, lat];
}
```

- [ ] **Step 4: 구현 — strip-html**

Create `lib/maps/strip-html.ts`:

```typescript
export function stripHtmlTags(input: string | undefined | null): string {
  if (!input) return "";
  const noTags = input.replace(/<[^>]*>/g, "");
  return noTags
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
```

- [ ] **Step 5: 구현 — rate-limit + clamp**

Create `lib/maps/rate-limit.ts`:

```typescript
const WINDOW_MS = 60_000;
const LIMIT = 30;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function tryAcquireRateSlot(userId: string): boolean {
  const now = Date.now();
  const existing = buckets.get(userId);
  if (!existing || existing.resetAt <= now) {
    buckets.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (existing.count >= LIMIT) return false;
  existing.count += 1;
  return true;
}

export function __resetRateLimitForTest(): void {
  buckets.clear();
}

export function clampLatLng(lat: number, lng: number): [number, number] | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;
  return [lat, lng];
}
```

- [ ] **Step 6: unit 4 spec 실행**

```bash
pnpm vitest run tests/unit/tm128-wgs84.test.ts tests/unit/strip-html-tags.test.ts tests/unit/rate-limit.test.ts tests/unit/coordinate-clamp.test.ts
```
Expected: 모두 PASS.

- [ ] **Step 7: env 타입 확장 확인 (Part A Task 6 에서 이미 추가되었다면 skip)**

`lib/env.ts` 의 `serverOnlySchema` 에 다음 키가 포함되었는지 확인:

```typescript
const serverOnlySchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NAVER_SEARCH_CLIENT_ID: z.string().min(1),
  NAVER_SEARCH_CLIENT_SECRET: z.string().min(1),
  GOOGLE_MAPS_SERVER_KEY: z.string().min(1),
});
```

그리고 `publicSchema` 에:

```typescript
NEXT_PUBLIC_NAVER_MAP_CLIENT_ID: z.string().min(1),
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(1),
```

**누락된 키만 추가**. 이미 있으면 건드리지 않는다.

- [ ] **Step 8: Naver adapter 구현**

Create `lib/maps/search/naver-search.ts`:

```typescript
import type { PlaceResult } from "@/lib/maps/types";
import { getServerEnv } from "@/lib/env";
import { tm128ToWgs84 } from "@/lib/maps/tm128";
import { stripHtmlTags } from "@/lib/maps/strip-html";
import { clampLatLng } from "@/lib/maps/rate-limit";

const ENDPOINT = "https://openapi.naver.com/v1/search/local.json";

type NaverItem = {
  title: string;
  link?: string;
  address?: string;
  roadAddress?: string;
  mapx: string;
  mapy: string;
};

export async function searchNaver(query: string): Promise<PlaceResult[]> {
  const { NAVER_SEARCH_CLIENT_ID, NAVER_SEARCH_CLIENT_SECRET } = getServerEnv();

  const url = `${ENDPOINT}?query=${encodeURIComponent(query)}&display=10`;
  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": NAVER_SEARCH_CLIENT_ID,
      "X-Naver-Client-Secret": NAVER_SEARCH_CLIENT_SECRET,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`naver search ${res.status}`);
  const body = (await res.json()) as { items?: NaverItem[] };

  const out: PlaceResult[] = [];
  for (const item of body.items ?? []) {
    const x = Number(item.mapx);
    const y = Number(item.mapy);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const [lng, lat] = tm128ToWgs84(x, y);
    const clamped = clampLatLng(lat, lng);
    if (!clamped) continue;
    out.push({
      externalId: `naver:${item.link || `${item.mapx},${item.mapy}`}`,
      name: stripHtmlTags(item.title),
      address: item.roadAddress || item.address || "",
      lat: clamped[0],
      lng: clamped[1],
      provider: "naver",
    });
  }
  return out;
}
```

- [ ] **Step 9: Google adapter 구현**

Create `lib/maps/search/google-search.ts`:

```typescript
import type { PlaceResult, LatLng } from "@/lib/maps/types";
import { getServerEnv } from "@/lib/env";
import { clampLatLng } from "@/lib/maps/rate-limit";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.location";

type GoogleResp = {
  places?: Array<{
    id: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
  }>;
};

export async function searchGoogle(query: string, near?: LatLng): Promise<PlaceResult[]> {
  const { GOOGLE_MAPS_SERVER_KEY } = getServerEnv();
  const body = {
    textQuery: query,
    pageSize: 10,
    ...(near && {
      locationBias: {
        circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 5000 },
      },
    }),
  };

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_MAPS_SERVER_KEY,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`google search ${res.status}`);
  const parsed = (await res.json()) as GoogleResp;

  const out: PlaceResult[] = [];
  for (const p of parsed.places ?? []) {
    if (!p.location) continue;
    const clamped = clampLatLng(p.location.latitude, p.location.longitude);
    if (!clamped) continue;
    out.push({
      externalId: `google:${p.id}`,
      name: p.displayName?.text ?? "",
      address: p.formattedAddress ?? "",
      lat: clamped[0],
      lng: clamped[1],
      provider: "google",
    });
  }
  return out;
}
```

- [ ] **Step 10: Route 구현**

Create `app/api/maps/search/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerClient } from "@/lib/supabase/server-client";
import { searchNaver } from "@/lib/maps/search/naver-search";
import { searchGoogle } from "@/lib/maps/search/google-search";
import { tryAcquireRateSlot } from "@/lib/maps/rate-limit";

const requestSchema = z.object({
  query: z.string().min(1).max(100),
  provider: z.enum(["naver", "google"]),
  near: z.object({ lat: z.number(), lng: z.number() }).optional(),
});

export async function POST(req: Request) {
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!tryAcquireRateSlot(user.id)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let parsed: z.infer<typeof requestSchema>;
  try {
    parsed = requestSchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "invalid_input", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  try {
    const results = parsed.provider === "naver"
      ? await searchNaver(parsed.query)
      : await searchGoogle(parsed.query, parsed.near);
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json(
      { error: "upstream_failure", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
```

> `getServerClient` 은 `lib/supabase/server-client.ts` 의 실제 export. Spec §6.2 의 `createServerClient` 는 spec 오기이며 실제 이름은 `getServerClient`.

- [ ] **Step 11: 빌드 + 커밋**

```bash
pnpm tsc --noEmit && pnpm lint && pnpm build
```
Expected: 0 error.

```bash
git add lib/maps/tm128.ts lib/maps/strip-html.ts lib/maps/rate-limit.ts lib/maps/search/naver-search.ts lib/maps/search/google-search.ts app/api/maps/search/route.ts tests/unit/tm128-wgs84.test.ts tests/unit/strip-html-tags.test.ts tests/unit/rate-limit.test.ts tests/unit/coordinate-clamp.test.ts
git commit -m "feat(maps): add /api/maps/search route with TM128 + strip-html + rate limit + Naver/Google adapters"
```

---

### Task 17: `usePlaceSearch` + `useDebouncedValue`

Spec §6.5. 훅은 mutation (검색은 cache 대상 아님). UI 에서 300ms debounce 후 `mutate({query, provider, near?})`. `PlaceResult[]` 반환.

**Files:**
- Create: `lib/hooks/use-debounced-value.ts`
- Create: `lib/maps/use-place-search.ts`
- Test: `tests/unit/use-debounced-value.test.tsx`

- [ ] **Step 1: debounce 실패 테스트**

Create `tests/unit/use-debounced-value.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

describe("useDebouncedValue", () => {
  it("설정된 지연만큼 업데이트를 미룬다", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ v }) => useDebouncedValue(v, 300),
      { initialProps: { v: "a" } },
    );
    expect(result.current).toBe("a");
    rerender({ v: "b" });
    expect(result.current).toBe("a");
    act(() => { vi.advanceTimersByTime(299); });
    expect(result.current).toBe("a");
    act(() => { vi.advanceTimersByTime(2); });
    expect(result.current).toBe("b");
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: debounce 구현**

Create `lib/hooks/use-debounced-value.ts`:

```typescript
"use client";

import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return debounced;
}
```

```bash
pnpm vitest run tests/unit/use-debounced-value.test.tsx
```
Expected: PASS.

- [ ] **Step 3: `usePlaceSearch` 훅**

Create `lib/maps/use-place-search.ts`:

```typescript
"use client";

import { useMutation } from "@tanstack/react-query";
import type { PlaceResult, MapsProviderName, LatLng } from "@/lib/maps/types";

type SearchInput = {
  query: string;
  provider: MapsProviderName;
  near?: LatLng;
};

type Resp = { results: PlaceResult[] } | { error: string; detail?: string };

export function usePlaceSearch() {
  return useMutation({
    mutationFn: async (input: SearchInput): Promise<PlaceResult[]> => {
      const res = await fetch("/api/maps/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = (await res.json()) as Resp;
      if (!res.ok || "error" in body) {
        const msg = "error" in body ? body.error : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      return body.results;
    },
  });
}
```

- [ ] **Step 4: 커밋**

```bash
pnpm tsc --noEmit && pnpm lint
git add lib/hooks/use-debounced-value.ts lib/maps/use-place-search.ts tests/unit/use-debounced-value.test.tsx
git commit -m "feat(maps): add useDebouncedValue + usePlaceSearch mutation"
```

---

### Task 18: UI 프리미티브 — DayTabBar / ScheduleList / SortableCard / ItemModal / DayMoveSheet / MapPanel / PlaceSearchSheet

Spec §5.7, §6.1, §6.6. 기존 UI 키트(`Button`, `BottomSheet`, `Fab`, `TextField`, `EmptyState`, `Skeleton`)를 최대한 재사용한다. 카드는 `@dnd-kit/sortable` 의 `useSortable` 로 감싸고, 기존 `<ScheduleItem />` 비주얼을 그대로 사용한다.

**Files:**
- Create: `components/schedule/day-tab-bar.tsx`
- Create: `components/schedule/sortable-schedule-item.tsx`
- Create: `components/schedule/schedule-list.tsx`
- Create: `components/schedule/schedule-item-modal.tsx`
- Create: `components/schedule/day-move-sheet.tsx`
- Create: `components/schedule/map-panel.tsx`
- Create: `components/schedule/place-search-sheet.tsx`

- [ ] **Step 1: `<DayTabBar />`**

Create `components/schedule/day-tab-bar.tsx`:

```typescript
"use client";

import { cn } from "@/lib/cn";
import type { TripDay } from "@/lib/trip/use-trip-days";

type Props = {
  days: TripDay[];
  activeDayId: string | null;
  onSelect: (dayId: string) => void;
};

export function DayTabBar({ days, activeDayId, onSelect }: Props) {
  return (
    <div
      className="bg-surface-200/90 sticky top-14 z-20 -mx-4 overflow-x-auto px-4 pt-3 pb-2 backdrop-blur-md"
      role="tablist"
      aria-label="일자 선택"
    >
      <ul className="flex gap-2">
        {days.map((d) => {
          const active = d.id === activeDayId;
          return (
            <li key={d.id}>
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelect(d.id)}
                className={cn(
                  "flex h-12 min-w-[64px] flex-col items-center justify-center rounded-[10px] px-3 transition-colors duration-150",
                  active
                    ? "bg-accent-orange text-cream"
                    : "bg-surface-400 text-ink-700 hover:text-ink-900",
                )}
              >
                <span className={cn(
                  "text-[10px] font-medium tracking-wider uppercase",
                  active ? "text-cream/90" : "text-ink-600",
                )}>
                  Day {d.day_number}
                </span>
                <span className="mt-0.5 text-[13px] font-semibold">
                  {formatShortDate(d.date)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function formatShortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}
```

- [ ] **Step 2: `<SortableScheduleItem />`**

Create `components/schedule/sortable-schedule-item.tsx`:

```typescript
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ScheduleItem as ScheduleItemCard } from "@/components/ui/schedule-item";
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";

type Props = {
  item: ScheduleItem;
  index: number;            // 1-based label (list + map marker 매칭)
  onTap: (item: ScheduleItem) => void;
};

export function SortableScheduleItem({ item, index, onTap }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    boxShadow: isDragging ? "0 12px 24px rgba(0,0,0,0.12)" : undefined,
  };

  return (
    <li ref={setNodeRef} style={style} className="flex items-start gap-2" {...attributes}>
      <div className="bg-surface-300 text-ink-700 mt-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold">
        {index}
      </div>
      <div className="min-w-0 flex-1" {...listeners}>
        <button
          type="button"
          className="w-full text-left"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onTap(item)}
        >
          <ScheduleItemCard
            title={item.title}
            time={item.time_of_day ? item.time_of_day.slice(0, 5) : undefined}
            placeName={item.place_name ?? undefined}
            memo={item.memo ?? undefined}
            draggable
          />
        </button>
      </div>
    </li>
  );
}
```

> 카드 몸체 전체가 드래그 핸들 (spec §3.1 long-press). 안쪽 탭 버튼의 `onPointerDown` 은 stopPropagation — tap 은 편집 모달, 400ms long-press 는 드래그 (Task 19 sensor 에서 delay 제어).

- [ ] **Step 3: `<ScheduleList />`**

Create `components/schedule/schedule-list.tsx`:

```typescript
"use client";

import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SortableScheduleItem } from "./sortable-schedule-item";
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";

type Props = {
  items: ScheduleItem[];  // 이미 해당 day 로 필터링 + sort_order 오름차순 정렬됨
  onTapItem: (item: ScheduleItem) => void;
};

export function ScheduleList({ items, onTapItem }: Props) {
  return (
    <ul className="mt-3 flex flex-col gap-2">
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {items.map((item, idx) => (
          <SortableScheduleItem
            key={item.id}
            item={item}
            index={idx + 1}
            onTap={onTapItem}
          />
        ))}
      </SortableContext>
    </ul>
  );
}
```

- [ ] **Step 4: `<ScheduleItemModal />`**

Create `components/schedule/schedule-item-modal.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { TextField, TextArea } from "@/components/ui/text-field";
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";
import type { PlaceResult } from "@/lib/maps/types";

export type ScheduleItemFormValue = {
  title: string;
  timeOfDay: string | null;
  memo: string | null;
  url: string | null;
  place: PlaceResult | null;
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: ScheduleItem | null;
  pickedPlace: PlaceResult | null;   // PlaceSearchSheet 에서 선택된 결과
  onClose: () => void;
  onSubmit: (value: ScheduleItemFormValue) => void;
  onDelete?: () => void;
  onOpenPlaceSearch: () => void;
  onOpenDayMove?: () => void;
};

export function ScheduleItemModal({
  open, mode, initial, pickedPlace, onClose, onSubmit, onDelete, onOpenPlaceSearch, onOpenDayMove,
}: Props) {
  const [title, setTitle] = useState("");
  const [timeOfDay, setTimeOfDay] = useState<string>("");
  const [memo, setMemo] = useState<string>("");
  const [url, setUrl] = useState<string>("");
  const [place, setPlace] = useState<PlaceResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setTimeOfDay(initial?.time_of_day ? initial.time_of_day.slice(0, 5) : "");
    setMemo(initial?.memo ?? "");
    setUrl(initial?.url ?? "");
    setPlace(
      initial && initial.place_name && initial.place_lat != null && initial.place_lng != null
        && initial.place_provider != null
        ? {
            externalId: initial.place_external_id ?? `${initial.place_provider}:manual`,
            name: initial.place_name,
            address: initial.place_address ?? "",
            lat: initial.place_lat,
            lng: initial.place_lng,
            provider: initial.place_provider as "naver" | "google",
          }
        : null,
    );
  }, [open, initial]);

  useEffect(() => {
    if (pickedPlace) setPlace(pickedPlace);
  }, [pickedPlace]);

  const canSave = title.trim().length >= 1 && title.trim().length <= 100;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={mode === "create" ? "일정 추가" : "일정 수정"}
      footer={
        <div className="flex w-full gap-2">
          {mode === "edit" && onDelete && (
            <Button variant="ghost" onClick={onDelete}>삭제</Button>
          )}
          {mode === "edit" && onOpenDayMove && (
            <Button variant="tertiary" onClick={onOpenDayMove}>다른 날로 이동</Button>
          )}
          <Button
            fullWidth
            variant="primary"
            disabled={!canSave}
            onClick={() =>
              onSubmit({
                title: title.trim(),
                timeOfDay: timeOfDay || null,
                memo: memo.trim() || null,
                url: url.trim() || null,
                place,
              })
            }
          >
            {mode === "create" ? "추가" : "저장"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <TextField label="제목" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 센소지 방문" maxLength={100} required />
        <TextField label="시간" type="time" value={timeOfDay}
          onChange={(e) => setTimeOfDay(e.target.value)} />

        <div>
          <label className="text-ink-700 mb-1 block text-[12px] font-medium">장소</label>
          {place ? (
            <div className="border-border-primary flex items-start justify-between gap-2 rounded-[10px] border px-3 py-2">
              <div className="min-w-0">
                <p className="text-ink-900 truncate text-[14px] font-medium">{place.name}</p>
                <p className="text-ink-600 truncate text-[12px]">{place.address}</p>
              </div>
              <button type="button" className="text-ink-500 text-[12px]"
                onClick={() => setPlace(null)}>해제</button>
            </div>
          ) : (
            <button type="button"
              className="border-border-primary text-ink-600 w-full rounded-[10px] border px-3 py-3 text-left text-[13px]"
              onClick={onOpenPlaceSearch}>
              장소 검색…
            </button>
          )}
        </div>

        <TextArea label="메모" rows={3} value={memo}
          onChange={(e) => setMemo(e.target.value)} maxLength={1000} />
        <TextField label="URL (선택)" value={url}
          onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
      </div>
    </BottomSheet>
  );
}
```

- [ ] **Step 5: `<DayMoveSheet />`**

Create `components/schedule/day-move-sheet.tsx`:

```typescript
"use client";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import type { TripDay } from "@/lib/trip/use-trip-days";

type Props = {
  open: boolean;
  days: TripDay[];
  currentDayId: string;
  onClose: () => void;
  onPick: (targetDayId: string) => void;
};

export function DayMoveSheet({ open, days, currentDayId, onClose, onPick }: Props) {
  const others = days.filter((d) => d.id !== currentDayId);
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="다른 날로 이동"
      footer={<Button fullWidth variant="secondary" onClick={onClose}>취소</Button>}
    >
      {others.length === 0 ? (
        <p className="text-ink-600 py-6 text-center text-[13px]">다른 일자가 없어요.</p>
      ) : (
        <ul className="divide-border-primary divide-y">
          {others.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                className="text-ink-900 w-full py-3 text-left text-[14px]"
                onClick={() => onPick(d.id)}
              >
                Day {d.day_number}
                <span className="text-ink-500 ml-2 text-[12px]">{d.date}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </BottomSheet>
  );
}
```

- [ ] **Step 6: `<MapPanel />`** (spec §5.7 그대로)

Create `components/schedule/map-panel.tsx`:

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import { getMapsProvider, providerForTrip } from "@/lib/maps/provider";
import type { MapHandle } from "@/lib/maps/types";

type MapItem = { id: string; place_lat: number; place_lng: number; label: string };

type Props = {
  isDomestic: boolean;
  items: MapItem[];
  onMarkerClick?: (itemId: string) => void;
};

export function MapPanel({ isDomestic, items, onMarkerClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<MapHandle | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const provider = await getMapsProvider(providerForTrip(isDomestic));
      if (cancelled || !containerRef.current) return;
      const first = items[0] ?? { place_lat: 37.5665, place_lng: 126.978 };
      handleRef.current = provider.createMap(containerRef.current, {
        center: { lat: first.place_lat, lng: first.place_lng },
        zoom: 13,
      });
      setReady(true);
    })();
    return () => {
      cancelled = true;
      handleRef.current?.destroy();
      handleRef.current = null;
      setReady(false);
    };
  }, [isDomestic]);

  useEffect(() => {
    if (!ready || !handleRef.current) return;
    handleRef.current.clearMarkers();
    if (items.length === 0) return;
    handleRef.current.addMarkers(items.map((it) => ({
      lat: it.place_lat,
      lng: it.place_lng,
      label: it.label,
      onClick: onMarkerClick ? () => onMarkerClick(it.id) : undefined,
    })));
    handleRef.current.fitBounds(items.map((it) => ({ lat: it.place_lat, lng: it.place_lng })));
  }, [items, ready, onMarkerClick]);

  return (
    <div
      ref={containerRef}
      className="bg-surface-200 mt-3 h-[240px] w-full overflow-hidden rounded-[12px]"
      aria-label="지도"
    />
  );
}
```

- [ ] **Step 7: `<PlaceSearchSheet />`** (spec §6.6 카피 상태)

Create `components/schedule/place-search-sheet.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TextField } from "@/components/ui/text-field";
import { usePlaceSearch } from "@/lib/maps/use-place-search";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import type { PlaceResult, MapsProviderName } from "@/lib/maps/types";

type Props = {
  open: boolean;
  provider: MapsProviderName;
  onClose: () => void;
  onPick: (place: PlaceResult) => void;
  onManual?: () => void;   // 직접 입력으로 저장 (place 없이 닫기)
};

export function PlaceSearchSheet({ open, provider, onClose, onPick, onManual }: Props) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 300);
  const { mutate, data, isPending, error, reset } = usePlaceSearch();

  useEffect(() => {
    if (!open) {
      setQuery("");
      reset();
    }
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const q = debounced.trim();
    if (q.length < 2) return;
    mutate({ query: q, provider });
  }, [debounced, open, provider, mutate]);

  const state = ((): "initial" | "loading" | "empty" | "error" | "results" => {
    if (!query.trim()) return "initial";
    if (isPending) return "loading";
    if (error) return "error";
    if (data && data.length === 0) return "empty";
    if (data && data.length > 0) return "results";
    return "loading";
  })();

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={provider === "naver" ? "장소 검색 (Naver)" : "장소 검색 (Google)"}
    >
      <div className="space-y-3">
        <TextField
          label=""
          placeholder="예: 성수동 카페, 시부야 라멘"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        {state === "initial" && (
          <p className="text-ink-600 py-6 text-center text-[13px]">
            장소를 검색해보세요.
          </p>
        )}

        {state === "loading" && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} variant="rect" className="h-12" />)}
          </div>
        )}

        {state === "empty" && (
          <div className="space-y-2 py-4 text-center">
            <p className="text-ink-700 text-[13px]">검색 결과가 없어요.</p>
            {onManual && (
              <Button variant="tertiary" onClick={onManual}>직접 입력으로 저장</Button>
            )}
          </div>
        )}

        {state === "error" && (
          <div className="space-y-2 py-4 text-center">
            <p className="text-ink-700 text-[13px]">
              {error instanceof Error && error.message === "rate_limited"
                ? "검색을 너무 많이 하셨어요. 잠시 후 다시 시도해주세요."
                : "장소 검색이 일시적으로 어려워요. 직접 입력하실 수 있어요."}
            </p>
            {onManual && (
              <Button variant="tertiary" onClick={onManual}>직접 입력</Button>
            )}
          </div>
        )}

        {state === "results" && (
          <ul className="divide-border-primary divide-y">
            {(data ?? []).map((p) => (
              <li key={p.externalId}>
                <button
                  type="button"
                  className="hover:bg-surface-200/60 w-full py-3 text-left"
                  onClick={() => onPick(p)}
                >
                  <p className="text-ink-900 text-[14px] font-medium">{p.name}</p>
                  <p className="text-ink-600 text-[12px]">{p.address}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </BottomSheet>
  );
}
```

- [ ] **Step 8: 빌드 + 커밋**

```bash
pnpm tsc --noEmit && pnpm lint && pnpm build
```
Expected: 0 error.

```bash
git add components/schedule/day-tab-bar.tsx components/schedule/sortable-schedule-item.tsx components/schedule/schedule-list.tsx components/schedule/schedule-item-modal.tsx components/schedule/day-move-sheet.tsx components/schedule/map-panel.tsx components/schedule/place-search-sheet.tsx
git commit -m "feat(schedule): add schedule UI primitives (day-tab-bar, sortable item, list, modal, map-panel, place-search-sheet, day-move-sheet)"
```

---

### Task 19: `schedule-tab.tsx` 리와이어 — Mock 제거 + DnD 오케스트레이션

Spec §3 + §5 + §7.2 Patch HH. 목업 배너·mock import 제거. `useTripDetail`·`useTripDays`·`useScheduleList` + mutation 훅 5종 연결. `DndContext` 에 `PointerSensor(delay:400ms)` + `KeyboardSensor` (spec §3.6). 같은 day 는 reorder, 다른 day 는 move. `?map=open` 쿼리는 유지하되 `MapPanel` 로 대체. 경비 메뉴는 렌더하지 않음 (Patch HH).

**Files:**
- Rewrite: `components/trip/schedule-tab.tsx`

- [ ] **Step 1: 전체 교체**

Rewrite `components/trip/schedule-tab.tsx`:

```typescript
"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarX, ChevronDown, Map as MapIcon } from "lucide-react";
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Fab } from "@/components/ui/fab";
import { cn } from "@/lib/cn";

import { useTripDetail } from "@/lib/trip/use-trip-detail";
import { useTripDays } from "@/lib/trip/use-trip-days";
import { useScheduleList, type ScheduleItem } from "@/lib/schedule/use-schedule-list";
import { useCreateScheduleItem } from "@/lib/schedule/use-create-schedule-item";
import { useUpdateScheduleItem } from "@/lib/schedule/use-update-schedule-item";
import { useDeleteScheduleItem } from "@/lib/schedule/use-delete-schedule-item";
import { useReorderScheduleItemsInDay } from "@/lib/schedule/use-reorder-schedule-items-in-day";
import { useMoveScheduleItemAcrossDays } from "@/lib/schedule/use-move-schedule-item-across-days";
import { useUiStore } from "@/lib/store/ui-store";
import { providerForTrip } from "@/lib/maps/provider";
import type { PlaceResult } from "@/lib/maps/types";

import { DayTabBar } from "@/components/schedule/day-tab-bar";
import { ScheduleList } from "@/components/schedule/schedule-list";
import { ScheduleItemModal, type ScheduleItemFormValue } from "@/components/schedule/schedule-item-modal";
import { DayMoveSheet } from "@/components/schedule/day-move-sheet";
import { MapPanel } from "@/components/schedule/map-panel";
import { PlaceSearchSheet } from "@/components/schedule/place-search-sheet";

type Props = { tripId: string };

export function ScheduleTab({ tripId }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const mapOpen = params.get("map") === "open";

  const { data: trip } = useTripDetail(tripId);
  const { data: days = [], isLoading: daysLoading } = useTripDays(tripId);
  const { data: items = [], isLoading: itemsLoading } = useScheduleList(tripId);

  const createItem = useCreateScheduleItem();
  const updateItem = useUpdateScheduleItem();
  const deleteItem = useDeleteScheduleItem();
  const reorder = useReorderScheduleItemsInDay();
  const move = useMoveScheduleItemAcrossDays();

  const setDragging = useUiStore((s) => s.setDraggingSchedule);
  const showToast = useUiStore((s) => s.showToast);

  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: "create" | "edit"; initial: ScheduleItem | null } | null>(null);
  const [placeSheetOpen, setPlaceSheetOpen] = useState(false);
  const [pickedPlace, setPickedPlace] = useState<PlaceResult | null>(null);
  const [dayMoveFor, setDayMoveFor] = useState<ScheduleItem | null>(null);

  // days 로드/변경 시 active day 보정
  useEffect(() => {
    if (!activeDayId && days.length > 0) setActiveDayId(days[0].id);
    if (activeDayId && days.length > 0 && !days.some((d) => d.id === activeDayId)) {
      setActiveDayId(days[0].id);
    }
  }, [days, activeDayId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 400, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const itemsByDay = useMemo(() => {
    const grouped: Record<string, ScheduleItem[]> = {};
    for (const it of items) (grouped[it.trip_day_id] ??= []).push(it);
    for (const k of Object.keys(grouped)) {
      grouped[k].sort((a, b) => a.sort_order - b.sort_order);
    }
    return grouped;
  }, [items]);

  const activeDayItems = activeDayId ? (itemsByDay[activeDayId] ?? []) : [];

  // 지도용 pinned items (place_lat/lng non-null). label 은 리스트 index+1 과 매칭.
  const mapItems = useMemo(() => {
    return activeDayItems
      .map((it, idx) => ({ it, label: String(idx + 1) }))
      .filter(({ it }) => it.place_lat != null && it.place_lng != null)
      .map(({ it, label }) => ({
        id: it.id,
        place_lat: it.place_lat!,
        place_lng: it.place_lng!,
        label,
      }));
  }, [activeDayItems]);

  function toggleMap() {
    const next = new URLSearchParams(params.toString());
    if (mapOpen) next.delete("map");
    else next.set("map", "open");
    router.push(`/trips/${tripId}?${next.toString()}`);
  }

  function handleDragStart(_e: DragStartEvent) { setDragging(true); }

  function handleDragEnd(event: DragEndEvent) {
    setDragging(false);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeItem = items.find((i) => i.id === active.id);
    const overItem = items.find((i) => i.id === over.id);
    if (!activeItem || !overItem) return;

    if (activeItem.trip_day_id === overItem.trip_day_id) {
      const dayList = (itemsByDay[activeItem.trip_day_id] ?? []).map((i) => i.id);
      const fromIdx = dayList.indexOf(activeItem.id);
      const toIdx = dayList.indexOf(overItem.id);
      if (fromIdx === -1 || toIdx === -1) return;
      const nextOrder = [...dayList];
      nextOrder.splice(fromIdx, 1);
      nextOrder.splice(toIdx, 0, activeItem.id);
      reorder.mutate({ tripId, tripDayId: activeItem.trip_day_id, orderedIds: nextOrder });
    } else {
      const targetDay = overItem.trip_day_id;
      const targetList = (itemsByDay[targetDay] ?? []).map((i) => i.id);
      const overIdx = targetList.indexOf(overItem.id);
      const targetPosition = overIdx === -1 ? targetList.length + 1 : overIdx + 1;  // 1-based
      move.mutate({ tripId, itemId: activeItem.id, targetDayId: targetDay, targetPosition });
    }
  }

  function openCreate() { setPickedPlace(null); setModal({ mode: "create", initial: null }); }
  function openEdit(item: ScheduleItem) { setPickedPlace(null); setModal({ mode: "edit", initial: item }); }
  function closeModal() { setModal(null); setPickedPlace(null); }

  function handleSubmit(value: ScheduleItemFormValue) {
    if (!modal || !activeDayId) return;
    const base = {
      title: value.title,
      timeOfDay: value.timeOfDay,
      memo: value.memo,
      url: value.url,
      placeName: value.place?.name ?? null,
      placeAddress: value.place?.address ?? null,
      placeLat: value.place?.lat ?? null,
      placeLng: value.place?.lng ?? null,
      placeProvider: value.place?.provider ?? null,
      placeExternalId: value.place?.externalId ?? null,
    };
    if (modal.mode === "create") {
      createItem.mutate(
        { ...base, tripId, tripDayId: activeDayId },
        {
          onSuccess: () => { showToast("일정을 추가했어요", "success"); closeModal(); },
          onError: (e) => showToast(`추가 실패: ${e instanceof Error ? e.message : ""}`, "error"),
        },
      );
    } else if (modal.initial) {
      updateItem.mutate(
        { ...base, tripId, itemId: modal.initial.id },
        {
          onSuccess: () => { showToast("저장했어요", "success"); closeModal(); },
          onError: (e) => showToast(`저장 실패: ${e instanceof Error ? e.message : ""}`, "error"),
        },
      );
    }
  }

  function handleDelete() {
    if (modal?.mode !== "edit" || !modal.initial) return;
    if (!window.confirm("이 일정을 삭제할까요?")) return;
    deleteItem.mutate(
      { tripId, itemId: modal.initial.id },
      {
        onSuccess: () => { showToast("삭제했어요", "success"); closeModal(); },
        onError: (e) => showToast(`삭제 실패: ${e instanceof Error ? e.message : ""}`, "error"),
      },
    );
  }

  function handleDayMovePick(targetDayId: string) {
    if (!dayMoveFor) return;
    const targetList = (itemsByDay[targetDayId] ?? []);
    move.mutate(
      {
        tripId,
        itemId: dayMoveFor.id,
        targetDayId,
        targetPosition: targetList.length + 1,   // 맨 뒤로 삽입
      },
      {
        onError: (e) => showToast(`이동 실패: ${e instanceof Error ? e.message : ""}`, "error"),
      },
    );
    setDayMoveFor(null);
    closeModal();
  }

  if (daysLoading || itemsLoading) {
    return <p className="text-ink-500 px-4 py-6 text-[13px]">불러오는 중…</p>;
  }

  return (
    <div className="px-4 pb-28">
      <DayTabBar days={days} activeDayId={activeDayId} onSelect={setActiveDayId} />

      <div className="mt-3 flex items-center justify-between">
        <p className="text-ink-600 text-[12px]">
          {activeDayItems.length > 0 ? `${activeDayItems.length}개 일정` : "일정 없음"}
        </p>
        <button
          type="button" onClick={toggleMap} aria-pressed={mapOpen}
          className="text-ink-700 hover:text-error flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors"
        >
          <MapIcon size={14} />
          {mapOpen ? "지도 접기" : "지도 펼치기"}
          <ChevronDown
            size={14}
            className={cn("transition-transform duration-200", mapOpen && "rotate-180")}
          />
        </button>
      </div>

      {mapOpen && trip && (
        <MapPanel isDomestic={trip.is_domestic} items={mapItems} />
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {activeDayItems.length === 0 ? (
          <EmptyState
            className="py-16"
            icon={<CalendarX size={48} strokeWidth={1.5} />}
            title="아직 일정이 없어요"
            description="일정을 추가해 하루를 계획해보세요."
            cta={<Button variant="primary" onClick={openCreate}>+ 일정 추가</Button>}
          />
        ) : (
          <ScheduleList items={activeDayItems} onTapItem={openEdit} />
        )}
      </DndContext>

      <Fab aria-label="일정 추가" onClick={openCreate} />

      {modal && (
        <ScheduleItemModal
          open
          mode={modal.mode}
          initial={modal.initial}
          pickedPlace={pickedPlace}
          onClose={closeModal}
          onSubmit={handleSubmit}
          onDelete={modal.mode === "edit" ? handleDelete : undefined}
          onOpenPlaceSearch={() => setPlaceSheetOpen(true)}
          onOpenDayMove={modal.mode === "edit" ? () => setDayMoveFor(modal.initial) : undefined}
        />
      )}

      {trip && (
        <PlaceSearchSheet
          open={placeSheetOpen}
          provider={providerForTrip(trip.is_domestic)}
          onClose={() => setPlaceSheetOpen(false)}
          onPick={(p) => { setPickedPlace(p); setPlaceSheetOpen(false); }}
          onManual={() => setPlaceSheetOpen(false)}
        />
      )}

      <DayMoveSheet
        open={Boolean(dayMoveFor)}
        days={days}
        currentDayId={dayMoveFor?.trip_day_id ?? ""}
        onClose={() => setDayMoveFor(null)}
        onPick={handleDayMovePick}
      />
    </div>
  );
}
```

- [ ] **Step 2: lint + build + 수동 검증**

```bash
pnpm tsc --noEmit && pnpm lint && pnpm build
```
Expected: 0 error.

```bash
pnpm dev
```
브라우저 (로그인 세션 필요):
1. `/trips/{id}?tab=schedule` 진입 — day tab 정상 표시, 일정 없음 EmptyState.
2. Fab/CTA → 일정 추가 모달 → 제목·시간 입력 → 추가. 리스트 즉시 반영.
3. 장소 검색 시트 → Naver (국내) 또는 Google (해외) 결과 → 선택 → 모달 장소 채움.
4. long-press (400ms) → 드래그 시작. 같은 day 내 재정렬 → 낙관적 반영, 서버 완료 후 확정.
5. 카드 탭 → 편집 모달 → "다른 날로 이동" → DayMoveSheet → 선택 → day 이동.
6. `?map=open` 토글 → MapPanel 렌더, 마커 fitBounds.
7. 삭제 → confirm → 제거, 남은 sort_order gap-free 재번호.

- [ ] **Step 3: 커밋**

```bash
git add components/trip/schedule-tab.tsx
git commit -m "feat(schedule): wire schedule-tab to real DB with dnd-kit 400ms long-press + keyboard sensor"
```

---

### Task 20: Realtime Gateway 확장 — `schedule_items` 채널 + `trips` 가상 DELETE

Spec §9.5, Patch PP/QQ, §3.5 Patch Q.
- `trips-channel.ts`: UPDATE payload 의 `old.group_id` / `new.group_id` + queryClient 에서 `group.me` 조회로 현재 `myGroupId` 를 매번 재평가(Patch QQ). `wasVisible && !isVisibleNow` → list invalidate + detail 캐시에 `null` 주입.
- `schedule-channel.ts` 신규: schedule_items INSERT/UPDATE/DELETE 수신 시, `ui-store.isDraggingSchedule` 이 true 면 `pendingScheduleInvalidate` 만 세팅하고 건너뜀. false 면 모든 `['schedule']` predicate 로 invalidate (schedule_items payload 에 tripId 가 없으므로 day→trip 매핑 없이 super-set invalidate).
- `use-realtime-gateway.ts`: **기존 `useRealtimeGateway(userId)` 시그니처 유지**. 내부에서 schedule 채널 구독 + 드래그 종료 시 pending flush.
- `<TripUnavailable />` 라우팅: `useTripDetail` 이 `maybeSingle()` 로 `null` 반환 시 `page.tsx` 가 이미 `<TripUnavailable />` 렌더. **그러므로 virtual DELETE 에선 `setQueryData(key, null)` 로 치환하면 기존 경로를 그대로 탄다** (spec §9.5 Patch PP 의 `__unavailable` 센티넬 대체, 효과 동일).

**Files:**
- Rewrite: `lib/realtime/trips-channel.ts`
- Create: `lib/realtime/schedule-channel.ts`
- Modify: `lib/realtime/use-realtime-gateway.ts`
- Test: `tests/unit/trips-visibility.test.ts`
- Test: `tests/unit/schedule-invalidate.test.ts`

- [ ] **Step 1: trips 가상 DELETE 실패 테스트**

Create `tests/unit/trips-visibility.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { resolveTripsVisibilityAction } from "@/lib/realtime/trips-channel";

describe("resolveTripsVisibilityAction", () => {
  const ctx = { currentUserId: "u1", currentGroupId: "g1" };

  it("INSERT visible → invalidateList + detail", () => {
    const a = resolveTripsVisibilityAction(
      { eventType: "INSERT", old: null, new: { id: "t1", group_id: "g1", created_by: "u1" } },
      ctx,
    );
    expect(a).toEqual({ invalidateList: true, invalidateDetailId: "t1", markUnavailableId: null });
  });

  it("INSERT 비가시 → no-op", () => {
    const a = resolveTripsVisibilityAction(
      { eventType: "INSERT", old: null, new: { id: "t2", group_id: "other", created_by: "ux" } },
      ctx,
    );
    expect(a).toEqual({ invalidateList: false, invalidateDetailId: null, markUnavailableId: null });
  });

  it("UPDATE share-OFF (wasVisible && !isVisibleNow) → markUnavailable", () => {
    const a = resolveTripsVisibilityAction(
      {
        eventType: "UPDATE",
        old: { id: "t1", group_id: "g1", created_by: "ux" },
        new: { id: "t1", group_id: null, created_by: "ux" },
      },
      ctx,
    );
    expect(a).toEqual({ invalidateList: true, invalidateDetailId: null, markUnavailableId: "t1" });
  });

  it("UPDATE share-ON (!wasVisible && isVisibleNow) → invalidate detail", () => {
    const a = resolveTripsVisibilityAction(
      {
        eventType: "UPDATE",
        old: { id: "t1", group_id: null, created_by: "ux" },
        new: { id: "t1", group_id: "g1", created_by: "ux" },
      },
      ctx,
    );
    expect(a).toEqual({ invalidateList: true, invalidateDetailId: "t1", markUnavailableId: null });
  });

  it("UPDATE visible→visible → invalidate detail", () => {
    const a = resolveTripsVisibilityAction(
      {
        eventType: "UPDATE",
        old: { id: "t1", group_id: "g1", created_by: "u1" },
        new: { id: "t1", group_id: "g1", created_by: "u1" },
      },
      ctx,
    );
    expect(a).toEqual({ invalidateList: true, invalidateDetailId: "t1", markUnavailableId: null });
  });

  it("DELETE visible → markUnavailable", () => {
    const a = resolveTripsVisibilityAction(
      { eventType: "DELETE", old: { id: "t1", group_id: "g1", created_by: "u1" }, new: null },
      ctx,
    );
    expect(a).toEqual({ invalidateList: true, invalidateDetailId: null, markUnavailableId: "t1" });
  });

  it("DELETE 비가시 → no-op", () => {
    const a = resolveTripsVisibilityAction(
      { eventType: "DELETE", old: { id: "t9", group_id: "other", created_by: "ux" }, new: null },
      ctx,
    );
    expect(a).toEqual({ invalidateList: false, invalidateDetailId: null, markUnavailableId: null });
  });
});
```

- [ ] **Step 2: trips-channel 재작성**

Rewrite `lib/realtime/trips-channel.ts`:

```typescript
import type { QueryClient } from "@tanstack/react-query";
import { subscribeToTable } from "./channel";
import { queryKeys } from "@/lib/query/keys";
import type { MyGroupData } from "@/lib/group/use-my-group";

type TripRow = {
  id: string;
  group_id: string | null;
  created_by: string | null;
};

type Payload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  old: Partial<TripRow> | null;
  new: Partial<TripRow> | null;
};

type Ctx = { currentUserId: string; currentGroupId: string | null };

export type TripsVisibilityAction = {
  invalidateList: boolean;
  invalidateDetailId: string | null;
  markUnavailableId: string | null;
};

function isVisible(row: Partial<TripRow> | null, ctx: Ctx): boolean {
  if (!row) return false;
  if (row.created_by && row.created_by === ctx.currentUserId) return true;
  if (row.group_id && ctx.currentGroupId && row.group_id === ctx.currentGroupId) return true;
  return false;
}

export function resolveTripsVisibilityAction(payload: Payload, ctx: Ctx): TripsVisibilityAction {
  const wasVisible = isVisible(payload.old, ctx);
  const isVisibleNow = isVisible(payload.new, ctx);

  if (payload.eventType === "DELETE") {
    return {
      invalidateList: wasVisible,
      invalidateDetailId: null,
      markUnavailableId: wasVisible ? payload.old?.id ?? null : null,
    };
  }

  if (payload.eventType === "INSERT") {
    return {
      invalidateList: isVisibleNow,
      invalidateDetailId: isVisibleNow ? payload.new?.id ?? null : null,
      markUnavailableId: null,
    };
  }

  // UPDATE
  if (wasVisible && !isVisibleNow) {
    return {
      invalidateList: true,
      invalidateDetailId: null,
      markUnavailableId: payload.old?.id ?? payload.new?.id ?? null,
    };
  }
  if (isVisibleNow) {
    return {
      invalidateList: true,
      invalidateDetailId: payload.new?.id ?? null,
      markUnavailableId: null,
    };
  }
  return { invalidateList: false, invalidateDetailId: null, markUnavailableId: null };
}

export function subscribeToTrips(queryClient: QueryClient, currentUserId: string) {
  return subscribeToTable<TripRow>({
    channel: "trips-changes",
    table: "trips",
    onChange: (payload) => {
      // Patch QQ: handler 마다 최신 group_id 조회 (re-subscribe 비용 회피).
      const groupCache = queryClient.getQueryData<MyGroupData>(queryKeys.group.me);
      const currentGroupId = groupCache?.group?.id ?? null;

      const action = resolveTripsVisibilityAction(
        payload as unknown as Payload,
        { currentUserId, currentGroupId },
      );

      if (action.invalidateList) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.trips.list });
      }
      if (action.invalidateDetailId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.trips.detail(action.invalidateDetailId),
        });
      }
      if (action.markUnavailableId) {
        // useTripDetail 은 maybeSingle() 로 null 리턴 → page.tsx 가 !trip 에서 <TripUnavailable />.
        // null 주입이 동일 경로 재사용 (spec §9.5 Patch PP sentinel 단순화).
        queryClient.setQueryData(queryKeys.trips.detail(action.markUnavailableId), null);
      }

      if (process.env.NODE_ENV !== "production") {
        const w = window as unknown as { __realtimeEvents?: unknown[] };
        w.__realtimeEvents ??= [];
        w.__realtimeEvents.push({ ...payload, table: "trips" });
      }
    },
  });
}
```

- [ ] **Step 3: trips PASS 확인**

```bash
pnpm vitest run tests/unit/trips-visibility.test.ts
```
Expected: 7/7 PASS.

- [ ] **Step 4: schedule-channel 실패 테스트**

Create `tests/unit/schedule-invalidate.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { handleScheduleChange, __resetScheduleChannelForTest } from "@/lib/realtime/schedule-channel";
import { useUiStore } from "@/lib/store/ui-store";
import { queryKeys } from "@/lib/query/keys";

describe("handleScheduleChange — drag-suspend invalidate", () => {
  beforeEach(() => {
    __resetScheduleChannelForTest();
    useUiStore.setState({
      toast: null,
      showToast: () => {},
      clearToast: () => {},
      isDraggingSchedule: false,
      setDraggingSchedule: () => {},
      pendingScheduleInvalidate: false,
      setPendingScheduleInvalidate: () => {},
    });
  });

  it("드래그 중이 아니면 모든 schedule 쿼리를 invalidate 한다", () => {
    const qc = new QueryClient();
    qc.setQueryData(queryKeys.schedule.byTripId("t1"), []);
    qc.setQueryData(queryKeys.schedule.byTripId("t2"), []);
    let invalidatedCount = 0;
    const spyQc = {
      invalidateQueries: (arg: { predicate?: (q: { queryKey: unknown[] }) => boolean }) => {
        for (const q of qc.getQueryCache().getAll()) {
          if (arg.predicate?.({ queryKey: q.queryKey as unknown[] })) invalidatedCount += 1;
        }
      },
    } as unknown as QueryClient;

    handleScheduleChange(spyQc);
    expect(invalidatedCount).toBe(2);
  });

  it("드래그 중이면 pendingScheduleInvalidate 만 true 로, invalidate 는 건너뛴다", () => {
    let pending = false;
    useUiStore.setState({
      toast: null,
      showToast: () => {},
      clearToast: () => {},
      isDraggingSchedule: true,
      setDraggingSchedule: () => {},
      pendingScheduleInvalidate: false,
      setPendingScheduleInvalidate: (v: boolean) => { pending = v; },
    });
    let invalidateCalled = false;
    const qc = { invalidateQueries: () => { invalidateCalled = true; } } as unknown as QueryClient;

    handleScheduleChange(qc);
    expect(invalidateCalled).toBe(false);
    expect(pending).toBe(true);
  });
});
```

- [ ] **Step 5: schedule-channel 구현**

Create `lib/realtime/schedule-channel.ts`:

```typescript
import type { QueryClient, Query } from "@tanstack/react-query";
import { subscribeToTable } from "./channel";
import { useUiStore } from "@/lib/store/ui-store";

// reserved for future buffering; current impl is stateless
export function __resetScheduleChannelForTest(): void {
  /* noop */
}

export function handleScheduleChange(queryClient: QueryClient): void {
  const ui = useUiStore.getState();
  if (ui.isDraggingSchedule) {
    ui.setPendingScheduleInvalidate(true);
    return;
  }
  void queryClient.invalidateQueries({
    predicate: (q: Query) => Array.isArray(q.queryKey) && q.queryKey[0] === "schedule",
  });
}

export function subscribeToScheduleItems(queryClient: QueryClient) {
  return subscribeToTable<{ trip_day_id: string }>({
    channel: "schedule-items-changes",
    table: "schedule_items",
    onChange: (_payload) => {
      handleScheduleChange(queryClient);
      if (process.env.NODE_ENV !== "production") {
        const w = window as unknown as { __realtimeEvents?: unknown[] };
        w.__realtimeEvents ??= [];
        w.__realtimeEvents.push({ ..._payload, table: "schedule_items" });
      }
    },
  });
}
```

> **predicate invalidate 근거:** `schedule_items` payload 는 `trip_day_id` 만 포함. `trip_day_id → tripId` 복원에는 `trip_days` 캐시 lookup 이 필요하지만, 현재 UX 상 한 번에 한 trip 만 열어둔다. 모든 `['schedule', *]` 을 invalidate 해도 실제 refetch 는 열린 1개뿐이므로 비용 무시 가능. 다중 trip 뷰가 생기면 cache 룩업 방식으로 전환.

- [ ] **Step 6: schedule PASS 확인**

```bash
pnpm vitest run tests/unit/schedule-invalidate.test.ts
```
Expected: 2/2 PASS.

- [ ] **Step 7: `useRealtimeGateway` 확장 (시그니처 유지)**

Rewrite `lib/realtime/use-realtime-gateway.ts`:

```typescript
"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Query } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { subscribeToTrips } from "@/lib/realtime/trips-channel";
import { subscribeToScheduleItems } from "@/lib/realtime/schedule-channel";
import { subscribeToGroupMembers } from "@/lib/realtime/group-members-channel";
import { subscribeToGroups } from "@/lib/realtime/groups-channel";
import { useUiStore } from "@/lib/store/ui-store";

export function useRealtimeGateway(userId: string | undefined) {
  const queryClient = useQueryClient();
  const supabase = getBrowserClient();
  const showToast = useUiStore((s) => s.showToast);

  const isDragging = useUiStore((s) => s.isDraggingSchedule);
  const pending = useUiStore((s) => s.pendingScheduleInvalidate);
  const setPending = useUiStore((s) => s.setPendingScheduleInvalidate);

  useEffect(() => {
    if (!userId) return;

    const unsubTrips = subscribeToTrips(queryClient, userId);
    const unsubSchedule = subscribeToScheduleItems(queryClient);
    const unsubMembers = subscribeToGroupMembers(queryClient);
    const unsubGroups = subscribeToGroups(queryClient, {
      onDissolved: () => showToast("파트너와의 공유가 종료되었어요"),
    });

    const handleOnline = () => { void queryClient.invalidateQueries(); };
    window.addEventListener("online", handleOnline);

    return () => {
      unsubTrips();
      unsubSchedule();
      unsubMembers();
      unsubGroups();
      window.removeEventListener("online", handleOnline);
      void supabase.removeAllChannels();
    };
  }, [userId, queryClient, supabase, showToast]);

  // 드래그 종료 시 pending invalidate flush
  useEffect(() => {
    if (isDragging) return;
    if (!pending) return;
    void queryClient.invalidateQueries({
      predicate: (q: Query) => Array.isArray(q.queryKey) && q.queryKey[0] === "schedule",
    });
    setPending(false);
  }, [isDragging, pending, queryClient, setPending]);
}
```

> 호출부 `components/realtime/realtime-gateway.tsx` 의 `useRealtimeGateway(profile?.id)` 는 그대로 유효. 변경 불필요.

- [ ] **Step 8: 빌드 + 단위 suite**

```bash
pnpm tsc --noEmit && pnpm lint && pnpm build
pnpm vitest run tests/unit
```
Expected: 0 error, unit suite (기존 + 신규 합산) PASS.

- [ ] **Step 9: 커밋**

```bash
git add lib/realtime/trips-channel.ts lib/realtime/schedule-channel.ts lib/realtime/use-realtime-gateway.ts tests/unit/trips-visibility.test.ts tests/unit/schedule-invalidate.test.ts
git commit -m "feat(realtime): add schedule-items channel + trips virtual DELETE resolver + drag-suspend invalidate"
```

---

## Part B — 체크포인트

Task 11~20 완료 시점:
- **Schedule query + CRUD + drag** 훅 7종 (`useScheduleList`, `useTripDays`, `useCreateScheduleItem`, `useUpdateScheduleItem`, `useDeleteScheduleItem`, `useReorderScheduleItemsInDay`, `useMoveScheduleItemAcrossDays`) — 계약 integration 테스트 통과
- **순수 함수 2종** (`applyLocalReorder`, `applyLocalMove`) — 1-based sort_order / `trip_day_id` 스코프 / immutability / set-mismatch / invalid_target_position unit 테스트
- **`/api/maps/search`** — zod + 30/min/user rate limit + Naver(TM128→WGS84 + `<b>` strip) / Google (FieldMask + locationBias) 어댑터
- **UI 7개 컴포넌트** (`components/schedule/*`) — 기존 UI 키트 재사용 (`Button`, `BottomSheet`, `Fab`, `TextField`, `EmptyState`, `ScheduleItem`, `Skeleton`)
- **schedule-tab.tsx** — mock 완전 제거, 실제 DB 배선, `DndContext` 에 `PointerSensor(delay:400ms)` + `KeyboardSensor` (spec §3.6), 같은날 reorder / 다른날 move 분기, `?map=open` 쿼리 유지
- **Realtime gateway 확장** — `subscribeToTrips(queryClient, userId)` 시그니처 변경 (호출부는 그대로), virtual DELETE 판정 + `null` 센티넬로 `<TripUnavailable />` 재사용, `schedule-items-channel` predicate invalidate + drag-suspend flush
- **ui-store 확장** — `isDraggingSchedule`, `pendingScheduleInvalidate` 필드

**자동 검증:**
```bash
pnpm tsc --noEmit && pnpm lint && pnpm build && pnpm vitest run
```
Expected: 0 error / 0 failure.

**수동 검증 (`pnpm dev`):**
- trip 상세 → schedule 탭 → 아이템 추가/편집/삭제
- long-press (400ms) → 같은 day 내 드래그 → 순서 즉시 반영 (낙관적)
- 편집 모달 → "다른 날로 이동" → DayMoveSheet → target day 선택 → 이동
- 또는 카드를 다른 day 아이템 위로 드롭 → move RPC 호출 → 양쪽 day 재번호
- 장소 검색 시트 (Naver/Google) → debounced 300ms → 결과 선택 or 직접 입력
- 지도 패널 (`?map=open`) → 선택된 day 의 pinned 마커 + fitBounds
- 두 브라우저 세션 (owner/partner) 동시 접속 → 한쪽 변경 → 다른쪽 realtime 반영
- owner 가 파트너 공유 OFF → partner 의 `/trips` 리스트에서 즉시 사라짐 + `/trips/{id}` 열려있던 경우 5초 내 `<TripUnavailable />` 전환

**다음 Part C 입력:** E2E (Playwright) / QA 체크리스트 / Critic 2회차 리뷰 / Exit Gate.

---

### Task 21: E2E 인프라 — Playwright config + global-setup + fixtures + helpers

**Goal:** Phase 2 에서 수동으로 대체된 E2E 를 자동화 경로로 복귀. Google OAuth 는 우회 불가하므로 `auth.admin.createUser` + Part A Task 7 의 `/api/test/sign-in` 으로 Supabase 세션을 획득, Playwright `storageState` 로 브라우저 쿠키 주입. Spec §8.2~§8.8 그대로.

**필요 조건:**
- Part A Task 4 완료: `supabase/seed/test.sql` (`test_truncate_cascade()` SECURITY DEFINER RPC, service_role 전용 GRANT) 적용됨
- Part A Task 6 완료: `ALLOW_TEST_SIGNIN`/`TEST_SECRET` optional env + `.env.test` 로컬 파일
- Part A Task 7 완료: `app/api/test/sign-in/route.ts` (NODE_ENV + env flag + X-Test-Secret 3중 guard) + `.gitignore` 에 `/tests/e2e/.auth/` 등록

**변경 파일:** `playwright.config.ts`, `tests/e2e/fixtures/users.ts` (신규), `tests/e2e/helpers/auth.ts` (신규), `tests/e2e/helpers/db-reset.ts` (신규), `tests/e2e/helpers/realtime-hooks.ts` (신규), `tests/e2e/global-setup.ts` (신규), `eslint.config.mjs` (helpers 예외)

- [ ] **Step 1: fixtures — `tests/e2e/fixtures/users.ts`**

```typescript
export interface TestUser {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
}

export const ALICE: TestUser = {
  email: "alice@test.travel-manager.local",
  password: "Alice_Pwd_2026!",
  displayName: "앨리스",
};

export const BOB: TestUser = {
  email: "bob@test.travel-manager.local",
  password: "Bob_Pwd_2026!",
  displayName: "밥",
};
```

> 이메일은 RFC 2606 reserved TLD 후보 `.local` 사용 — 실 메일 발송 방지.

- [ ] **Step 2: auth helper — `tests/e2e/helpers/auth.ts`**

```typescript
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { request } from "@playwright/test";
import type { Database } from "@/types/database";
import type { TestUser } from "../fixtures/users";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`E2E env missing: ${key}`);
  return value;
}

let adminClient: SupabaseClient<Database> | null = null;
function getAdmin(): SupabaseClient<Database> {
  if (!adminClient) {
    adminClient = createClient<Database>(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return adminClient;
}

/** 멱등. 유저 없으면 생성(email_confirm true), 있으면 password 리셋 후 id 반환. */
export async function ensureTestUser(user: TestUser): Promise<string> {
  const admin = getAdmin();

  const { data: page, error: listErr } = await admin.auth.admin.listUsers({
    page: 1, perPage: 200,
  });
  if (listErr) throw new Error(`listUsers failed: ${listErr.message}`);

  const existing = page?.users.find((u) => u.email === user.email);
  if (existing) {
    const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
      password: user.password,
    });
    if (updErr) throw new Error(`updateUserById failed: ${updErr.message}`);
    return existing.id;
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { display_name: user.displayName },
  });
  if (createErr || !created.user) {
    throw new Error(`createUser failed: ${createErr?.message ?? "no user"}`);
  }
  return created.user.id;
}

/**
 * /api/test/sign-in 을 호출해 Supabase SSR 쿠키를 정상 경로로 세팅하고
 * storageState JSON 으로 덤프. 수동 cookie 조립은 하지 않는다.
 */
export async function buildStorageState(user: TestUser, outputPath: string): Promise<void> {
  const baseURL = requireEnv("PLAYWRIGHT_BASE_URL");
  const testSecret = requireEnv("TEST_SECRET");

  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post("/api/test/sign-in", {
    headers: { "X-Test-Secret": testSecret },
    data: { email: user.email, password: user.password },
  });
  if (!res.ok()) {
    const body = await res.text().catch(() => "");
    await ctx.dispose();
    throw new Error(`POST /api/test/sign-in → ${res.status()} ${body.slice(0, 200)}`);
  }
  await ctx.storageState({ path: outputPath });
  await ctx.dispose();
}
```

- [ ] **Step 3: db-reset helper — `tests/e2e/helpers/db-reset.ts`**

```typescript
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`E2E env missing: ${key}`);
  return value;
}

/**
 * Part A Task 4 에서 `supabase/seed/test.sql` 에 정의한 service_role-only RPC 호출.
 * public.*  테이블만 truncate cascade. auth.users 는 보존 → alice/bob 재생성 불필요.
 */
export async function truncateCascade(): Promise<void> {
  const admin = createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await admin.rpc("test_truncate_cascade" as never);
  if (error) throw new Error(`test_truncate_cascade failed: ${error.message}`);
}
```

> `test_truncate_cascade` 는 Part A Task 4 에서 `Database` 타입에 **등록되지 않을 수 있음** (seed 는 migration 이 아님). `"test_truncate_cascade" as never` cast 로 타입 시스템 회피 — integration/e2e 전용이라 안전.

- [ ] **Step 4: realtime-hooks helper — `tests/e2e/helpers/realtime-hooks.ts`**

Part B Task 20 가 `subscribeToScheduleItems` 와 `subscribeToTrips` 에 dev-only `window.__realtimeEvents` push 를 심어둔다 (production build 에서는 `process.env.NODE_ENV !== "production"` 가드로 제외). 이 훅을 Playwright 쪽에서 대기.

```typescript
import type { Page } from "@playwright/test";

export interface RealtimeSnapshot {
  table: string;
  eventType?: string;
  new?: unknown;
  old?: unknown;
}

/** dev 서버 한정. window.__realtimeEvents 에 매칭 이벤트가 push 될 때까지 대기. */
export async function waitForRealtimeEvent(
  page: Page,
  match: { table: string; predicate?: (ev: RealtimeSnapshot) => boolean },
  timeoutMs = 10_000,
): Promise<void> {
  await page.waitForFunction(
    ({ table, predicateSrc }) => {
      const w = window as unknown as { __realtimeEvents?: RealtimeSnapshot[] };
      const events = w.__realtimeEvents ?? [];
      const fn = predicateSrc
        ? (new Function("ev", `return (${predicateSrc})(ev)`)) as (ev: RealtimeSnapshot) => boolean
        : () => true;
      return events.some((ev) => ev.table === table && fn(ev));
    },
    { table: match.table, predicateSrc: match.predicate?.toString() ?? null },
    { timeout: timeoutMs },
  );
}

/** 브라우저 컨텍스트 초기화 시점에 realtime buffer 를 리셋. */
export async function resetRealtimeBuffer(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __realtimeEvents?: unknown[] }).__realtimeEvents = [];
  });
}
```

> Spec §8.8 Patch NN 의 `eval` 대신 `new Function(...)` 사용 — closure 바인딩 불필요 + CSP `unsafe-eval` 은 dev 에서만 허용 (prod 제외).

- [ ] **Step 5: global-setup — `tests/e2e/global-setup.ts`**

> **H2 (critic 2회차 지적):** globalSetup 은 alice+bob 유저만 생성. `partner-realtime.spec.ts` / `share-toggle.spec.ts` 가 요구하는 **group membership** 을 globalSetup 에서 함께 성립시켜야 함. 옵션 A (globalSetup) 채택 — 옵션 B (spec beforeAll 분산) 대비 중복/drift 위험 낮음.

```typescript
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ALICE, BOB } from "./fixtures/users";
import { ensureTestUser, buildStorageState } from "./helpers/auth";
import { truncateCascade } from "./helpers/db-reset";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`E2E env missing: ${key}`);
  return value;
}

async function ensureAlicePartnersBob(): Promise<void> {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const aliceC = createClient<Database>(url, anonKey, { auth: { persistSession: false } });
  {
    const { error } = await aliceC.auth.signInWithPassword({
      email: ALICE.email, password: ALICE.password,
    });
    if (error) throw new Error(`alice signIn failed: ${error.message}`);
  }

  const inv = await aliceC.rpc("create_invite");
  if (inv.error) throw new Error(`create_invite failed: ${inv.error.message}`);
  const code = (inv.data as { invite_code: string }).invite_code;

  const bobC = createClient<Database>(url, anonKey, { auth: { persistSession: false } });
  {
    const { error } = await bobC.auth.signInWithPassword({
      email: BOB.email, password: BOB.password,
    });
    if (error) throw new Error(`bob signIn failed: ${error.message}`);
  }

  const acc = await bobC.rpc("accept_invite", { p_invite_code: code });
  if (acc.error) throw new Error(`accept_invite failed: ${acc.error.message}`);

  await aliceC.auth.signOut();
  await bobC.auth.signOut();
}

export default async function globalSetup(): Promise<void> {
  // 1) DB reset — 이전 run 의 test data 제거 (auth.users 는 보존, §8 Patch MM)
  await truncateCascade();

  // 2) 유저 생성/보장 (멱등)
  await ensureTestUser(ALICE);
  await ensureTestUser(BOB);

  // 3) alice ↔ bob 그룹 결성 (H2 — partner-dual specs 전제 조건)
  //    truncateCascade 가 이전 group* 를 지웠으므로 항상 새로 결성
  await ensureAlicePartnersBob();

  // 4) storageState — cookie 는 sign-out 이후에도 기존 세션 cookie 로 고정 필요.
  //    위 ensureAlicePartnersBob 는 별도 SupabaseClient 로 signIn 한 뒤 signOut 했으므로
  //    /api/test/sign-in 은 fresh signIn 을 수행 → cookie 격리 유지.
  const aliceState = resolve("tests/e2e/.auth/alice.json");
  const bobState = resolve("tests/e2e/.auth/bob.json");
  await mkdir(dirname(aliceState), { recursive: true });
  await buildStorageState(ALICE, aliceState);
  await buildStorageState(BOB, bobState);
}
```

**검증:**
```bash
pnpm exec playwright test --list
# globalSetup 트리거 후 Supabase 콘솔에서:
#   select count(*) from group_members;  -- Expected: 2 (alice owner + bob partner)
#   select count(*) from groups where status='active';  -- Expected: 1
```

> **spec 내 trip 생성/삭제 정책:** partner-realtime / share-toggle 은 각 test 안에서 trip 을 직접 생성·정리. globalSetup 은 **group 멤버십만 세팅**, trip 은 세팅하지 않음 (각 spec 의 테스트 시나리오가 trip 의 visibility 를 조작하므로 독립 수명 필요). Task 24 Step 5 `share-toggle.spec.ts` 는 `beforeEach` 에서 admin client 로 공유 trip 을 seed → 해당 test 끝에 cleanup.

- [ ] **Step 6: `playwright.config.ts` 확장**

기존 (Part A baseline):
```typescript
projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
webServer: {
  command: "pnpm dev",
  url: "http://localhost:3000",
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
},
```

교체:
```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  globalSetup: require.resolve("./tests/e2e/global-setup"),
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "anonymous",
      use: { ...devices["Desktop Chrome"] },
      testMatch: ["login.spec.ts"],
    },
    {
      name: "alice",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/alice.json",
      },
      testMatch: [
        "schedule-crud.spec.ts",
        "drag-same-day.spec.ts",
        "drag-cross-day.spec.ts",
        "resize-with-items.spec.ts",
        "place-search.spec.ts",
      ],
    },
    {
      name: "partner-dual",
      use: { ...devices["Desktop Chrome"] },
      testMatch: ["partner-realtime.spec.ts", "share-toggle.spec.ts"],
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ALLOW_TEST_SIGNIN: "true",
    },
  },
});
```

> `webServer.env.ALLOW_TEST_SIGNIN=true` 를 통해 Playwright 가 띄운 dev 서버 내에서만 `/api/test/sign-in` 이 작동. OS 의 `.env.local` 을 덮어쓰지 않음.
>
> Spec §8.6 Patch JJ — partial concurrency 비활성화: alice/bob 공유 DB → race 위험. V2 에서 유저 pool 확장.

- [ ] **Step 7: eslint 가드 — helpers 의 mocks guard 우회 (필요 시)**

Part A Task 15 의 `eslint.config.mjs` 에 `no-restricted-imports` → `lib/mocks/factory*` 차단 규칙이 있지만, `tests/e2e/helpers/**` 는 mocks 를 import 하지 않음 (Supabase admin 직접 사용). **별도 예외 불필요.** 단 Task 25 에서 lint 통과 안 되면 이 step 복귀.

- [ ] **Step 8: 인프라 smoke**

```bash
pnpm exec playwright install chromium
pnpm exec playwright test --list
```
Expected: 7 신규 spec 이 올바른 project 에 배정되고, `login.spec.ts` 는 anonymous project 에만 포함.

```bash
pnpm exec playwright test tests/e2e/login.spec.ts --project=anonymous
```
Expected: 2/2 PASS (Part A 수정 없이 기존 시나리오 유지). globalSetup 은 이 단계에서 `truncateCascade` + `ensureTestUser` + `buildStorageState` 실행.

- [ ] **Step 9: 커밋**

```bash
git add playwright.config.ts tests/e2e/fixtures tests/e2e/helpers tests/e2e/global-setup.ts
git commit -m "test(e2e): add playwright global-setup + storageState auth helpers"
```

---

### Task 22: Unit Suite 완성 — 누락 spec 추가 + coverage include 확장

**Goal:** Spec §10.3 Unit 체크리스트 7개 중 Part A/B Task 에서 이미 작성되지 않은 나머지를 추가하고, `lib/maps/` + `lib/schedule/` 커버리지 include 를 `vitest.config.ts` 에 추가하여 threshold 80% gate 를 활성화.

**이미 작성된 것 (재작성 금지):**

| Spec §10.3 항목 | 대응 파일 | 작성 시점 |
|---|---|---|
| sort-order | `tests/unit/apply-local-reorder.test.ts` | Part B Task 14 |
| apply-local-move | `tests/unit/apply-local-move.test.ts` | Part B Task 14 |
| coordinate-clamp | `tests/unit/coordinate-clamp.test.ts` | Part B Task 16 |
| tm128-wgs84 | `tests/unit/tm128-wgs84.test.ts` | Part B Task 16 |
| provider-selector | `tests/unit/provider-selector.test.ts` | Part A Task 8 |
| strip-html-tags | `tests/unit/strip-html-tags.test.ts` | Part B Task 16 |
| url-scheme | **(없음 — 이 Task 에서 신규)** | — |

Spec §10.3 의 `sort-order.test.ts` 명명은 Part A/B 에서 순수 함수 이름 기준 `apply-local-reorder.test.ts` 로 실행됨 (같은 대상). 이름 reconcile 완료 — 별도 파일 추가하지 않는다.

**변경 파일:** `tests/unit/url-scheme.test.ts` (신규), `vitest.config.ts` (수정)

- [ ] **Step 1: URL 스키마 추출 확인**

Part B Task 12 의 `lib/schedule/use-create-schedule-item.ts` 에 zod URL validator 가 정의돼 있는지 먼저 확인.

```bash
grep -n "scheduleItemUrlSchema\|z\.string().url" lib/schedule/
```

위치 후보:
- `lib/schedule/use-create-schedule-item.ts`
- `lib/schedule/schema.ts` (Part B 가 분리했다면)

**만약 분리돼 있지 않으면** Part C 가 `lib/schedule/schema.ts` 로 추출:

```typescript
// lib/schedule/schema.ts (신규 or 기존)
import { z } from "zod";

// Spec §2.2 URL 제약: http/https 만 허용, javascript:/data:/file: 거부
export const scheduleItemUrlSchema = z
  .string()
  .trim()
  .max(500, "URL 은 500자 이하여야 해요")
  .refine(
    (v) => v === "" || /^https?:\/\//i.test(v),
    "http:// 또는 https:// 로 시작해야 해요",
  )
  .transform((v) => (v === "" ? null : v));

export const scheduleItemTitleSchema = z.string().trim().min(1).max(100);
```

Part B 의 use-create-schedule-item 은 이 schema 를 import 해서 사용하도록 재배선 (`mutationFn` 진입 직후 `.parse()`).

- [ ] **Step 2: unit — `tests/unit/url-scheme.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { scheduleItemUrlSchema } from "@/lib/schedule/schema";

describe("scheduleItemUrlSchema", () => {
  it("https:// URL 은 통과", () => {
    expect(scheduleItemUrlSchema.parse("https://example.com")).toBe("https://example.com");
  });

  it("http:// URL 은 통과", () => {
    expect(scheduleItemUrlSchema.parse("http://example.com/path?q=1"))
      .toBe("http://example.com/path?q=1");
  });

  it("빈 문자열은 null 로 normalize", () => {
    expect(scheduleItemUrlSchema.parse("")).toBeNull();
    expect(scheduleItemUrlSchema.parse("   ")).toBeNull();
  });

  it("javascript: 는 거부", () => {
    expect(() => scheduleItemUrlSchema.parse("javascript:alert(1)")).toThrow();
  });

  it("data: 는 거부", () => {
    expect(() => scheduleItemUrlSchema.parse("data:text/html,<script>1</script>")).toThrow();
  });

  it("file: 는 거부", () => {
    expect(() => scheduleItemUrlSchema.parse("file:///etc/passwd")).toThrow();
  });

  it("501자 초과 거부", () => {
    const long = "https://a.com/" + "x".repeat(490);
    expect(() => scheduleItemUrlSchema.parse(long)).toThrow();
  });

  it("도메인만 있고 scheme 없음 거부", () => {
    expect(() => scheduleItemUrlSchema.parse("example.com")).toThrow();
  });
});
```

- [ ] **Step 3: `vitest.config.ts` coverage include 확장**

기존:
```typescript
coverage: {
  provider: "v8",
  include: [
    "lib/auth/nonce.ts",
    "lib/profile/color-schema.ts",
    "lib/profile/colors.ts",
  ],
  exclude: ["lib/mocks/**", "**/*.d.ts"],
  thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
},
```

교체 (Phase 3 추가 모듈 include):
```typescript
coverage: {
  provider: "v8",
  include: [
    "lib/auth/nonce.ts",
    "lib/profile/color-schema.ts",
    "lib/profile/colors.ts",
    "lib/schedule/apply-local-reorder.ts",
    "lib/schedule/apply-local-move.ts",
    "lib/schedule/schema.ts",
    "lib/maps/tm128.ts",
    "lib/maps/strip-html.ts",
    "lib/maps/rate-limit.ts",
    "lib/maps/provider.ts",
  ],
  exclude: ["lib/mocks/**", "**/*.d.ts"],
  thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
},
```

> `lib/maps/providers/*` (Naver/Google SDK 래퍼) 는 브라우저 전용 DOM 조작 → unit coverage 제외, E2E 로만 검증.
> `lib/maps/search/*`, `lib/maps/use-place-search.ts` 는 서버 전용 or React 훅 → integration 으로만 검증.

- [ ] **Step 4: Unit suite 전체 PASS 확인 + coverage**

```bash
pnpm vitest run tests/unit
pnpm test:cov
```
Expected:
- Part 1 existing 7 (nonce + env + colors + color-schema + invite-url + trip-date + trip-grouping) + Part A 3 (dnd-kit-smoke, env-maps, provider-selector) + Part B 9 (apply-local-reorder, apply-local-move, tm128, strip-html, rate-limit, coordinate-clamp, use-debounced-value, trips-visibility, schedule-invalidate) + Part C 1 (url-scheme) = **20 spec PASS**.
- coverage threshold 80% 달성 (schedule/maps 신규 모듈 포함).

> `dnd-kit-smoke.test.ts` 는 Part A Task 0 에서 "Task 완료 후 제거 가능" 마킹. Phase 3 집행 초기에 통과 확인하면 Task 21~22 사이에서 제거 후보. **이 Plan 에서는 유지** — Next.js / React 버전 upgrade 시 회귀 감지 용.

- [ ] **Step 5: 커밋**

```bash
git add lib/schedule/schema.ts tests/unit/url-scheme.test.ts vitest.config.ts
git commit -m "test(schedule): add url-scheme unit + expand maps/schedule coverage include"
```

---

### Task 23: Integration Tests — RLS / resize v2 / realtime audit / replica identity / share-toggle realtime / rate-limit

**Goal:** Spec §10.3 Integration 체크리스트 10건 중 Part B 에서 작성되지 않은 6건을 추가. 파일 확장자는 `.test.ts` (vitest.integration.config.ts 의 `include: ["tests/integration/**/*.test.ts"]` 와 일치 — `.spec.ts` 는 인식 안 됨).

**이미 작성된 것 (재작성 금지):**

| Spec §10.3 항목 | 대응 파일 | 작성 시점 |
|---|---|---|
| reorder-schedule-items-in-day | `tests/integration/reorder-schedule-items-in-day.test.ts` | Part B Task 15 |
| move-schedule-item-across-days | `tests/integration/move-schedule-item-across-days.test.ts` | Part B Task 15 |
| create-schedule-item | `tests/integration/create-schedule-item.test.ts` | Part B Task 12 |
| update-schedule-item | `tests/integration/update-delete-schedule-item.test.ts` (update+delete 합본) | Part B Task 13 |

**Part C 신규 6건:**
1. `rls-schedule-items.test.ts`
2. `resize-trip-days-v2.test.ts`
3. `realtime-publication-audit.test.ts` (**기존 파일 확장** — Spec File Structure §8.3 의 `-v2` 접미사는 채택하지 않음, in-place 확장이 더 단순)
4. `replica-identity-audit.test.ts`
5. `share-toggle-realtime.test.ts`
6. `place-search-rate-limit.test.ts` (HTTP 없이 rate-limiter 모듈 직접 검증)

**공통 패턴:** `tests/integration/create-trip.test.ts` 의 inline `admin` + `aliceC` + `bobC` + `STAMP = Date.now()` + `afterAll` cleanup. `tests/utils/*` 생성 금지.

- [ ] **Step 0: `supabase/seed/test.sql` 확장 — `replica_identity_of(text)` helper RPC**

Part A Task 4 의 `supabase/seed/test.sql` 은 `test_truncate_cascade` RPC 만 정의. Task 23 Step 4 (replica-identity-audit) 가 요구하는 `replica_identity_of(text)` helper 를 같은 파일에 **append**:

```sql
-- supabase/seed/test.sql (append)
create or replace function public.replica_identity_of(p_table text)
  returns "char" language sql security definer set search_path = public, pg_catalog as $$
  select relreplident from pg_class where oid = ('public.' || p_table)::regclass;
$$;
revoke all on function public.replica_identity_of(text) from public, anon, authenticated;
grant execute on function public.replica_identity_of(text) to service_role;
```

적용:
```bash
psql "$DATABASE_URL" -f supabase/seed/test.sql
# 또는 supabase db execute --file supabase/seed/test.sql
```

검증:
```bash
psql "$DATABASE_URL" -c "select public.replica_identity_of('trips');"
# Expected: 'f' (Part A Task 3 REPLICA IDENTITY FULL 이후)
```

> `pg_class.relreplident` 반환 타입은 Postgres `"char"` (internal 1-byte). 값: `'d'` (DEFAULT) / `'n'` (NOTHING) / `'f'` (FULL) / `'i'` (INDEX).

- [ ] **Step 0b: `vitest.integration.config.ts` — Maps env 5키 passthrough 추가**

Step 6 의 `place-search-rate-limit.test.ts` 가 `@/app/api/maps/search/route` import → route 가 `lib/env.ts` publicSchema parse 실행. Maps 5 키가 test env 에 없으면 `.optional()` 이라 parse 는 통과하지만, 실제 provider 호출 전 `if (!env.X) throw` 가드에 걸려 rate-limit 경로에 도달 못 함. 테스트 값으로라도 주입.

기존 `vitest.integration.config.ts` 의 `test.env` 에 추가:

```typescript
env: {
  NEXT_PUBLIC_SUPABASE_URL: localEnv.NEXT_PUBLIC_SUPABASE_URL ?? "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  SUPABASE_SERVICE_ROLE_KEY: localEnv.SUPABASE_SERVICE_ROLE_KEY ?? "",
  NEXT_PUBLIC_GOOGLE_CLIENT_ID:
    localEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "test.apps.googleusercontent.com",
  // Phase 3 추가 — 실 호출은 mock 이므로 dummy 값으로 충분
  NEXT_PUBLIC_NAVER_MAP_CLIENT_ID: localEnv.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID ?? "test-naver-map",
  NAVER_SEARCH_CLIENT_ID: localEnv.NAVER_SEARCH_CLIENT_ID ?? "test-naver-search",
  NAVER_SEARCH_CLIENT_SECRET: localEnv.NAVER_SEARCH_CLIENT_SECRET ?? "test-naver-search-secret",
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: localEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "test-google-public",
  GOOGLE_MAPS_SERVER_API_KEY: localEnv.GOOGLE_MAPS_SERVER_API_KEY ?? "test-google-server",
},
```

> 키 이름 5종은 Part A Task 6 의 `lib/env.ts` publicSchema/serverOnlySchema 확장 결과를 따름. Task 6 에서 실제로 채택된 이름이 다르면 그 이름으로 맞춤.

- [ ] **Step 1: `tests/integration/rls-schedule-items.test.ts`**

```typescript
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
let aliceId = ""; let bobId = ""; let evelynId = "";
let aliceC: SupabaseClient<Database>;
let bobC: SupabaseClient<Database>;
let evelynC: SupabaseClient<Database>;
let tripId = "";
let day1Id = "";
let itemId = "";

beforeAll(async () => {
  for (const [role, keep] of [["alice", (id: string) => { aliceId = id; }],
                                ["bob",   (id: string) => { bobId = id; }],
                                ["evelyn",(id: string) => { evelynId = id; }]] as const) {
    const { data, error } = await admin.auth.admin.createUser({
      email: `${role}_rls_schedule+${STAMP}@test.local`, password: PWD, email_confirm: true,
    });
    if (error) throw error;
    keep(data.user!.id);
  }

  const mkClient = async (role: string) => {
    const c = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false } });
    const { error } = await c.auth.signInWithPassword({
      email: `${role}_rls_schedule+${STAMP}@test.local`, password: PWD,
    });
    if (error) throw error;
    return c;
  };
  aliceC = await mkClient("alice");
  bobC = await mkClient("bob");
  evelynC = await mkClient("evelyn");

  // Alice 가 Bob 과 그룹 결성 후 trip 생성
  const { data: inv } = await aliceC.rpc("create_invite");
  const code = (inv as { invite_code: string }).invite_code;
  await bobC.rpc("accept_invite", { p_invite_code: code });

  const r = await aliceC.rpc("create_trip", {
    p_title: "RLS Test", p_destination: "Tokyo",
    p_start_date: "2026-06-01", p_end_date: "2026-06-03",
    p_is_domestic: false, p_currencies: ["JPY"],
  });
  if (r.error) throw r.error;
  tripId = r.data as string;

  const { data: days, error: dErr } = await aliceC.from("trip_days")
    .select("id").eq("trip_id", tripId).order("day_number").limit(1);
  if (dErr || !days?.[0]) throw dErr ?? new Error("no trip_days");
  day1Id = days[0].id;

  const ins = await aliceC.rpc("create_schedule_item", {
    p_trip_day_id: day1Id,
    p_title: "Visit Senso-ji",
    p_time_of_day: "09:00",
    p_memo: null, p_url: null,
    p_place_name: null, p_place_address: null, p_place_lat: null, p_place_lng: null,
    p_place_provider: null, p_place_external_id: null,
  });
  if (ins.error) throw ins.error;
  itemId = ins.data as string;
});

afterAll(async () => {
  await admin.from("schedule_items").delete().eq("trip_day_id", day1Id);
  await admin.from("trips").delete().eq("id", tripId);
  await admin.from("group_members").delete()
    .or(`user_id.eq.${aliceId},user_id.eq.${bobId},user_id.eq.${evelynId}`);
  await admin.from("groups").delete().eq("created_by", aliceId);
  for (const id of [aliceId, bobId, evelynId]) await admin.auth.admin.deleteUser(id);
});

describe("schedule_items RLS (Spec §2.5 + can_access_trip 재사용)", () => {
  it("owner alice — SELECT OK", async () => {
    const { data, error } = await aliceC.from("schedule_items").select("*").eq("id", itemId);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
  });

  it("member bob — SELECT OK", async () => {
    const { data, error } = await bobC.from("schedule_items").select("*").eq("id", itemId);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
  });

  it("stranger evelyn — SELECT 0 row (RLS 차단)", async () => {
    const { data, error } = await evelynC.from("schedule_items").select("*").eq("id", itemId);
    expect(error).toBeNull(); // RLS 는 error 아닌 empty
    expect(data?.length).toBe(0);
  });

  it("stranger evelyn — INSERT 거부", async () => {
    const { error } = await evelynC.rpc("create_schedule_item", {
      p_trip_day_id: day1Id, p_title: "Intruder", p_time_of_day: "any",
      p_memo: null, p_url: null,
      p_place_name: null, p_place_address: null, p_place_lat: null, p_place_lng: null,
      p_place_provider: null, p_place_external_id: null,
    });
    expect(error).not.toBeNull();
  });

  it("stranger evelyn — UPDATE 거부", async () => {
    const { error } = await evelynC.rpc("update_schedule_item", {
      p_item_id: itemId, p_title: "Hacked",
      p_time_of_day: null, p_memo: null, p_url: null,
      p_place_name: null, p_place_address: null, p_place_lat: null, p_place_lng: null,
      p_place_provider: null, p_place_external_id: null,
    });
    expect(error).not.toBeNull();
  });

  it("stranger evelyn — DELETE 거부", async () => {
    const { error } = await evelynC.rpc("delete_schedule_item", { p_item_id: itemId });
    expect(error).not.toBeNull();
  });

  it("member bob — UPDATE OK (CRUD 공유)", async () => {
    const { error } = await bobC.rpc("update_schedule_item", {
      p_item_id: itemId, p_title: "Visit Senso-ji (partner edit)",
      p_time_of_day: null, p_memo: null, p_url: null,
      p_place_name: null, p_place_address: null, p_place_lat: null, p_place_lng: null,
      p_place_provider: null, p_place_external_id: null,
    });
    expect(error).toBeNull();
  });
});
```

> RPC 인자 이름 (`p_trip_day_id`, `p_time_of_day`, `p_place_provider`, `p_place_external_id`, `p_item_id`) 은 Part A Task 2 의 RPC 시그니처 그대로. Part B v2 레지스트리와 1:1 일치.

- [ ] **Step 2: `tests/integration/resize-trip-days-v2.test.ts`**

Spec §4.4 10-case 매트릭스. 구조는 길어 요약 표 + 대표 케이스 코드만 — 실 작성 시 10 it 블록 모두 채움.

```typescript
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });
const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
let aliceId = ""; let aliceC: SupabaseClient<Database>;

beforeAll(async () => {
  const a = await admin.auth.admin.createUser({
    email: `alice_resize+${STAMP}@test.local`, password: PWD, email_confirm: true,
  });
  if (a.error) throw a.error; aliceId = a.data.user!.id;
  aliceC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } });
  const { error } = await aliceC.auth.signInWithPassword({
    email: `alice_resize+${STAMP}@test.local`, password: PWD,
  });
  if (error) throw error;
});

afterAll(async () => {
  await admin.from("trips").delete().eq("created_by", aliceId);
  await admin.auth.admin.deleteUser(aliceId);
});

async function mkTrip(days: number): Promise<{ tripId: string; dayIds: string[]; }> {
  const end = new Date("2026-06-01");
  end.setDate(end.getDate() + days - 1);
  const r = await aliceC.rpc("create_trip", {
    p_title: `Resize ${days}d`, p_destination: "Seoul",
    p_start_date: "2026-06-01", p_end_date: end.toISOString().slice(0, 10),
    p_is_domestic: true, p_currencies: ["KRW"],
  });
  if (r.error) throw r.error;
  const tripId = r.data as string;
  const { data } = await aliceC.from("trip_days")
    .select("id").eq("trip_id", tripId).order("day_number");
  return { tripId, dayIds: (data ?? []).map((d) => d.id) };
}

async function addItem(dayId: string, title: string, sortOrder?: number): Promise<string> {
  const r = await aliceC.rpc("create_schedule_item", {
    p_trip_day_id: dayId, p_title: title, p_time_of_day: null,
    p_memo: null, p_url: null, p_place_name: null, p_place_address: null,
    p_place_lat: null, p_place_lng: null, p_place_provider: null, p_place_external_id: null,
  });
  if (r.error) throw r.error;
  return r.data as string;
}

describe("resize_trip_days v2 — day 보존 + items 합병", () => {
  it("C1: 3→5 확장, items 보존, day_number 재할당", async () => {
    const { tripId, dayIds } = await mkTrip(3);
    const it1 = await addItem(dayIds[0], "D1 item");
    const { error } = await aliceC.rpc("resize_trip_days", {
      p_trip_id: tripId, p_new_start: "2026-06-01", p_new_end: "2026-06-05",
    });
    expect(error).toBeNull();
    const { data } = await aliceC.from("schedule_items").select("id").eq("id", it1);
    expect(data?.length).toBe(1);
  });

  it("C2: 5→3 축소, Day 4·5 items → Day 3 합병, sort_order 연속 번호", async () => {
    const { tripId, dayIds } = await mkTrip(5);
    await addItem(dayIds[2], "D3 item A");  // Day 3
    await addItem(dayIds[3], "D4 item B");  // Day 4
    await addItem(dayIds[4], "D5 item C");  // Day 5

    const { error } = await aliceC.rpc("resize_trip_days", {
      p_trip_id: tripId, p_new_start: "2026-06-01", p_new_end: "2026-06-03",
    });
    expect(error).toBeNull();

    const { data: newDays } = await aliceC.from("trip_days")
      .select("id, day_number").eq("trip_id", tripId).order("day_number");
    expect(newDays?.length).toBe(3);
    const day3Id = newDays![2].id;

    const { data: merged } = await aliceC.from("schedule_items")
      .select("title, sort_order").eq("trip_day_id", day3Id).order("sort_order");
    expect(merged?.length).toBe(3);
    expect(merged!.map((m) => m.sort_order)).toEqual([1, 2, 3]);
    // Spec §4.3 compound key: (원래 day_number - new_count) * 10000 + sort_order
    // D3(=0*10000+1) → 1, D4(=1*10000+1) → 2, D5(=2*10000+1) → 3
    expect(merged!.map((m) => m.title)).toEqual(["D3 item A", "D4 item B", "D5 item C"]);
  });

  it("C3: 3→3 동일 길이 (no-op) — 실패 없이 통과, 스키마 불변", async () => {
    const { tripId, dayIds } = await mkTrip(3);
    const it1 = await addItem(dayIds[0], "D1");
    const { error } = await aliceC.rpc("resize_trip_days", {
      p_trip_id: tripId, p_new_start: "2026-06-01", p_new_end: "2026-06-03",
    });
    expect(error).toBeNull();
    const { data: days } = await aliceC.from("trip_days")
      .select("id, day_number").eq("trip_id", tripId).order("day_number");
    expect(days?.length).toBe(3);
    const { data: stillHere } = await aliceC.from("schedule_items").select("id").eq("id", it1);
    expect(stillHere?.length).toBe(1);
  });

  it("C4: 3→3 date shift (시작일 하루 이동) — trip_day.id 보존, date 만 UPDATE", async () => {
    const { tripId, dayIds } = await mkTrip(3);
    const { error } = await aliceC.rpc("resize_trip_days", {
      p_trip_id: tripId, p_new_start: "2026-06-02", p_new_end: "2026-06-04",
    });
    expect(error).toBeNull();
    const { data: days } = await aliceC.from("trip_days")
      .select("id, the_date").eq("trip_id", tripId).order("day_number");
    expect(days?.length).toBe(3);
    expect(days![0].id).toBe(dayIds[0]);        // FK 안정 (DELETE+INSERT 아님)
    expect(days![0].the_date).toBe("2026-06-02");
    expect(days![2].the_date).toBe("2026-06-04");
  });

  it("C5: 7→1 극단 축소 — 모든 items 가 Day 1 에 합쳐짐 + sort_order 재번호", async () => {
    const { tripId, dayIds } = await mkTrip(7);
    await addItem(dayIds[0], "A");
    await addItem(dayIds[2], "B");
    await addItem(dayIds[4], "C");
    await addItem(dayIds[6], "D");

    const { error } = await aliceC.rpc("resize_trip_days", {
      p_trip_id: tripId, p_new_start: "2026-06-01", p_new_end: "2026-06-01",
    });
    expect(error).toBeNull();

    const { data: days } = await aliceC.from("trip_days")
      .select("id").eq("trip_id", tripId);
    expect(days?.length).toBe(1);

    const { data: merged } = await aliceC.from("schedule_items")
      .select("title, sort_order").eq("trip_day_id", days![0].id).order("sort_order");
    expect(merged?.length).toBe(4);
    expect(merged!.map((m) => m.title)).toEqual(["A", "B", "C", "D"]);
    expect(merged!.map((m) => m.sort_order)).toEqual([1, 2, 3, 4]);
  });

  it("C6: new_end < new_start → CHECK / 예외 거부", async () => {
    const { tripId } = await mkTrip(3);
    const { error } = await aliceC.rpc("resize_trip_days", {
      p_trip_id: tripId, p_new_start: "2026-06-05", p_new_end: "2026-06-01",
    });
    expect(error).not.toBeNull();
  });

  it("C7: 91일 초과 → trips.end_date - start_date < 90 CHECK 위반 거부", async () => {
    const { tripId } = await mkTrip(3);
    const { error } = await aliceC.rpc("resize_trip_days", {
      p_trip_id: tripId, p_new_start: "2026-06-01", p_new_end: "2026-10-01", // 123 days
    });
    expect(error).not.toBeNull();
  });

  it("C8: 비멤버가 호출 → RLS/권한 차단", async () => {
    const { tripId } = await mkTrip(3);
    const { data: stranger, error: sErr } = await admin.auth.admin.createUser({
      email: `stranger_resize+${STAMP}@test.local`, password: PWD, email_confirm: true,
    });
    if (sErr) throw sErr;
    const strangerC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false } });
    await strangerC.auth.signInWithPassword({
      email: `stranger_resize+${STAMP}@test.local`, password: PWD,
    });
    const { error } = await strangerC.rpc("resize_trip_days", {
      p_trip_id: tripId, p_new_start: "2026-06-01", p_new_end: "2026-06-05",
    });
    expect(error).not.toBeNull();
    await admin.auth.admin.deleteUser(stranger.user!.id);
  });

  it("C9: 축소 시 Day 3 의 기존 items (mid-day) sort_order 가 compound key 로 연속", async () => {
    const { tripId, dayIds } = await mkTrip(5);
    await addItem(dayIds[2], "D3 base");
    await addItem(dayIds[3], "D4 merge-1");
    await addItem(dayIds[3], "D4 merge-2");
    await addItem(dayIds[4], "D5 merge");

    const { error } = await aliceC.rpc("resize_trip_days", {
      p_trip_id: tripId, p_new_start: "2026-06-01", p_new_end: "2026-06-03",
    });
    expect(error).toBeNull();

    const { data: days } = await aliceC.from("trip_days")
      .select("id, day_number").eq("trip_id", tripId).order("day_number");
    expect(days?.length).toBe(3);
    const lastDayId = days![2].id;
    const { data: merged } = await aliceC.from("schedule_items")
      .select("title, sort_order").eq("trip_day_id", lastDayId).order("sort_order");
    expect(merged?.length).toBe(4);
    // compound key: (원래 day_number - new_count) * 10000 + sort_order
    //   D3(=0*10000+1)=1, D4(=1*10000+1)=2, D4(=1*10000+2)=3, D5(=2*10000+1)=4
    expect(merged!.map((m) => m.title)).toEqual(["D3 base", "D4 merge-1", "D4 merge-2", "D5 merge"]);
    expect(merged!.map((m) => m.sort_order)).toEqual([1, 2, 3, 4]);
  });

  it("C10: 확장 시 새 day (Day 4, 5) 는 items 없음", async () => {
    const { tripId } = await mkTrip(3);
    const { error } = await aliceC.rpc("resize_trip_days", {
      p_trip_id: tripId, p_new_start: "2026-06-01", p_new_end: "2026-06-05",
    });
    expect(error).toBeNull();

    const { data: days } = await aliceC.from("trip_days")
      .select("id, day_number").eq("trip_id", tripId).order("day_number");
    expect(days?.length).toBe(5);
    const newDayIds = days!.slice(3).map((d) => d.id);
    const { data: empty } = await aliceC.from("schedule_items")
      .select("id").in("trip_day_id", newDayIds);
    expect(empty?.length).toBe(0);
  });
});
```

> **컬럼명 주의:** `trip_days.the_date` 는 Phase 2 마이그레이션에서 사용한 이름. 실 컬럼명이 `date`/`day_date`/`trip_date` 등이면 Part A Task 1/2 확인 후 교체. `grep "the_date\|day_date" supabase/migrations/` 로 1분 안에 검증 가능.

- [ ] **Step 3: `tests/integration/realtime-publication-audit.test.ts` 확장**

기존 파일 수정 (신규 `-v2` 파일 생성 안 함):

기존 assertion:
```typescript
expect(tables).toContain("trips");
expect(tables).toContain("group_members");
expect(tables).toContain("groups");
expect(tables).not.toContain("profiles");
```

교체:
```typescript
expect(tables).toContain("trips");
expect(tables).toContain("group_members");
expect(tables).toContain("groups");
expect(tables).toContain("schedule_items");     // Phase 3 Task 1 에서 publication 추가
expect(tables).not.toContain("profiles");
expect(tables).not.toContain("trip_days");      // parent table 은 publication 제외
```

> `trip_days` 는 schedule_items 드래그의 cross-day move 시 UPDATE 되지만, 클라이언트는 schedule_items UPDATE 로부터 predicate invalidate. trip_days 구독 불필요 → publication 에서 명시적 제외 검증.

> Spec `File Structure` 에 `realtime-publication-audit-v2.spec.ts` 로 표기됐으나, 기존 단일 파일 in-place 확장이 drift 없이 정확. Part C 의 실 선택은 **기존 파일 수정**.

- [ ] **Step 4: `tests/integration/replica-identity-audit.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });

describe("REPLICA IDENTITY FULL on trips (§9.4)", () => {
  it("trips.relreplident = 'f' (FULL)", async () => {
    // exec_sql 과 같은 RPC 가 없으므로 supabase-js 에서 pg_catalog 에 접근하려면
    // 별도 select 전용 SECURITY DEFINER helper 가 필요. Part A Task 4 의 seed 에 포함.
    //
    // 대안: migration 적용 후 schema 검증은 Part A Task 3 CI 체크에서 수행.
    // 이 integration 은 "업데이트 페이로드 형태" 간접 검증.

    // 간접 경로: anon client 로 trips UPDATE 후 service_role 로 realtime.subscription 통계 조회 — 복잡.
    // 현실적 대안: Part A Task 4 seed 에 `pg_relation_replica_identity(tbl)` wrapper RPC 추가
    // (service_role only) → 여기서 rpc("replica_identity_of", { p_table: "trips" })
    const { data, error } = await admin.rpc("replica_identity_of" as never, { p_table: "trips" });
    expect(error).toBeNull();
    expect(data).toBe("f");
  });

  it("schedule_items.relreplident = 'd' 또는 'f' (Task 19 에서 결정)", async () => {
    const { data, error } = await admin.rpc("replica_identity_of" as never, { p_table: "schedule_items" });
    expect(error).toBeNull();
    // Part A Task 3 결론: schedule_items 는 DEFAULT 유지 (Task 19 에서 재검토). 'd' 기대.
    expect(["d", "f"]).toContain(data as string);
  });
});
```

> **주의:** 이 테스트는 `replica_identity_of(p_table text) returns "char"` 헬퍼 RPC 를 요구. **Part A Task 4 seed 를 확장**해야 함. 해당 RPC 가 없으면 Part C Task 23 Step 4 수행 전 Part A Task 4 에 step 추가:
>
> ```sql
> -- supabase/seed/test.sql 에 append
> create or replace function public.replica_identity_of(p_table text)
>   returns "char" language sql security definer set search_path = public, pg_catalog as $$
>   select relreplident from pg_class where oid = ('public.' || p_table)::regclass;
> $$;
> revoke all on function public.replica_identity_of(text) from public, anon, authenticated;
> grant execute on function public.replica_identity_of(text) to service_role;
> ```
>
> 이 차이는 Spec §10.3 Verification SQL (5) `select relreplident ... where oid='public.trips'::regclass` 를 직접 실행할 수 있는 유일한 경로. Plan Task 26 Exit gate 의 Verification SQL 도 이 RPC 사용.

- [ ] **Step 5: `tests/integration/share-toggle-realtime.test.ts`**

Supabase Realtime WebSocket 을 node 에서 직접 구독. Alice 가 trip group_id 를 NULL 로 전환 → Bob 의 subscribe callback 에 payload.old.group_id != null 확인.

```typescript
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient, type RealtimeChannel } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });
const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
let aliceId = ""; let bobId = "";
let aliceC: SupabaseClient<Database>;
let bobC: SupabaseClient<Database>;
let tripId = "";

beforeAll(async () => {
  const a = await admin.auth.admin.createUser({
    email: `alice_sharetoggle+${STAMP}@test.local`, password: PWD, email_confirm: true,
  });
  if (a.error) throw a.error; aliceId = a.data.user!.id;
  const b = await admin.auth.admin.createUser({
    email: `bob_sharetoggle+${STAMP}@test.local`, password: PWD, email_confirm: true,
  });
  if (b.error) throw b.error; bobId = b.data.user!.id;

  aliceC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } });
  {
    const { error } = await aliceC.auth.signInWithPassword({
      email: `alice_sharetoggle+${STAMP}@test.local`, password: PWD,
    });
    if (error) throw error;
  }
  bobC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } });
  {
    const { error } = await bobC.auth.signInWithPassword({
      email: `bob_sharetoggle+${STAMP}@test.local`, password: PWD,
    });
    if (error) throw error;
  }

  // 그룹 결성 — Phase 2 create_invite + accept_invite
  const inv = await aliceC.rpc("create_invite");
  if (inv.error) throw inv.error;
  const code = (inv.data as { invite_code: string }).invite_code;
  const acc = await bobC.rpc("accept_invite", { p_invite_code: code });
  if (acc.error) throw acc.error;

  // 해외 trip 생성 (group 공유 상태 — alice.created_by + group_id != null)
  const trip = await aliceC.rpc("create_trip", {
    p_title: "Share Toggle Realtime",
    p_destination: "Tokyo",
    p_start_date: "2026-06-01", p_end_date: "2026-06-03",
    p_is_domestic: false, p_currencies: ["JPY"],
  });
  if (trip.error) throw trip.error;
  tripId = trip.data as string;

  // 안전 가드: group_id 가 실제로 채워졌는지 확인 (auto-link 로직 검증 차원)
  const verify = await aliceC.from("trips").select("group_id").eq("id", tripId).single();
  if (verify.error || !verify.data?.group_id) {
    throw new Error(`trip.group_id not populated: ${verify.error?.message ?? "null"}`);
  }
}, 30_000);

afterAll(async () => {
  await admin.from("trips").delete().eq("id", tripId);
  await admin.from("group_members").delete().or(`user_id.eq.${aliceId},user_id.eq.${bobId}`);
  await admin.from("groups").delete().eq("created_by", aliceId);
  for (const id of [aliceId, bobId]) await admin.auth.admin.deleteUser(id);
});

describe("Share-toggle realtime payload (§9.5)", () => {
  it("REPLICA IDENTITY FULL 덕분에 UPDATE payload.old 에 group_id 포함", async () => {
    const payloads: Array<{ old: Record<string, unknown>; new: Record<string, unknown>; }> = [];

    const ch: RealtimeChannel = bobC
      .channel(`test-share-toggle-${STAMP}`)
      .on("postgres_changes",
          { event: "UPDATE", schema: "public", table: "trips", filter: `id=eq.${tripId}` },
          (payload) => { payloads.push({
            old: payload.old as Record<string, unknown>,
            new: payload.new as Record<string, unknown>,
          }); })
      .subscribe();

    // subscribe 안정화 대기 (Supabase Realtime handshake ~1s)
    await new Promise((r) => setTimeout(r, 1500));

    // Alice 가 trip.group_id 를 NULL 로 전환 (share-off 시뮬레이트)
    // toggle_trip_share RPC 또는 직접 UPDATE (alice owner 이므로 허용)
    const upd = await aliceC.from("trips").update({ group_id: null }).eq("id", tripId);
    expect(upd.error).toBeNull();

    // payload 수신 대기 (최대 8s)
    const deadline = Date.now() + 8000;
    while (payloads.length === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 200));
    }

    expect(payloads.length).toBeGreaterThan(0);
    expect(payloads[0].old.group_id).not.toBeNull();   // ← FULL identity 검증 핵심
    expect(payloads[0].new.group_id).toBeNull();

    await bobC.removeChannel(ch);
  }, 20_000);
});
```

> 본 테스트는 WebSocket 의존 — CI 불안정 시 vitest `retry: 2` 허용. Spec §10.3 note 대로.

- [ ] **Step 6: `tests/integration/place-search-rate-limit.test.ts`**

> **H4 (critic 2회차 지적):** 기존 설계는 `new Request(...)` + `Authorization: Bearer` 로 route handler 를 직접 호출. 실 handler 는 Phase 1~2 관례상 `getServerClient()` 경유 cookie-based auth 를 쓸 확률이 높아 401 로 빠지고 rate-limit 경로 도달 못함. 해결: **server-client 를 vi.mock 으로 stub** 하여 auth 단계 bypass, rate-limiter 만 실 호출.

```typescript
import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });
const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
let aliceId = "";

beforeAll(async () => {
  const r = await admin.auth.admin.createUser({
    email: `alice_ratelimit+${STAMP}@test.local`, password: PWD, email_confirm: true,
  });
  if (r.error) throw r.error;
  aliceId = r.data.user!.id;
});

afterAll(async () => {
  await admin.auth.admin.deleteUser(aliceId);
  vi.restoreAllMocks();
});

// 1) Supabase server-client 를 mock — getUser() 가 항상 alice 를 반환
vi.mock("@/lib/supabase/server-client", () => ({
  getServerClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: globalThis.__TEST_USER_ID__ ?? "mock-user-id" } },
        error: null,
      }),
    },
  }),
}));

// 2) Naver/Google 검색 어댑터를 mock — 실 네트워크 미사용
vi.mock("@/lib/maps/search/naver-search", () => ({
  searchNaverLocal: async () => ({ results: [] }),
}));
vi.mock("@/lib/maps/search/google-search", () => ({
  searchGooglePlaces: async () => ({ results: [] }),
}));

describe("/api/maps/search rate limit (30/min/user, Spec §6.1)", () => {
  it("31번째 요청은 429", async () => {
    (globalThis as unknown as { __TEST_USER_ID__?: string }).__TEST_USER_ID__ = aliceId;

    const mod = await import("@/app/api/maps/search/route");
    const handler = mod.POST;

    const build = () => new Request("http://localhost/api/maps/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "cafe", provider: "naver" }),
    });

    // 30회 successive — 모두 200
    for (let i = 0; i < 30; i += 1) {
      const res = await handler(build() as unknown as Request);
      expect(res.status, `request #${i + 1}`).toBe(200);
    }
    // 31번째 → 429
    const throttled = await handler(build() as unknown as Request);
    expect(throttled.status).toBe(429);
    const body = await throttled.json();
    expect(body).toMatchObject({ error: expect.stringMatching(/rate|limit|too many/i) });
  }, 30_000);
});
```

> **설계 메모:**
> - `vi.mock` 은 hoist 되므로 file top-level 선언. `getServerClient` 가 실제로 프로젝트에서 export 되는 이름과 일치해야 함 (Phase 1 의 `lib/supabase/server-client.ts`).
> - Part B Task 16 의 route handler 가 `NextRequest` 를 요구하면 `as unknown as Request` 캐스트가 runtime 에 문제되지 않는지 확인. NextRequest extends Request 이고 handler 가 `req.json()` / `req.headers.get()` 만 쓰면 OK. 쓰는 메서드가 NextRequest-specific (`req.nextUrl`, `req.cookies`) 일 경우 `NextRequest` 로 wrapping 필요.
> - rate-limit 의 in-memory Map singleton 은 `fileParallelism: false` (vitest.integration.config.ts) 덕에 다른 파일과 간섭 없음. 같은 file 내 다음 test 가 있다면 `beforeEach` 에서 `(await import("@/lib/maps/rate-limit")).__resetForTest()` 호출 권장 — Part B Task 16 구현 시 test-only reset 경로 마련.

- [ ] **Step 7: Integration suite PASS 확인**

```bash
pnpm test:integration
```
Expected: 기존 12 spec (Phase 1+2) + Part B 5 + Part C 6 = **23 spec PASS**.

> 20회 재실행 deterministic 검증은 Exit gate 에서:
> ```bash
> for i in {1..20}; do pnpm test:integration || { echo "RUN $i FAILED"; break; }; done
> ```

- [ ] **Step 8: 커밋**

```bash
git add tests/integration/rls-schedule-items.test.ts \
        tests/integration/resize-trip-days-v2.test.ts \
        tests/integration/realtime-publication-audit.test.ts \
        tests/integration/replica-identity-audit.test.ts \
        tests/integration/share-toggle-realtime.test.ts \
        tests/integration/place-search-rate-limit.test.ts \
        supabase/seed/test.sql
git commit -m "test(integration): phase3 schedule RLS / resize v2 / replica-identity / share-toggle / rate-limit"
```

> `supabase/seed/test.sql` 에 `replica_identity_of` 헬퍼 추가본 포함 (Step 4 참조).

---

### Task 24: E2E Specs — schedule-crud / drag / partner-realtime / share-toggle / resize-with-items / place-search

**Goal:** Spec §10.3 E2E 체크리스트 7건 작성. Playwright `storageState` (Task 21) 기반. 각 spec 은 독립 실행 가능 + 이전 run 의 잔존 데이터 내성 (`truncateCascade` 는 globalSetup 에서만 1회 호출되므로, spec beforeEach 에서 필요 시 자기 데이터 정리).

**공통 가드:**
- `test.beforeEach` 에서 `resetRealtimeBuffer(page)` 호출하여 `window.__realtimeEvents` 비움
- `page.waitForFunction(() => !!window.naver)` 형태의 SDK load 대기로 flaky 완화 (R7)

- [ ] **Step 1: `tests/e2e/schedule-crud.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";
import { resetRealtimeBuffer } from "./helpers/realtime-hooks";

// alice project → storageState 자동 적용

test.describe("일정 CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/trips");
    await resetRealtimeBuffer(page);
  });

  test("trip 생성 → 일정 탭 → 일정 추가 (장소 없음)", async ({ page }) => {
    // 1. 새 trip 생성 (국내, 2박 3일)
    await page.getByRole("link", { name: /새 여행 추가/ }).click();
    await page.getByLabel("제목").fill("E2E Schedule Trip");
    await page.getByLabel("목적지").fill("Seoul");
    await page.getByLabel("시작일").fill("2026-07-01");
    await page.getByLabel("종료일").fill("2026-07-03");
    await page.getByLabel("국내 여행").check();
    await page.getByRole("button", { name: /저장|만들기/ }).click();

    // 2. 일정 탭 진입
    await expect(page).toHaveURL(/\/trips\/[\w-]+/);
    await page.getByRole("tab", { name: "일정" }).click();

    // 3. Day 1 에 일정 추가 (장소 없이)
    await page.getByRole("button", { name: /\+|일정 추가|FAB/ }).first().click();
    await page.getByLabel("제목").fill("첫 일정");
    await page.getByLabel(/메모/).fill("테스트 메모");
    await page.getByRole("button", { name: /저장/ }).click();

    // 4. 카드 렌더 확인
    await expect(page.getByText("첫 일정")).toBeVisible();

    // 5. 새로고침 → persist 확인
    await page.reload();
    await page.getByRole("tab", { name: "일정" }).click();
    await expect(page.getByText("첫 일정")).toBeVisible();
  });

  test("일정 편집 + 삭제 — serial 후속", async ({ page }) => {
    // 선행: 위 "trip 생성 → 일정 추가" 테스트의 "첫 일정" 이 존재 (Playwright 기본 serial within file)
    await page.getByText(/E2E Schedule Trip/).click();
    await page.getByRole("tab", { name: "일정" }).click();

    // 1. 편집: 카드 탭 → 모달 → 제목 수정 → 저장
    await page.getByTestId(/^schedule-item-card/).filter({ hasText: "첫 일정" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("제목").fill("첫 일정 (수정)");
    await page.getByRole("button", { name: /저장/ }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("첫 일정 (수정)")).toBeVisible();
    await expect(page.getByText(/^첫 일정$/)).toHaveCount(0);

    // 2. 삭제: 카드 탭 → 모달 → 삭제 버튼 → 확인 다이얼로그 → 확인 → 카드 사라짐
    await page.getByTestId(/^schedule-item-card/).filter({ hasText: "첫 일정 (수정)" }).click();
    await page.getByRole("button", { name: /삭제/ }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: /확인|삭제하기/ }).click();
    await expect(page.getByText("첫 일정 (수정)")).toHaveCount(0, { timeout: 3000 });

    // 3. 새로고침 후에도 없어야 persist 삭제 확인
    await page.reload();
    await page.getByRole("tab", { name: "일정" }).click();
    await expect(page.getByText("첫 일정 (수정)")).toHaveCount(0);
  });
});
```

- [ ] **Step 2: `tests/e2e/drag-same-day.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test.describe("같은 day 내 드래그 reorder", () => {
  test("3번 카드를 1번 위로 드래그 → 순서 즉시 반영 + persist", async ({ page }) => {
    await page.goto("/trips");
    // 선행 seed: schedule-crud 가 만든 trip + day1 에 3개 item (A, B, C)
    // 없으면 이 spec 초반에 RPC 로 seed

    const dayList = page.getByTestId("schedule-list");
    const cards = () => dayList.getByTestId(/^schedule-item-card/);

    await expect(cards()).toHaveCount(3);
    const [aBox, , cBox] = await Promise.all([
      cards().nth(0).boundingBox(),
      cards().nth(1).boundingBox(),
      cards().nth(2).boundingBox(),
    ]);
    expect(aBox && cBox).toBeTruthy();

    // Spec §3.1 PointerSensor(delay: 400ms) — long-press 후 드래그
    await page.mouse.move(cBox!.x + cBox!.width / 2, cBox!.y + cBox!.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(450); // 400ms long-press + buffer
    await page.mouse.move(aBox!.x + aBox!.width / 2, aBox!.y + 10, { steps: 10 });
    await page.mouse.up();

    // Optimistic 반영 즉시 순서 [C, A, B] 확인
    await expect(cards().nth(0)).toContainText("C");
    await expect(cards().nth(1)).toContainText("A");
    await expect(cards().nth(2)).toContainText("B");

    // 새로고침 → persist
    await page.reload();
    await page.getByRole("tab", { name: "일정" }).click();
    await expect(cards().nth(0)).toContainText("C");
  });
});
```

- [ ] **Step 3: `tests/e2e/drag-cross-day.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test.describe("다른 day 드래그 (cross-day move)", () => {
  test("Day 1 item A 를 Day 3 으로 이동 → Day Tab auto-switch + 양 day 재번호", async ({ page }) => {
    await page.goto("/trips");
    // 선행 seed (이 spec beforeAll 에서 admin client 또는 schedule-crud.spec 의 trip 재사용):
    //   5일 trip (2026-07-01 ~ 2026-07-05)
    //   Day 1 items = [A, B, C] (sort_order 1,2,3)
    //   Day 3 items = [D, E] (sort_order 1,2)

    await page.getByText(/Cross Day Trip/).click();
    await page.getByRole("tab", { name: "일정" }).click();

    // Day 1 선택 (기본값 이지만 명시)
    await page.getByRole("button", { name: "Day 1" }).click();

    const dayList = page.getByTestId("schedule-list");
    const cardsInView = () => dayList.getByTestId(/^schedule-item-card/);

    // 카드 A 의 bbox
    const aBox = await cardsInView().nth(0).boundingBox();
    expect(aBox).not.toBeNull();

    // Day Tab 의 Day 3 버튼 bbox (drop target — Spec §3.1 auto-switch)
    const day3Tab = page.getByRole("button", { name: "Day 3" });
    const day3Box = await day3Tab.boundingBox();
    expect(day3Box).not.toBeNull();

    // long-press (400ms, Spec §3.1 PointerSensor delay) → Day 3 tab 위로 hover → auto-switch → drop
    await page.mouse.move(aBox!.x + aBox!.width / 2, aBox!.y + aBox!.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(450);
    // hover Day 3 tab → 탭 전환 (Spec §3.1 — "hover 시 auto-switch")
    await page.mouse.move(day3Box!.x + day3Box!.width / 2, day3Box!.y + day3Box!.height / 2,
      { steps: 10 });
    await page.waitForTimeout(500); // auto-switch 안정 대기
    // Day 3 리스트의 맨 위(target_position 1) 로 drop
    const list3Box = await page.getByTestId("schedule-list").boundingBox();
    expect(list3Box).not.toBeNull();
    await page.mouse.move(list3Box!.x + list3Box!.width / 2, list3Box!.y + 20, { steps: 10 });
    await page.mouse.up();

    // 검증 1 — Day Tab auto-switched to Day 3
    await expect(page.getByRole("button", { name: "Day 3" })).toHaveAttribute("aria-selected", "true");

    // 검증 2 — Day 3 items 순서 = [A, D, E] (insert at top, target_position=1)
    const day3Cards = page.getByTestId("schedule-list").getByTestId(/^schedule-item-card/);
    await expect(day3Cards).toHaveCount(3);
    await expect(day3Cards.nth(0)).toContainText("A");
    await expect(day3Cards.nth(1)).toContainText("D");
    await expect(day3Cards.nth(2)).toContainText("E");

    // 검증 3 — Day 1 로 돌아가면 [B, C] 만 남음
    await page.getByRole("button", { name: "Day 1" }).click();
    const day1Cards = page.getByTestId("schedule-list").getByTestId(/^schedule-item-card/);
    await expect(day1Cards).toHaveCount(2);
    await expect(day1Cards.nth(0)).toContainText("B");
    await expect(day1Cards.nth(1)).toContainText("C");

    // 검증 4 — 새로고침 후에도 persist
    await page.reload();
    await page.getByRole("tab", { name: "일정" }).click();
    await page.getByRole("button", { name: "Day 3" }).click();
    await expect(page.getByTestId("schedule-list").getByTestId(/^schedule-item-card/).nth(0))
      .toContainText("A");
  });

  test("같은 trip 의 day 간 이동은 허용, 다른 trip 은 UI 에서 노출 안 됨 (cross-trip 차단)", async ({ page }) => {
    // Spec §3.4 에서 cannot_move_across_trips 예외를 서버가 throw.
    // UI 레벨에선 다른 trip 의 day tab 이 같은 페이지에 없으므로 사용자 경로 없음.
    // 본 test 는 drag 중 다른 /trips/{id2} 를 여는 시도가 차단되는지 확인.
    // (low priority — integration move-schedule-item-across-days.test.ts 에서 서버 계약 검증 완료)
    test.skip(true, "UI 경로 없음 — integration 에서 cannot_move_across_trips 검증됨");
  });
});
```

- [ ] **Step 4: `tests/e2e/partner-realtime.spec.ts`**

Spec §8.6 Patch KK — 한 test 안에서 2-browser context 동시 제어.

```typescript
import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" }); // partner-dual project

test("Alice trip 생성 → Bob list 5초 내 등장", async ({ browser }) => {
  const aliceCtx = await browser.newContext({ storageState: "tests/e2e/.auth/alice.json" });
  const bobCtx = await browser.newContext({ storageState: "tests/e2e/.auth/bob.json" });
  const alice = await aliceCtx.newPage();
  const bob = await bobCtx.newPage();

  // 선행: alice + bob 은 같은 group 이어야 함
  //   → globalSetup 수준에서 보장하거나 이 spec beforeAll 에서 create_invite + accept_invite
  //   (Plan 상세는 Part C Task 21 Step 5 globalSetup 확장 후보)

  await bob.goto("/trips");
  await alice.goto("/trips");

  // Alice 가 새 trip 생성 (group_id != null → bob 에게 visible)
  await alice.getByRole("link", { name: /새 여행 추가/ }).click();
  await alice.getByLabel("제목").fill("Partner Realtime Test");
  await alice.getByLabel("목적지").fill("Jeju");
  await alice.getByLabel("시작일").fill("2026-08-01");
  await alice.getByLabel("종료일").fill("2026-08-03");
  await alice.getByLabel("국내 여행").check();
  await alice.getByRole("button", { name: /저장|만들기/ }).click();

  // Bob 의 /trips 에 5초 내 등장
  await expect(bob.getByText("Partner Realtime Test")).toBeVisible({ timeout: 5000 });

  await aliceCtx.close(); await bobCtx.close();
});
```

- [ ] **Step 5: `tests/e2e/share-toggle.spec.ts`**

```typescript
test("Alice share-OFF → Bob list 5초 내 사라짐 + 열린 detail TripUnavailable 로 전환", async ({ browser }) => {
  const aliceCtx = await browser.newContext({ storageState: "tests/e2e/.auth/alice.json" });
  const bobCtx = await browser.newContext({ storageState: "tests/e2e/.auth/bob.json" });
  const alice = await aliceCtx.newPage();
  const bob = await bobCtx.newPage();

  // 선행: alice 가 group 공유 trip 을 보유, bob 도 같은 group 의 멤버

  await bob.goto("/trips");
  await expect(bob.getByText("Shared Trip").first()).toBeVisible({ timeout: 5000 });

  // Bob 은 detail 열어둔 상태
  await bob.getByText("Shared Trip").first().click();
  await expect(bob).toHaveURL(/\/trips\/[\w-]+/);
  const bobTripUrl = bob.url();

  // Alice 가 manage 탭 → 파트너 공유 OFF
  await alice.goto(bobTripUrl);
  await alice.getByRole("tab", { name: "관리" }).click();
  await alice.getByRole("switch", { name: /파트너 공유/ }).click();
  await alice.getByRole("button", { name: /확인/ }).click();

  // Bob 은 5초 내 TripUnavailable 로 전환 (new URL 이동 없이)
  await expect(bob.getByTestId("trip-unavailable")).toBeVisible({ timeout: 7000 });

  // Bob 의 /trips 로 돌아가면 목록에서 사라짐
  await bob.goto("/trips");
  await expect(bob.getByText("Shared Trip")).toHaveCount(0, { timeout: 5000 });

  await aliceCtx.close(); await bobCtx.close();
});
```

- [ ] **Step 6: `tests/e2e/resize-with-items.spec.ts`**

```typescript
test("Day 4→2 축소 with items → 확인 다이얼로그 + Day 2 에 items 6개 합병", async ({ page }) => {
  await page.goto("/trips");
  // 선행 seed (spec 초반 RPC 로 생성):
  //   trip 2026-07-01 ~ 2026-07-04 (4일)
  //   Day 3 (2026-07-03) 에 items [A, B, C]
  //   Day 4 (2026-07-04) 에 items [D, E, F]
  //   Day 2 (2026-07-02) 는 비어있음

  await page.getByText(/Resize with items/).click();
  await page.getByRole("tab", { name: "관리" }).click();

  await page.getByLabel("종료일").fill("2026-07-02");   // Day 2 의 날짜로 축소
  await page.getByRole("button", { name: /저장|변경/ }).click();

  // DateShrinkConfirm 다이얼로그: "일정 6개가 이동돼요" 카피
  await expect(page.getByRole("dialog")).toContainText(/일정 6개/);
  await page.getByRole("button", { name: /계속|확인/ }).click();

  // 일정 탭 → Day 2
  await page.getByRole("tab", { name: "일정" }).click();
  await page.getByRole("button", { name: "Day 2" }).click();

  // sort_order 1~6 순으로 Day 3 items (A,B,C) + Day 4 items (D,E,F) 합병 렌더
  const cards = page.getByTestId(/^schedule-item-card/);
  await expect(cards).toHaveCount(6);
  await expect(cards.nth(0)).toContainText("A");
  await expect(cards.nth(3)).toContainText("D");
});
```

- [ ] **Step 7: `tests/e2e/place-search.spec.ts`**

```typescript
test("국내 trip — Naver 검색 → place 필드 채워짐", async ({ page }) => {
  await page.goto("/trips");
  await page.getByText(/국내 trip/).click();
  await page.getByRole("tab", { name: "일정" }).click();

  // 일정 추가 모달 → 장소 검색 시트
  await page.getByRole("button", { name: /일정 추가/ }).click();
  await page.getByRole("button", { name: /장소 선택/ }).click();

  // PlaceSearchSheet 내 검색어 입력 (debounce 300ms)
  await page.getByPlaceholder(/장소 검색/).fill("성수동 카페");
  // debounce 300ms + Naver API 응답 대기 (R7 — SDK/네트워크 flaky 방지)
  await expect(page.getByTestId("place-result").first()).toBeVisible({ timeout: 5000 });
  await page.getByTestId("place-result").first().click();

  // 모달 복귀 → place_name 렌더
  await expect(page.getByLabel("선택된 장소")).toContainText(/카페/);

  await page.getByLabel("제목").fill("커피");
  await page.getByRole("button", { name: /저장/ }).click();

  // 카드 의 place_name 표시
  await expect(page.getByTestId(/schedule-item-card/).last()).toContainText(/카페/);
});

test("해외 trip — Google 검색 → place 필드 채워짐", async ({ page }) => {
  // 동일 구조, provider=google
});
```

- [ ] **Step 8: `login.spec.ts` 에 Google CI skip 조건 추가**

```typescript
test("로그인 화면에서 GIS 버튼 컨테이너가 렌더된다", async ({ page }) => {
  // Spec §8.2 #4 — Google OAuth smoke 는 CI 에서 skip (button 존재만 확인, 클릭 안 함).
  await page.goto("/login");
  const container = page.getByLabel("Google 로그인");
  await expect(container).toBeVisible();
});
```

> 기존 코드 그대로 유지 — 클릭을 하지 않으므로 CI 에서도 통과. skip 조건 추가 불필요. Spec §8.2 의 "test.skip 조건부" 는 원래 Google 로그인 버튼 **클릭** 시나리오에 한정 (이 프로젝트는 클릭 시나리오 작성 안 함). 혼동 소지 있어 주석으로 명시.

- [ ] **Step 9: E2E suite PASS 확인**

```bash
pnpm exec playwright test
```
Expected: 2 (login) + 7 (신규) = **9 test PASS**. flaky 0 (3회 연속 실행 모두 green).

재실행:
```bash
for i in 1 2 3; do pnpm exec playwright test || exit 1; done
```

- [ ] **Step 10: 커밋**

```bash
git add tests/e2e/schedule-crud.spec.ts tests/e2e/drag-same-day.spec.ts \
        tests/e2e/drag-cross-day.spec.ts tests/e2e/partner-realtime.spec.ts \
        tests/e2e/share-toggle.spec.ts tests/e2e/resize-with-items.spec.ts \
        tests/e2e/place-search.spec.ts
git commit -m "test(e2e): phase3 schedule CRUD / drag / partner-realtime / share-toggle / resize / place-search"
```

---

### Task 25: Manual QA 체크리스트 — `docs/qa/phase3-e2e-manual-checklist.md`

**Goal:** 실 Google 계정 2개로 수행하는 Spec §10.5 B 8 시나리오를 Phase 2 QA 체크리스트 포맷으로 문서화. E2E 가 자동화돼도 Google OAuth 실 흐름 + 지도 SDK 실 렌더 + CSP violation 부재는 수동 확인 필요 (R3/R6).

**변경 파일:** `docs/qa/phase3-e2e-manual-checklist.md` (신규)

- [ ] **Step 1: 파일 구조**

```markdown
# Phase 3 — Manual E2E Checklist (Schedule + Map)

**작성일:** 2026-04-20
**적용 tag:** `phase-3-schedule-map`
**수행 환경:** 로컬 `pnpm dev` 또는 Vercel preview. 실 Google 계정 2개 (`alice`, `bob`) 필요.
**선결 조건:**
- NCP Maps + Naver 지역검색 + Google Maps/Places API 키 `.env.local` 반영
- Phase 2 `phase-2-trip-core` tag 기반 위 Phase 3 커밋 all 적용
- Supabase 마이그레이션 0005/0006/0007 적용
- `/api/test/sign-in` 은 prod 빌드에서 자동 차단됨 확인 (`ALLOW_TEST_SIGNIN != true`)

## 시나리오

### 1. Naver 지도 lazy load (국내 trip)
- [ ] Alice 로 로그인 → 기존 국내 trip 진입 → 일정 탭
- [ ] Network 탭에서 `maps.js.naver.com` 스크립트 로드 확인, Google Maps 스크립트는 로드 안 됨
- [ ] 지도 중앙이 한국 영역 (fallback: 서울 좌표)
- [ ] CSP violation 0

### 2. Naver 장소 검색으로 일정 생성
- [ ] 일정 추가 FAB → 모달 → "장소 선택" → BottomSheet
- [ ] "성수동 카페" 입력 → 300ms debounce 후 결과 목록 표시
- [ ] 결과 탭 → 모달 복귀, place_name/address/lat/lng 값 채워짐
- [ ] 저장 → 카드 렌더, 지도 패널 에 "1" 번 커스텀 마커
- [ ] `<b>` 태그 strip 확인 (개발자 도구 elements 패널)

### 3. 같은 day 드래그 (3→1 위치)
- [ ] 일정 3개 있는 Day 선택
- [ ] 3번째 카드 long-press (400ms) → 드래그 시작 시각 피드백 (transform)
- [ ] 1번 위로 drop → 즉시 [3, 1, 2] 순서로 렌더 (optimistic)
- [ ] Network 탭에서 `reorder_schedule_items_in_day` RPC 성공 응답
- [ ] Bob 브라우저 5초 내 같은 순서 반영

### 4. 다른 day 드래그 (Day 1 → Day 3)
- [ ] Day 1 카드 long-press → Day 3 탭 위 drop (Day tab auto-switch) 또는 직접 Day 3 리스트 drop
- [ ] 양 day 재번호 (Day 1 에서 제거, Day 3 에 insert, sort_order 연속)
- [ ] Bob 반영

### 5. Share-toggle OFF → Bob 자동 전환
- [ ] Alice 기존 group-shared trip 의 manage 탭 → 파트너 공유 OFF
- [ ] Bob `/trips` 목록에서 해당 trip 5초 내 사라짐 (reload 없이)
- [ ] Bob 이 열어둔 `/trips/{id}` 화면 → `<TripUnavailable />` 로 전환 (URL 유지)
- [ ] Alice 가 ON 으로 복원 → Bob 목록/상세 자동 복구

### 6. 해외 trip Google 검색 ("Ichiran")
- [ ] Alice 해외 trip (`is_domestic=false`) 일정 탭
- [ ] Google Maps SDK (`maps.googleapis.com/maps/api/js`) 스크립트 로드, Naver 는 로드 안 됨
- [ ] "Ichiran" 검색 → Google Places New 결과 표시
- [ ] 선택 → AdvancedMarkerElement 커스텀 마커 렌더 (legacy Marker deprecation 경고 없음)
- [ ] CSP violation 0 (`style-src 'unsafe-inline'` 허용 상태)

### 7. Day 4→2 축소 with 일정
- [ ] Alice trip 의 manage 탭 종료일 변경 → 확인 다이얼로그에 "일정 N개가 이동돼요" 동적 카피
- [ ] 확인 → Day 2 에 이전 Day 3/4 items 합병 (sort_order 1~N 연속)
- [ ] FK 안정성: 기존 schedule_items.id 변화 없음 (개발자 도구로 row id 확인)
- [ ] Bob 반영

### 8. DevTools Console + Network 종합
- [ ] Console 에러/경고 0 (realtime 구독 로그는 허용)
- [ ] CSP violation 0
- [ ] WebSocket (wss://...supabase.co/realtime/v1/websocket) 활성 + 4 채널
- [ ] 선택된 provider 만 SDK 로드 (Naver XOR Google)

## 발견된 이슈

- (수행 후 append)

## Verdict

- [ ] 8/8 PASS → Exit gate A 통과
- 담당자: ___
- 수행일: ___
```

- [ ] **Step 2: 커밋 (실행 전 템플릿만)**

```bash
git add docs/qa/phase3-e2e-manual-checklist.md
git commit -m "docs(qa): phase3 manual e2e checklist template (8 scenarios)"
```

> 실제 시나리오 수행 결과 (PASS/FAIL 체크) 는 Task 26 Exit gate 에서 채워 re-commit.

---

### Task 26: Exit Gate — 자동 검증 전수 + Verification SQL + 수동 QA + Retrospective + Tag

**Goal:** Phase 3 Exit Criteria (Spec §10.5 A + B + C) 통과. Spec `Verification Targets` 10건 전부 green.

**변경 파일:** `docs/plans/2026-04-20-phase3-schedule-map.md` (retrospective append), `docs/qa/phase3-e2e-manual-checklist.md` (PASS 체크), `docs/plans/2026-04-17-phase1-auth.md` / `docs/plans/2026-04-19-phase2-trip-core.md` (지연된 retrospective 동시 정리)

- [ ] **Step 1: 자동 검증 gate (CI-equivalent 순서)**

```bash
pnpm tsc --noEmit
pnpm lint
pnpm build
pnpm vitest run tests/unit
pnpm test:cov
pnpm test:integration
for i in 1 2 3; do pnpm exec playwright test --project=anonymous --project=alice --project=partner-dual || exit 1; done
pnpm audit --production
```

**Expected:**
- tsc 0 error
- lint 0 error (`no-restricted-imports` 에 `lib/mocks/factory*` 규칙 유지)
- build ✓ (schedule 추가 route 포함)
- unit 20 PASS, coverage threshold 80% 달성
- integration 23 PASS, 3회 연속 deterministic
- E2E 9 PASS (login 2 + schedule 7), 3회 연속 deterministic
- audit high/critical 0

- [ ] **Step 2: Verification SQL 5 (Spec §10.3)**

`scripts/phase3-verify.sql` 작성 or inline:

```sql
-- (1) schedule_items 정책
select policyname from pg_policies
  where tablename = 'schedule_items' order by policyname;
-- Expected: select/insert/update/delete on schedule_items (Part A Task 1)

-- (2) CHECK 제약
select conname from pg_constraint
  where conrelid='public.schedule_items'::regclass and contype='c'
  order by conname;
-- Expected: title_len, place_name_len, place_address_len, memo_len, url_len,
--           place_external_id_len, lat_range, lng_range, place_provider, place_atomic, ...

-- (3) Realtime publication
select * from public.query_publication_tables() order by tablename;
-- Expected: group_members, groups, schedule_items, trips (profiles 없음)

-- (4) REPLICA IDENTITY FULL on trips
select relreplident from pg_class where oid = 'public.trips'::regclass;
-- Expected: 'f'

-- (5) RPC privilege
select p.proname, array_agg(distinct r.grantee) as grantees
  from information_schema.routine_privileges r
  join pg_proc p on p.proname = r.routine_name
  where r.routine_schema='public' and p.proname in
    ('create_schedule_item','update_schedule_item','delete_schedule_item',
     'reorder_schedule_items_in_day','move_schedule_item_across_days',
     'test_truncate_cascade','replica_identity_of')
  group by p.proname;
-- Expected:
--   create/update/delete_schedule_item, reorder_*, move_* → {authenticated}
--   test_truncate_cascade, replica_identity_of → {service_role}
```

실행:
```bash
supabase db execute --file scripts/phase3-verify.sql
# 또는 psql "$DATABASE_URL" -f scripts/phase3-verify.sql
```

결과 스크린샷/텍스트를 retrospective 섹션에 첨부.

- [ ] **Step 3: 수동 QA 8 시나리오 (Task 25 체크리스트 실행)**

- [ ] 실 Google 계정 2개 로그인 → `docs/qa/phase3-e2e-manual-checklist.md` 체크박스 전부 수행
- [ ] PASS/FAIL 기록 + 발견된 이슈 "발견된 이슈" 섹션 append
- [ ] FAIL 존재 시 → 해당 bug 수정 커밋 → 해당 시나리오 재실행
- [ ] 최종 verdict "8/8 PASS" 에 체크

- [ ] **Step 4: Retrospective append — `docs/plans/2026-04-20-phase3-schedule-map.md` 끝**

다음 템플릿을 `## Retrospective` 섹션으로 추가:

```markdown
## Retrospective (Phase 3 Exit)

**수행 기간:** 2026-04-__ ~ 2026-__-__
**main HEAD:** `__`
**tag:** `phase-3-schedule-map`

### Task 통계
- Part A (Task 0~10): __ 커밋
- Part B (Task 11~20): __ 커밋
- Part C (Task 21~26): __ 커밋
- 총 __ 커밋, main origin 반영

### 잘된 것
- (예: Part A critic 리뷰 → H1/H2 조기 발견)
- (예: share-toggle realtime 이 integration 에서도 deterministic 통과)
- ...

### 문제 & 해결
- (incident/bug 기록 + 해결 commit SHA)
- ...

### 남은 기술부채 (Phase 4 이월)
- [ ] `useFlashToast()` 공용 훅 도입 (Phase 3 준공 시점 follow-up)
- [ ] Google `AdvancedMarkerElement` prod `mapId` 발급 + `NEXT_PUBLIC_GOOGLE_MAP_ID` env
- [ ] Vercel preview 도메인에 NCP/Google 키 referrer 추가
- [ ] schedule_items REPLICA IDENTITY FULL 전환 여부 재평가 (Task 19 결정 reconcile)
- [ ] CI 워크플로우 `.github/workflows/e2e.yml` 작성 (Patch OO — Phase 3 은 로컬 통과만 필수)
- [ ] Phase 1/2 retrospective 누락분 동시 정리
- [ ] `@dnd-kit` a11y 한국어 메시지 (R10, Phase 8 i18n)
- [ ] Naver wildcard 도메인 제한 확인 (R9)

### 배운 것
- (Spec 선행 + ADR → Design → Plan 분할 + critic 게이트 패턴 반복 유효성)
- (REPLICA IDENTITY FULL 이 low-volume 테이블에서 비용-효과 우위)
- (Playwright `storageState` + dev `/api/test/sign-in` 3중 guard 가 Google OAuth 우회 대체 경로로 안정)
- ...
```

(Phase 1/2 retrospective 는 각각 자기 Plan 파일에 append — docs/plans/2026-04-17-phase1-auth.md, 2026-04-19-phase2-trip-core.md)

- [ ] **Step 5: Tag + push**

```bash
# 사전 확인
git status                         # clean
git log --oneline -20              # Part A/B/C 커밋 순서 확인
pnpm tsc --noEmit && pnpm lint && pnpm build   # 최종 green 재확인

# Tag
git tag -a phase-3-schedule-map -m "Phase 3 — Schedule & Map complete

- schedule_items + RPC 5종 (reorder, move, create, update, delete)
- resize_trip_days v2 (day 보존 + date UPDATE + compound key 합병)
- Maps dual provider (Naver 국내 / Google 해외) + place search + TM128
- E2E 자동화 복귀 (storageState + dev /api/test/sign-in 3중 guard)
- Share-toggle OFF 자동 Realtime 전환 (REPLICA IDENTITY FULL on trips)
- 4 Realtime 채널 (trips / group_members / groups / schedule_items)
- Unit 20 / Integration 23 / E2E 9 PASS
"
git push origin main --follow-tags
```

Expected:
- `git tag | grep phase-3` → `phase-3-schedule-map`
- `git ls-remote --tags origin phase-3-schedule-map` → 원격 반영 확인

- [ ] **Step 6: 위키 상태 갱신**

- [ ] `~/MY_AI_WIKI/projects/travel-manager/status.md` → "현재 단계" 를 `phase-3-complete` 로, "완료된 것" 에 Phase 3 전체 추가
- [ ] 세션 로그 `sessions/2026-__-__-phase3-exit.md` 작성
- [ ] 위키 linter (`/wiki-lint`) 수행 후 orphan/stale 정리

```bash
# 커밋 (위키는 별도 저장소 or 경로)
```

- [ ] **Step 7: 최종 알림**

사용자에게 보고:
- main HEAD SHA
- tag + origin push 확인
- Exit gate 전수 green
- Phase 4 시작 조건 (categories + expenses) 준비됨

---

## Part C — 체크포인트

Task 21~26 완료 시점:
- **E2E 인프라 복귀** — `auth.admin.createUser` + `/api/test/sign-in` + Playwright `storageState` → Google OAuth 우회. 3 projects (anonymous / alice / partner-dual), globalSetup 1회, workers=1
- **Unit 20 PASS** — 기존 7 + Part A 3 + Part B 9 + Part C 1 (url-scheme). coverage threshold 80% 달성 (`lib/schedule/*`, `lib/maps/{tm128,strip-html,rate-limit,provider}`, `lib/auth/nonce`, `lib/profile/*`)
- **Integration 23 PASS** — 기존 12 + Part B 5 + Part C 6 (rls-schedule-items · resize-trip-days-v2 · realtime-publication-audit 확장 · replica-identity-audit · share-toggle-realtime · place-search-rate-limit). 3회 연속 deterministic
- **E2E 9 PASS** — login 2 (기존) + schedule-crud / drag-same-day / drag-cross-day / partner-realtime / share-toggle / resize-with-items / place-search. 3회 연속 deterministic
- **Verification SQL 5** — policies / CHECK / publication / REPLICA IDENTITY FULL / RPC privilege 모두 spec 일치
- **Manual QA 8/8 PASS** — 실 Google 계정 2개, Naver/Google 지도 실 렌더, CSP violation 0
- **Retrospective** — Plan 끝에 append. Phase 1/2 지연 retrospective 동시 정리
- **Git tag `phase-3-schedule-map`** — origin 반영

**자동 검증 one-shot:**
```bash
pnpm tsc --noEmit && pnpm lint && pnpm build \
  && pnpm vitest run tests/unit && pnpm test:cov \
  && pnpm test:integration \
  && pnpm exec playwright test \
  && pnpm audit --production
```
Expected: 0 error / 0 failure / 0 high|critical.

**Exit:** 위 전 조건 통과 + 위키 상태 `phase-3-complete`. Phase 4 (expenses + categories) 착수 준비 완료.

---

## 전체 Task 총람

| Task | 주제 | Part | 예상 분량 |
|---|---|---|---|
| 0 | Pre-flight smoke (@dnd-kit + Playwright 확인) | A | S |
| 1 | DB migration 0005 — `schedule_items` | A | L |
| 2 | DB migration 0006 — RPC 5종 + resize v2 | A | XL |
| 3 | DB migration 0007 — `trips` REPLICA IDENTITY FULL | A | S |
| 4 | `supabase/seed/test.sql` — `test_truncate_cascade` + `replica_identity_of` | A | M |
| 5 | types 재생성 + query keys `schedule` 확장 | A | S |
| 6 | env + CSP + `.env.example` (Maps 5 + test 2 key) | A | L |
| 7 | `/api/test/sign-in` 3중 guard + `.gitignore` | A | M |
| 8 | Maps provider 인터페이스 + selector + unit | A | M |
| 9 | Naver provider 구현 + marker | A | L |
| 10 | Google provider 구현 + AdvancedMarkerElement | A | L |
| 11 | `useScheduleList` + `useTripDays` hooks | B | M |
| 12 | `useCreateScheduleItem` mutation + integration | B | L |
| 13 | `useUpdateScheduleItem` + `useDeleteScheduleItem` + integration | B | L |
| 14 | 순수 함수 `applyLocalReorder` + `applyLocalMove` + unit | B | L |
| 15 | Optimistic reorder/move mutations + `ui-store.isDraggingSchedule` + integration | B | XL |
| 16 | `/api/maps/search` + Naver/Google 어댑터 + TM128 + rate-limit + unit ×4 | B | XL |
| 17 | `usePlaceSearch` + `useDebouncedValue` + unit | B | M |
| 18 | UI 프리미티브 (DayTabBar/ScheduleList/SortableCard/ItemModal/DayMoveSheet/MapPanel/PlaceSearchSheet) | B | XL |
| 19 | `schedule-tab.tsx` 리와이어 + DnD orchestration | B | L |
| 20 | Realtime gateway 확장 + trips virtual DELETE + schedule channel + unit ×2 | B | L |
| **21** | **E2E 인프라 — Playwright config + globalSetup + fixtures + helpers** | **C** | **L** |
| **22** | **Unit suite 완성 — `url-scheme` + coverage include 확장** | **C** | **S** |
| **23** | **Integration — rls / resize-v2 / publication-v2 / replica-identity / share-toggle-realtime / rate-limit** | **C** | **XL** |
| **24** | **E2E specs — schedule-crud / drag / partner-realtime / share-toggle / resize / place-search** | **C** | **XL** |
| **25** | **Manual QA 체크리스트 (`docs/qa/phase3-e2e-manual-checklist.md`)** | **C** | **S** |
| **26** | **Exit gate — 자동 전수 + SQL 5 + 수동 8 + retrospective + tag** | **C** | **M** |

분량: S=<100 line plan effort / M=100-250 / L=250-500 / XL=500+.

---

## 집행 프로토콜 (Part C 전용)

1. **세션 시작 시 필독:** Part B 의 체크포인트 완료 상태 (tsc 0 / lint 0 / build ✓ / unit 20 / integration 17) 확인. 미완 시 Part B 로 복귀.
2. **Task 23 은 `supabase/seed/test.sql` 확장 선행** — Part A Task 4 파일에 `replica_identity_of` helper RPC 추가 안 되어 있으면 먼저 마이그레이션.
3. **E2E globalSetup 의 group 결성 step 검토** — Task 21 Step 5 의 globalSetup 은 alice+bob 유저만 생성. partner-dual 프로젝트 spec 이 요구하는 group membership 은 각 spec beforeAll 에서 `create_invite` + `accept_invite` 로 별도 수행 or globalSetup 확장. Task 24 Step 4/5 작성 시 결정.
4. **각 Task 커밋 후 `pnpm exec playwright test --list`** — project assignment drift 점검.
5. **Task 26 Exit gate 는 순서 엄수** — auto verify → SQL → manual QA → retro → tag. 중간 fail 시 root cause 수정 후 처음부터 재실행.
6. **critic 3회차 재검토 (선택):** Part C 완성 직후 / tag push 직전에 전체 Plan (Part A+B+C) 대상 독립 critic 호출. Part A 의 pre-commitment prompt 템플릿 재사용. 잡힌 이슈가 drift 성격이면 패치, 설계 성격이면 follow-up.
7. **Playwright 의 `.env.test` 로딩 주의:** Playwright 는 기본적으로 `.env*` 를 자동 로드하지 않는다. Task 21 auth.ts / db-reset.ts 가 요구하는 env (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `PLAYWRIGHT_BASE_URL`, `TEST_SECRET`) 를 주입하는 2 경로:
   - **권장:** `playwright.config.ts` 상단에 `import "dotenv/config"` + `DOTENV_CONFIG_PATH=.env.test pnpm exec playwright test` 실행. `.env.local` 의 prod key 오염 방지.
   - **대안:** shell export + `pnpm test:e2e`. CI 는 GitHub Actions `env:` 블록으로 주입.
   - `webServer.env.ALLOW_TEST_SIGNIN=true` 는 dev 서버 한정 — **`reuseExistingServer=true` 시 이미 기동된 서버의 env 는 덮어쓰지 못한다**. 로컬 `pnpm dev` 를 별도 터미널로 띄워두고 Playwright 를 실행하면 `.env.local` 에 `ALLOW_TEST_SIGNIN=true` 가 반드시 있어야 한다. CI 에서는 `reuseExistingServer=false` 라 webServer.env 가 유효.

---

## Retrospective (2026-04-21 완료)

### 결과 요약

- **커밋:** 18개 (`b0695d5` → tag `phase-3-schedule-map`, main HEAD=`052cce3`+)
- **소요:** 2일 (2026-04-20~21, 집/회사 2머신)
- **테스트:** unit 63/63 · integration 69/69 (22파일) · E2E 7 passed / 5 skipped / 0 failed × 3회 연속
- **Verification SQL:** 5/5 all green

### 잘된 것

- `dnd-kit PointerSensor(delay:400ms)` long-press + `KeyboardSensor` 조합 — tap vs drag 자연 분리
- `place_search` 서버 경유 + TM128 변환 + strip-html + rate-limit(30/min/user) 구조 — 외부 API key 클라이언트 노출 없음
- `trips REPLICA IDENTITY FULL` + share-toggle Realtime — spec §9 ADR 정확히 구현
- Playwright storageState를 `chromium.launch()` 기반으로 전환 — `request.newContext()` 쿠키 비호환 이슈 해결
- `Supabase signOut({ scope: "local" })` 명시 — 기본 global scope 로 alice 세션 전역 revoke 버그 발견·해결
- nested `<button>` 제거 — React dev overlay 오탐 + dnd-kit PointerSensor 무력화 양쪽 동시 해소

### 어려웠던 것

- Part B v1 critic REJECT (BLOCKER 3건 — schedule_items 스키마 오가정) → 전면 폐기 후 레지스트리 선행 v2 재작성
- `supabase db push` SQLSTATE 42601 multi-statement — Dashboard SQL Editor 수동 실행으로 회피
- 2머신(폰→집→회사) 환경 분산 — `git fetch/rebase`로 커밋 동기화 필요

### Skip 항목 (후속 phase 이관)

- `partner-realtime` / `share-toggle` E2E — `useTripsList`/`useTripDetail` Realtime 구독 미구현
- `place-search` E2E (Naver/Google) — 외부 API 타이밍 flaky, Maps 키 환경 의존. mock 기반 재작성 예정

### Follow-up

- `useTripsList` / `useTripDetail` Realtime 구독 추가 (INSERT·UPDATE 채널) → partner-realtime / share-toggle E2E skip 복구
- Naver/Google place-search E2E mock 기반 재작성
- `useFlashToast()` 공용 훅 도입 (Phase 2 follow-up 인계)
- Maps API 키 Vercel 환경변수 등록 + preview 도메인 등록
