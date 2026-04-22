---
type: implementation-plan
phase: phase-3-gap-recovery
project: travel-manager
date: 2026-04-22
depends-on:
  - docs/specs/2026-04-16-travel-manager-design.md (원본 스펙 §4, §5, §6.4, §6.10)
  - docs/specs/2026-04-20-phase3-schedule-map-design.md
  - supabase/migrations/0005_schedule_items.sql (현행 schema)
  - supabase/migrations/0006_schedule_rpc.sql (현행 RPC signature)
author: claude-opus-4-7 (plan) + sh (user UX model)
status: draft
---

# Phase 3 갭 복구 Plan — schedule_items 카테고리 + 장소↔제목 UX

> **맥락 한 줄**: Phase 3 tag 선언 후 초기 스펙 역추적에서 9건 누락 확인 → 이 plan 은 그 중 DB·UI 에 해당하는 **4건**(카테고리 필드·카테고리 관리 읽기·장소 기반 제목 자동화·마커 클릭 스크롤) 을 복구. 경비/Todo/기록 mock→DB, 게스트 공유 SSR 은 Phase 4 로 명시 분리.

---

## § 0 스키마 · RPC 레지스트리 (drift 방지용 verbatim 인용)

**이 섹션은 plan 집행 중 RPC 호출/마이그레이션 작성 직전에 반드시 grep 검증. Part B v1 폐기(2026-04-20 야간) 의 재발 방지 규율.**
[[memory/feedback_plan_writing.md]] · [[knowledge/patterns/plan-writing-requires-schema-registry-first]]

### §0.1 `schedule_items` 현재 컬럼 (verbatim from 0005_schedule_items.sql:6-22)

```sql
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
```

### §0.2 `schedule_items` CHECK 제약 핵심 (verbatim from 0005_schedule_items.sql:25-51)

- `schedule_items_title_length` → `char_length(title) between 1 and 100`
- `schedule_items_place_atomic` →
  `(place_name is null AND ... 전체 null) OR (place_name, lat, lng, provider 전부 NOT NULL)`
- `schedule_items_place_provider_check` → `place_provider IN ('naver','google')` 또는 NULL
- `schedule_items_lat_range` → -90 ~ 90
- `schedule_items_lng_range` → -180 ~ 180
- 각 필드 길이 제약: place_name ≤100, place_address ≤200, memo ≤1000, url ≤2048, place_external_id ≤200

### §0.3 RPC signature — `create_schedule_item` (verbatim from 0006_schedule_rpc.sql:6-17)

```sql
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
```

- **현행 파라미터 카운트: 11** (p_trip_day_id 포함)
- GRANT 서명 (0006:66-73):
  ```sql
  revoke all on function public.create_schedule_item(
    uuid, text, time without time zone, text, text,
    double precision, double precision, text, text, text, text
  ) from public;
  grant execute on function public.create_schedule_item(
    uuid, text, time without time zone, text, text,
    double precision, double precision, text, text, text, text
  ) to authenticated;
  ```
- Task 2 에서 **12 파라미터로 재정의** 시 `drop function` → `create or replace` 순서 + GRANT 재발급 필요.

### §0.4 RPC signature — `update_schedule_item` (verbatim from 0006_schedule_rpc.sql:76-87)

```sql
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
```

- **현행 파라미터 카운트: 11** (p_item_id 포함)
- GRANT signature (0006:133-140) — create_schedule_item 과 동일 타입열.

### §0.5 RPC signature — 영향 없음 함수 (명시적 exclusion)

다음 함수들은 `category` 와 **무관**하며 이번 plan 에서 수정하지 않음:
- `delete_schedule_item(uuid)` — 0006:143
- `reorder_schedule_items_in_day(uuid, uuid[])` — 0006:181
- `move_schedule_item_across_days(uuid, uuid, int)` — 0006:234
- `resize_trip_days(uuid, date, date)` — 0006:317

### §0.6 UI 매핑 레지스트리

- `components/ui/schedule-item.tsx:5-11` — `ScheduleCategory` union: `"transport" | "sightseeing" | "food" | "lodging" | "shopping" | "other"`
- `components/ui/schedule-item.tsx:13-20` — 색상 매핑 (Tailwind 클래스):
  - transport → `bg-ti-read`
  - sightseeing → `bg-ti-grep`
  - food → `bg-ti-thinking`
  - lodging → `bg-ti-edit`
  - shopping → `bg-accent-gold`
  - other → `bg-ink-400`
- `components/ui/schedule-item.tsx:22-29` — 한글 라벨 매핑 (교통/관광/식당/숙소/쇼핑/기타)
- `components/schedule/sortable-schedule-item.tsx:40` — **`category="other"` 하드코딩** (제거 대상)

### §0.7 훅 · 타입 레지스트리

- `lib/schedule/use-schedule-list.ts:8` — `ScheduleItem = Database["public"]["Tables"]["schedule_items"]["Row"]` (auto-generated, 0008 마이그레이션 후 regen 필요)
- `lib/schedule/use-create-schedule-item.ts` — `create_schedule_item` RPC 호출 (Task 4 에서 category_code 인자 추가)
- `lib/schedule/use-update-schedule-item.ts` — `update_schedule_item` RPC 호출 (Task 4 에서 category_code 인자 추가)

### §0.8 Trip 다국어(Place Provider) 분기 — `is_domestic` 의존성

0006:39-47 — `place_provider ↔ is_domestic` 정합성 체크:
```
if v_is_domestic and p_place_provider != 'naver' → raise 'place_provider_mismatch'
if not v_is_domestic and p_place_provider != 'google' → raise 'place_provider_mismatch'
```

→ Task 6 UI 에서 provider 를 직접 전달하지 않고 `providerForTrip(trip)` 으로 resolve (기존 패턴 준수).

### §0.9 Realtime publication / REPLICA IDENTITY — category_code 전파 확인

- `schedule_items` 는 **0005:93** 에서 `supabase_realtime` publication 에 이미 등록됨. category_code 컬럼 추가 시 **publication alter 불필요** (Postgres 는 테이블 단위로 publication 에 모든 컬럼 포함).
- `schedule_items` 의 REPLICA IDENTITY 는 **DEFAULT** (FULL 은 `trips` 만, 0007 에서 설정). 즉:
  - INSERT payload.new → 전체 컬럼 포함 (`category_code` 포함 ✅)
  - UPDATE payload.new → 전체 컬럼 포함 (`category_code` 포함 ✅)
  - UPDATE payload.old → **PK 만** (category_code 변경 before/after 비교 불가)
  - DELETE payload.old → PK 만
- 현행 `handleScheduleChange` ([`lib/realtime/schedule-channel.ts`](../../lib/realtime/schedule-channel.ts)) 는 UPDATE 시 **predicate invalidate** 만 함 → 카테고리 변경도 자동으로 `queryKeys.schedule.byTripId(tripId)` invalidate 됨 → refetch 로 최신 category_code 반영
- **따라서 0008/0009 로 인한 Realtime 채널 수정 불필요.** Task 9 integration 테스트에서 "카테고리 변경 UPDATE 가 schedule-items 채널로 전파" 만 확인하면 됨.

---

## § 1 스펙: UX 모델 (사용자 2026-04-22 확정)

### §1.1 카테고리 분기 폼

**Step 1**: 모달 오픈 → 카테고리 선택(필수, 기본 `other`)

**Step 2 (카테고리 ≠ `other`)**:
- 폼 1차 화면 = 장소 검색
- `PlaceSearchSheet` 결과 선택 → `title = place.name`, place 필드 자동 set
- 결과 없음 → **"직접 입력"** 버튼 → 제목 + 주소 수동 입력 폼으로 전환
- 시간 / 메모 / URL 은 공통으로 선택 입력

**Step 2 (카테고리 = `other`)**:
- 폼 1차 화면 = 제목 입력란
- 장소는 선택 (장소 검색 버튼만 제공)
- 시간 / 메모 / URL 은 공통으로 선택 입력

### §1.2 마이그레이션 시 기존 데이터

- 기존 `schedule_items` 전부 `category_code = 'other'` (default). UI 상 "기타"로 표시. 사용자가 수정 시 다른 카테고리 선택 가능.

### §1.3 제약 조건

- DB 레벨: `category_code` NOT NULL, default `'other'`, FK → `categories(code)` (ON UPDATE CASCADE, ON DELETE RESTRICT)
- **place 필수 여부는 DB 제약으로 강제하지 않음** (기존 `place_atomic` 유지). UI 에서만 "카테고리 ≠ other 이면 place 필수" 강제 — 초기 데이터 마이그레이션 호환성 + 편집 유연성.

### §1.4 마커 클릭 → 일정 스크롤 (초기 스펙 §6.4)

- `MapPanel` 이 `onMarkerClick?: (scheduleItemId: string) => void` prop 수신
- 클릭 시 schedule-tab 이 해당 item 의 DOM 요소로 `scrollIntoView({ behavior: "smooth", block: "center" })`
- Phase 3 spec §6.4 명시 요구사항. 현재 `schedule-tab.tsx:263` 에서 prop 전달 누락.

### §1.5 명시적 Phase 4 이관 (이 plan 범위 밖)

- 경비 탭 실 DB 연결 (§6.5)
- Todo 탭 실 DB (§6.6)
- 기록 탭 실 DB (§6.7)
- 게스트 공유 `/share/[token]` SSR + `get_guest_trip_data` RPC (§6.8)
- 관리 탭 게스트 링크 생성 UI (§6.8)
- 경비↔일정 연동 (⋮ "경비 추가" + `expenses.schedule_item_id`) (§6.4, §4)
- 카테고리 관리 페이지 (§5) — 현 plan 은 6종 seed 의 **읽기 전용** 시스템 테이블만. 사용자 관리 UI 는 Phase 4.

---

## § 2 Task 총람

| # | Task | 파일 | 테스트 | 위험 |
|---|------|------|--------|------|
| 1 | `0008_categories.sql` — categories 테이블 + schedule_items.category_code FK | supabase/migrations/0008_categories.sql | integration (CHECK + FK) | 기존 row migration 시 default 적용 |
| 2 | `0009_schedule_rpc_category.sql` — RPC signature 12 파라미터 | supabase/migrations/0009_schedule_rpc_category.sql | integration (RPC 호출) | **drop+create 순서, GRANT 재발급, bind 에러 위험** |
| 3 | DB 타입 regen + PostgrestVersion "12" 복원 | types/database.ts, scripts/ | tsc | 기존 workaround 덮어씀 — 후처리 스크립트 |
| 4 | `use-create/update-schedule-item` 훅 signature 확장 | lib/schedule/*.ts | unit | RPC 파라미터 순서 drift |
| 5 | `sortable-schedule-item` 하드코딩 제거 + 실 category_code 렌더 | components/schedule/sortable-schedule-item.tsx | unit (snapshot) | 기존 E2E selector 영향 |
| 6 | `schedule-item-modal` 재구성 (카테고리 분기 폼) | components/schedule/schedule-item-modal.tsx | unit + E2E | 복잡 폼 상태 관리 |
| 7 | 장소 선택 시 title auto-fill + 직접 입력 분기 | components/schedule/* | unit | dirty flag 없이 카테고리로만 분기 (사용자 확정) |
| 8 | 마커 클릭 → 일정 스크롤 배선 | components/schedule/map-panel.tsx + schedule-tab.tsx | E2E (선택) | ref 관리 |
| 9 | Unit/integration 추가 + manual QA 체크리스트 | tests/*, docs/qa/ | — | — |

**예상 커밋 수: 9~11 개.** Task 2 는 migration+code 2 커밋 분리 권장.

---

## § 3 Task 1 — `0008_categories.sql`

### §3.1 목표

- `public.categories` 시스템 테이블 생성 (code PK, 6종 seed)
- `schedule_items.category_code` 컬럼 추가 (default `'other'`, NOT NULL, FK)
- RLS: categories 는 authenticated 전원 SELECT 허용, 쓰기 차단
- Realtime publication 은 categories 에 대해선 불필요 (seed 고정)

### §3.2 마이그레이션 파일 (초안 SQL)

```sql
-- supabase/migrations/0008_categories.sql
-- Phase 3 갭 복구: schedule_items 카테고리 분류
-- 의존: 0005_schedule_items.sql

-- ── categories 테이블 ────────────────────────────────────────────────
create table public.categories (
  code        text        primary key,
  name        text        not null,
  color_token text        not null,  -- Tailwind class name (참고용; UI 는 schedule-item.tsx categoryColor 매핑으로 최종 결정)
  sort_order  int         not null,
  created_at  timestamptz not null default now()
);

alter table public.categories
  add constraint categories_code_length check (char_length(code) between 1 and 32),
  add constraint categories_name_length check (char_length(name) between 1 and 32),
  add constraint categories_code_chars  check (code ~ '^[a-z_]+$');

-- ── seed: 6 종 (schedule-item.tsx ScheduleCategory union 과 1:1 매핑) ──
insert into public.categories (code, name, color_token, sort_order) values
  ('transport',   '교통', 'bg-ti-read',      1),
  ('sightseeing', '관광', 'bg-ti-grep',      2),
  ('food',        '식당', 'bg-ti-thinking',  3),
  ('lodging',     '숙소', 'bg-ti-edit',      4),
  ('shopping',    '쇼핑', 'bg-accent-gold',  5),
  ('other',       '기타', 'bg-ink-400',      6);

-- ── RLS: 읽기 전용 시스템 테이블 ──
alter table public.categories enable row level security;
create policy "categories_select_all"
  on public.categories for select to authenticated
  using (true);
-- INSERT/UPDATE/DELETE 정책 없음 → RLS 에 의해 자동 차단.

-- ── schedule_items.category_code 컬럼 추가 ──
alter table public.schedule_items
  add column category_code text not null default 'other'
    references public.categories(code) on update cascade on delete restrict;

-- 기존 row 는 default 값 'other' 로 자동 채워짐.

create index idx_schedule_items_category on public.schedule_items(category_code);

-- ── ROLLBACK ─────────────────────────────────────────────────────────
-- drop index if exists idx_schedule_items_category;
-- alter table public.schedule_items drop column category_code;
-- drop policy if exists "categories_select_all" on public.categories;
-- drop table if exists public.categories;
```

### §3.3 적용 절차

1. 파일 작성 + `pnpm lint:sql` (있으면)
2. **로컬 적용**: `supabase db push` — 과거 multi-statement 이슈([[issues/supabase-cli-prepared-statement-multi-command]]) 가능성 있으니, 실패 시 Supabase Dashboard SQL Editor 에서 수동 실행 → `supabase migration repair --status applied 0008` 로 동기화
3. **검증**:
   ```sql
   select count(*) from public.categories;                           -- 6
   select count(*) from public.schedule_items where category_code = 'other';  -- 기존 전체 수와 일치
   select conname from pg_constraint where conrelid = 'public.schedule_items'::regclass
     and conname like '%category%';                                  -- FK 제약 존재 확인
   ```

### §3.4 체크리스트

- [ ] 0008 파일 작성 완료
- [ ] seed 6종 모두 색상 token 이 `schedule-item.tsx:13-20` 와 일치
- [ ] `supabase db push` 또는 Dashboard 실행 성공
- [ ] 검증 SQL 3 쿼리 통과
- [ ] 기존 schedule_items row 전부 `category_code = 'other'` 확인
- [ ] commit: `feat(db): add categories table + schedule_items.category_code (0008)`

---

## § 4 Task 2 — `0009_schedule_rpc_category.sql`

### §4.1 목표 — ⚠️ HIGH RISK

RPC 파라미터 **drift 가 가장 잘 발생하는 지점**. Part B v1 폐기 원인. 집행 전 §0.3/§0.4 의 **현행 signature 를 다시 한 번 grep 으로 검증**한 뒤에만 작성.

### §4.2 접근 방식

- `create_schedule_item` / `update_schedule_item` 에 **`p_category_code text default 'other'`** 파라미터 추가
- **위치 결정**: 기존 11 파라미터 **끝에 append** (중간 삽입 금지) — named-arg 호출이 아닌 positional 호출이 있을 경우 파괴적 변경 방지. ⚠️ supabase-js `supabase.rpc()` 는 named 호출이지만 `default` 값 있으면 omit 가능
- **GRANT 재발급 필수**: signature 바뀌면 구 함수 drop → 새 함수 create → REVOKE/GRANT 재발급 순서.

### §4.3 마이그레이션 파일 (초안 SQL)

```sql
-- supabase/migrations/0009_schedule_rpc_category.sql
-- Phase 3 갭 복구: create_schedule_item / update_schedule_item 에 category_code 파라미터 추가
-- 의존: 0006_schedule_rpc.sql, 0008_categories.sql

-- ── 기존 함수 drop (signature 변경 필수) ──
drop function if exists public.create_schedule_item(
  uuid, text, time without time zone, text, text,
  double precision, double precision, text, text, text, text
);
drop function if exists public.update_schedule_item(
  uuid, text, time without time zone, text, text,
  double precision, double precision, text, text, text, text
);

-- ── create_schedule_item (12 파라미터) ──
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
  p_url               text default null,
  p_category_code     text default 'other'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_trip_id     uuid;
  v_is_domestic boolean;
  v_next_order  int;
  v_new_id      uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;

  select td.trip_id, t.is_domestic into v_trip_id, v_is_domestic
    from public.trip_days td
    join public.trips t on t.id = td.trip_id
    where td.id = p_trip_day_id;
  if v_trip_id is null then raise exception 'trip_day_not_found'; end if;
  if not public.can_access_trip(v_trip_id) then raise exception 'forbidden'; end if;

  -- category 존재성은 FK 로 자동 검증 (invalid 값이면 insert 시 foreign_key_violation).
  -- provider ↔ is_domestic 정합성 (0006 과 동일)
  if p_place_provider is not null then
    if v_is_domestic and p_place_provider != 'naver' then
      raise exception 'place_provider_mismatch';
    end if;
    if not v_is_domestic and p_place_provider != 'google' then
      raise exception 'place_provider_mismatch';
    end if;
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_next_order
    from public.schedule_items where trip_day_id = p_trip_day_id;

  insert into public.schedule_items(
    trip_day_id, title, sort_order, time_of_day,
    place_name, place_address, place_lat, place_lng,
    place_provider, place_external_id, memo, url,
    category_code
  ) values (
    p_trip_day_id, p_title, v_next_order, p_time_of_day,
    p_place_name, p_place_address, p_place_lat, p_place_lng,
    p_place_provider, p_place_external_id, p_memo, p_url,
    p_category_code
  ) returning id into v_new_id;

  return v_new_id;
end $$;

revoke all on function public.create_schedule_item(
  uuid, text, time without time zone, text, text,
  double precision, double precision, text, text, text, text, text
) from public;
grant execute on function public.create_schedule_item(
  uuid, text, time without time zone, text, text,
  double precision, double precision, text, text, text, text, text
) to authenticated;

-- ── update_schedule_item (12 파라미터) ──
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
  p_url               text default null,
  p_category_code     text default 'other'
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
        url = p_url,
        category_code = p_category_code
    where id = p_item_id;
end $$;

revoke all on function public.update_schedule_item(
  uuid, text, time without time zone, text, text,
  double precision, double precision, text, text, text, text, text
) from public;
grant execute on function public.update_schedule_item(
  uuid, text, time without time zone, text, text,
  double precision, double precision, text, text, text, text, text
) to authenticated;

-- ── ROLLBACK ──
-- drop function if exists public.create_schedule_item(uuid, text, time without time zone, text, text, double precision, double precision, text, text, text, text, text);
-- drop function if exists public.update_schedule_item(uuid, text, time without time zone, text, text, double precision, double precision, text, text, text, text, text);
-- 그 다음 0006_schedule_rpc.sql 의 11-파라미터 버전을 재적용.
```

### §4.4 적용 절차

1. 0008 이 먼저 적용됐는지 확인 (`select count(*) from public.categories` = 6)
2. **0009 파일 작성 시 §0.3/§0.4 verbatim 과 11 → 12 파라미터 diff** 만 변경했는지 diff 검증
3. `supabase db push` 시도, 실패하면 Dashboard 실행 + `migration repair`
4. **검증**:
   ```sql
   -- signature 확인 (12 파라미터)
   select pg_get_function_arguments(oid) from pg_proc
     where proname = 'create_schedule_item';
   -- GRANT 확인
   select has_function_privilege('authenticated',
     'public.create_schedule_item(uuid, text, time without time zone, text, text, double precision, double precision, text, text, text, text, text)',
     'execute');
   ```

### §4.5 체크리스트

- [ ] §0.3/§0.4 signature 를 grep 으로 재검증
- [ ] 0009 파일 작성, 11 → 12 파라미터만 diff
- [ ] `drop function` 순서가 `create or replace` 보다 **먼저**
- [ ] REVOKE/GRANT signature 가 12 파라미터 (끝에 `text` 추가)
- [ ] `category_code` 파라미터 **끝에 append** (중간 삽입 금지)
- [ ] 적용 후 검증 SQL 2종 통과
- [ ] commit: `feat(db): extend schedule RPCs with category_code (0009)`

---

## § 5 Task 3 — DB 타입 regen + PostgrestVersion 복원

### §5.1 목표

- `pnpm db:types` 실행 → `types/database.ts` 재생성
- 기존 `PostgrestVersion: "12"` workaround ([[issues/postgrest-version-regen-overwrite]]) 덮어씌워지므로 **후처리 스크립트** 로 복원 필요 → 이미 `scripts/fix-postgrest-version.mjs` 존재 ([docs/plans/2026-04-20-phase3-schedule-map.md](../plans/2026-04-20-phase3-schedule-map.md) Task 5 에서 도입)

### §5.2 절차

1. `pnpm db:types` 실행 (또는 `supabase gen types typescript --linked --schema public > types/database.ts`)
2. `node scripts/fix-postgrest-version.mjs` 실행 (정규식 `[0-9.]+` 보정 버전)
3. `git diff types/database.ts` 로 `categories` 테이블 + `schedule_items.category_code` + RPC 12 파라미터 반영 확인
4. `pnpm tsc --noEmit` 0 error

### §5.3 체크리스트

- [ ] `types/database.ts` 에 `categories` Row/Insert/Update 타입 존재
- [ ] `schedule_items.Row.category_code: string` 필드 존재
- [ ] `PostgrestVersion: "12"` 유지됨 (fix-postgrest-version 후)
- [ ] `tsc --noEmit` 0 error
- [ ] `queryKeys.category` 필요 여부 검토 (현 plan 에서는 static seed 라 query 불필요 — 서버 호출 없음)
- [ ] commit: `chore(types): regen database types for categories`

---

## § 6 Task 4 — 훅 signature 확장

### §6.1 목표

- `use-create-schedule-item.ts` / `use-update-schedule-item.ts` 에 `categoryCode: string` 필드 추가
- RPC 호출 시 `p_category_code` 전달

### §6.2 구체적 변경

```ts
// lib/schedule/use-create-schedule-item.ts (변경 전)
type Input = {
  tripDayId: string;
  title: string;
  timeOfDay: string | null;
  place: PlaceResult | null;
  memo: string | null;
  url: string | null;
};

// 변경 후
type Input = {
  tripDayId: string;
  title: string;
  categoryCode: ScheduleCategory; // "transport" | ... | "other"
  timeOfDay: string | null;
  place: PlaceResult | null;
  memo: string | null;
  url: string | null;
};

// rpc 호출
await (supabase as any).rpc("create_schedule_item", {
  p_trip_day_id:       input.tripDayId,
  p_title:             input.title,
  p_time_of_day:       input.timeOfDay,
  p_place_name:        input.place?.name ?? null,
  p_place_address:     input.place?.address ?? null,
  p_place_lat:         input.place?.lat ?? null,
  p_place_lng:         input.place?.lng ?? null,
  p_place_provider:    input.place?.provider ?? null,
  p_place_external_id: input.place?.externalId ?? null,
  p_memo:              input.memo,
  p_url:               input.url,
  p_category_code:     input.categoryCode, // ← 추가
});
```

Update 훅도 동일 패턴.

### §6.3 체크리스트

- [ ] `ScheduleCategory` 를 `@/components/ui/schedule-item` 에서 re-export 또는 `lib/schedule/types.ts` 에 공유 상수로 이동
- [ ] `use-create-schedule-item` / `use-update-schedule-item` Input 타입에 `categoryCode` 추가
- [ ] RPC 호출 payload 에 `p_category_code` 추가
- [ ] call site (schedule-tab.tsx 의 `handleCreate`/`handleUpdate`) 전수 업데이트
- [ ] `pnpm tsc --noEmit` 0 error
- [ ] unit 테스트 추가: categoryCode 가 RPC payload 에 포함되는지 mock 검증

---

## § 7 Task 5 — sortable-schedule-item 실 카테고리 렌더

### §7.1 목표

`components/schedule/sortable-schedule-item.tsx:40` 의 `category="other"` 하드코딩 제거.

### §7.2 변경

```tsx
// 변경 전
<ScheduleItemCard
  category="other"  // ← 제거
  title={item.title}
  ...
/>

// 변경 후
<ScheduleItemCard
  category={item.category_code as ScheduleCategory}  // DB value
  title={item.title}
  ...
/>
```

- `item.category_code` 는 Task 3 의 regen 후 `string` 타입이지만, DB CHECK + FK 로 6종만 들어옴 → `as ScheduleCategory` 안전 cast
- 선택: `lib/schedule/parse-category.ts` 유틸 추가해 `isScheduleCategory(code)` guard 로 invalid 값 defensive fallback `"other"` — Task 3 regen 이 완벽하면 불필요

### §7.3 체크리스트

- [ ] 하드코딩 제거
- [ ] `ScheduleItemCard` category prop 에 `item.category_code` 전달
- [ ] Playwright E2E selector 영향 검토 (category dot 이 눈에 보이는 텍스트라면 "기타" 로만 매칭되는 selector 는 실 카테고리로 바뀜)
- [ ] unit 테스트 (카테고리별 색상 클래스 확인) — 기존 테스트가 있으면 확장

---

## § 8 Task 6~7 — schedule-item-modal 카테고리 분기 폼 + 장소 auto-fill

> **이 Task 가 plan 에서 가장 복잡.** 모달 전면 재구성.

### §8.1 새 폼 상태 머신

```
┌──────────────────────────────────────┐
│ 1. 카테고리 선택 (기본 other)        │
│    chip: 교통/관광/식당/숙소/쇼핑/기타│
└─────────────┬────────────────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
  other?              other 아님
    │                   │
    ▼                   ▼
┌─────────┐     ┌──────────────────┐
│ 제목    │     │ 장소 검색 1차    │
│ 입력    │     │ ├ 결과 선택 →    │
│         │     │ │   title=name   │
│ + 장소  │     │ └ 결과 없음 →    │
│  (옵션) │     │   "직접 입력" →  │
│         │     │   제목+주소 수동 │
└─────────┘     └──────────────────┘
         │                 │
         └────────┬────────┘
                  ▼
    공통: 시간 · 메모 · URL · 저장
```

### §8.2 폼 상태 (React state)

```ts
type FormStage =
  | "category_select"  // 초기
  | "other_form"       // other 선택 후 제목+옵션 장소
  | "place_search"     // other 외 카테고리 선택 후 검색 1차
  | "manual_place";    // 검색 없음 → 직접 입력

const [stage, setStage] = useState<FormStage>("category_select");
const [categoryCode, setCategoryCode] = useState<ScheduleCategory | null>(null);
// 기존: title, timeOfDay, memo, url, place
// 신규: placeNameManual, placeAddressManual (manual_place 단계용)
```

### §8.3 stage 전이 규칙

- `category_select` + `other` 선택 → `other_form`
- `category_select` + 다른 카테고리 선택 → `place_search`
- `place_search` + 검색 결과 선택 (`onPick`) → title=name set, stage remain `place_search` (장소 카드 표시) → 사용자가 시간/메모/저장 가능
- `place_search` + "직접 입력" 버튼 클릭 → `manual_place`
- `manual_place` + place 직접 입력 완료 → 저장 가능
- 뒤로가기: 모든 stage 에서 `category_select` 로 복귀 (기존 상태 reset)

### §8.4 edit 모드 초기 stage 계산

```ts
function initialStage(initial: ScheduleItem): FormStage {
  if (initial.category_code === "other") return "other_form";
  return "place_search";
}
// initial.place_* 가 있으면 place state 에 set, 없으면 검색 or 수동 선택 권유.
```

### §8.5 저장 시 검증

- other 카테고리: title 1~100자 필수
- 그 외: title 1~100자 필수 (place 선택 시 auto-fill, manual 시 수동)
- place 필수 여부 (§1.3): UI 에서만 — `category ≠ other AND !place` 이면 저장 버튼 disabled + 안내

### §8.6 장소 선택 후 title auto-fill 규칙

```ts
function handlePickPlace(picked: PlaceResult) {
  setPlace(picked);
  setTitle(picked.name);  // 무조건 덮어씀 — §1.1 사용자 확정: other 제외 카테고리는 제목 수동 입력 필드가 없음
}
```

> 🚨 **dirty flag 는 필요 없음** — "제목 수동 입력 실수" 는 other 제외 카테고리에선 입력 필드가 아예 없어서 발생 불가. 사용자 모델 2026-04-22 확정.

### §8.6b Provider resolution — `providerForTrip(trip)` 사용 필수

- `PlaceSearchForm` 및 `PlaceSearchSheet` 는 provider 를 **직접 고르지 않음**. 기존 Phase 3 패턴 유지:
  ```ts
  import { providerForTrip } from "@/lib/maps/types";
  const provider = providerForTrip(trip); // trip.is_domestic 기반 "naver" | "google"
  ```
- 이유: `create_schedule_item` RPC 가 `place_provider ↔ is_domestic` 정합성을 서버 측에서 검증(§0.8). UI 에서 provider 를 잘못 고르면 `place_provider_mismatch` 예외. Phase 3 Task 11~17 구현 전역에서 이 패턴 사용 중.
- `schedule-tab.tsx` 가 trip 객체를 이미 소유 → `PlaceSearchSheet` 에 `provider={providerForTrip(trip)}` 로 내려주면 됨 (기존 Phase 3 구현 유지, 이 plan 에서 변경 없음).

### §8.6c 카테고리 Chip 접근성 (ARIA)

- `CategoryChipGrid` 는 **single-select radio group** 의미 → 다음 ARIA 패턴 강제:
  ```tsx
  <div role="radiogroup" aria-label="카테고리 선택">
    {CATEGORY_CODES.map((code) => (
      <button
        key={code}
        role="radio"
        aria-checked={value === code}
        tabIndex={value === code ? 0 : -1}
        onClick={() => onSelect(code)}
        className={cn("chip-base", value === code && "chip-active")}
      >
        <span aria-hidden className={categoryColor[code]} />
        {categoryLabel[code]}
      </button>
    ))}
  </div>
  ```
- 키보드: ArrowLeft/Right 로 이동, Space/Enter 로 선택. Phase 0 DESIGN.md 접근성 원칙 준수.
- 각 stage 전환 시 `DialogTitle` 이 새 context 를 반영해야 함:
  - `category_select` → "카테고리 선택"
  - `other_form` → "일정 추가 (기타)"
  - `place_search` → `일정 추가 (${categoryLabel})`
  - `manual_place` → `일정 추가 (${categoryLabel} · 직접 입력)`

### §8.7 UI 컴포넌트 구조 (pseudo-code)

```tsx
<BottomSheet ...>
  {stage === "category_select" && (
    <CategoryChipGrid
      value={categoryCode}
      onSelect={(code) => {
        setCategoryCode(code);
        setStage(code === "other" ? "other_form" : "place_search");
      }}
    />
  )}

  {stage === "other_form" && (
    <OtherCategoryForm
      title={title} onTitleChange={setTitle}
      timeOfDay={timeOfDay} onTimeChange={setTimeOfDay}
      place={place} onOpenPlaceSearch={...} onClearPlace={...}
      memo={memo} onMemoChange={setMemo}
      url={url} onUrlChange={setUrl}
      onBack={() => setStage("category_select")}
    />
  )}

  {stage === "place_search" && (
    <PlaceSearchForm
      category={categoryCode!}
      place={place}
      onPick={handlePickPlace}
      onSwitchToManual={() => setStage("manual_place")}
      onBack={() => setStage("category_select")}
      // + 시간/메모/URL 공통 필드
    />
  )}

  {stage === "manual_place" && (
    <ManualPlaceForm
      title={title} onTitleChange={setTitle}
      addressManual={...} // 수동 주소
      onBack={() => setStage("place_search")}
      // + 시간/메모/URL 공통 필드
    />
  )}
</BottomSheet>
```

### §8.8 체크리스트

- [ ] FormStage 상태 machine 구현
- [ ] 각 stage 컴포넌트 분리 (`CategoryChipGrid`, `OtherCategoryForm`, `PlaceSearchForm`, `ManualPlaceForm`) — 또는 inline
- [ ] edit 모드: initial stage 계산 + place state 초기화
- [ ] 장소 선택 시 title auto-fill (Task 7)
- [ ] 저장 disabled 조건: `!canSave` 로 명확히
- [ ] 뒤로가기 UX (stage 복귀)
- [ ] 카테고리 분기 E2E 시나리오 추가 (Task 9)
- [ ] accessibility: 각 stage 제목이 DialogTitle 로 반영되게

---

## § 9 Task 8 — 마커 클릭 → 일정 스크롤

### §9.1 목표

`MapPanel` 에 `onMarkerClick?: (scheduleItemId: string) => void` prop 추가 + `schedule-tab.tsx` 에서 DOM ref 로 `scrollIntoView`.

### §9.2 구현

```tsx
// components/schedule/map-panel.tsx (내부에서 provider.createMap 의 addMarkers 호출 시)
addMarkers(items.map(it => ({
  lat: it.place_lat!,
  lng: it.place_lng!,
  label: String(it.sort_order),
  onClick: () => props.onMarkerClick?.(it.id),
})));
```

```tsx
// components/trip/schedule-tab.tsx (이미 MapPanel 렌더링 중)
const scheduleRefs = useRef<Record<string, HTMLLIElement | null>>({});
const handleMarkerClick = (id: string) => {
  const el = scheduleRefs.current[id];
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
};

<MapPanel ... onMarkerClick={handleMarkerClick} />

// SortableScheduleItem 이 ref forwarding 되도록 수정 필요
<SortableScheduleItem
  key={item.id}
  ref={(el) => { scheduleRefs.current[item.id] = el; }}
  ...
/>
```

### §9.3 `SortableScheduleItem` forwardRef 전환

- 현 시그니처는 `ref` 미지원. `React.forwardRef` 로 감싸거나, inner ref callback 으로 export.
- dnd-kit `setNodeRef` 와 충돌 주의 → `ref` merge 유틸 (`@dnd-kit/utilities` 의 `useCombinedRefs` 또는 자체 merge).

### §9.4 체크리스트

- [ ] MapPanel addMarkers 에 onClick 전달
- [ ] schedule-tab scrollIntoView 구현
- [ ] SortableScheduleItem forwardRef
- [ ] E2E 시나리오 (선택 — Playwright 에서 map marker click 은 SDK 주입 요소라 fragile, skip 대안)

---

## § 10 Task 9 — Tests + Manual QA

### §10.1 Unit 테스트 (vitest)

- `tests/unit/schedule-category-mapping.test.ts` — categoryCode → color class 매핑 6종 전수
- `tests/unit/schedule-item-modal-stage.test.ts` — FormStage 전이 규칙 7 전이
- `tests/unit/use-create-schedule-item-category.test.ts` — RPC payload 에 `p_category_code` 포함 검증

### §10.2 Integration 테스트 (tests/integration)

- `rls-categories.test.ts` — SELECT 허용 / INSERT 차단 (anon·auth 두 케이스)
- `create-schedule-item-with-category.test.ts` — RPC 12 파라미터 호출 + `category_code` 가 row 에 반영
- `fk-category-violation.test.ts` — invalid `category_code` → foreign_key_violation 재발

### §10.3 E2E 시나리오 (Playwright)

- `tests/e2e/schedule-category-flow.spec.ts`:
  - "숙소" 카테고리 선택 → 장소 검색 → 결과 선택 → title=place.name 자동 set → 저장 → 카드에 "숙소" 표시
  - "기타" 선택 → 제목 수동 입력 → 저장
  - "교통" 선택 → 검색 결과 없음 → "직접 입력" → 제목+주소 수동 → 저장

### §10.4 Manual QA 체크리스트 (`docs/qa/phase3-gap-recovery-manual.md`)

1. 기존 일정 전부 "기타" 로 표시되는지
2. 일정 편집 → 카테고리 변경 → 카드 색상 변경 확인
3. 카테고리별 장소 검색 플로우 3~4 종 실 NCP 키로 검증
4. 마커 클릭 → 일정 스크롤 (실 지도 상호작용)

### §10.5 체크리스트

- [ ] Unit 3 파일 추가, 전체 unit 테스트 PASS
- [ ] Integration 3 파일 추가, 전체 PASS
- [ ] E2E 1 spec 추가, 전체 PASS
- [ ] Manual QA 문서 작성
- [ ] `pnpm lint` 0 error
- [ ] `pnpm build` ✓

---

## § 11 Exit Gate

### §11.1 자동 검증

- [ ] `pnpm tsc --noEmit` 0 error
- [ ] `pnpm lint` 0 error
- [ ] `pnpm build` ✓ (14+ routes)
- [ ] `pnpm vitest run tests/unit` 전수 PASS (기존 63 + 신규 3 파일)
- [ ] `pnpm test:integration` 전수 PASS (기존 69 + 신규 3 파일)
- [ ] `pnpm playwright test` 전수 PASS (기존 8 passed + 신규 1 파일)
- [ ] `pnpm audit --production` No known vulnerabilities

### §11.2 Verification SQL

1. `select count(*) from public.categories;` → 6
2. `select count(*) from public.schedule_items where category_code not in ('transport','sightseeing','food','lodging','shopping','other');` → 0 (FK + CHECK 검증)
3. `select pg_get_function_arguments(oid) from pg_proc where proname in ('create_schedule_item','update_schedule_item');` → 12 파라미터 확인
4. `select has_function_privilege('authenticated', 'public.create_schedule_item(uuid, text, time without time zone, text, text, double precision, double precision, text, text, text, text, text)', 'execute');` → true
5. `select policyname from pg_policies where tablename = 'categories';` → `categories_select_all` 만

### §11.3 Retrospective + tag

- [ ] `docs/plans/2026-04-22-phase3-gap-recovery.md` 끝에 retrospective 섹션 append
- [ ] wiki: `sessions/2026-04-XX-phase3-gap-recovery-execution.md` 작성
- [ ] tag `phase-3-gap-recovery` 생성 (사용자 수동 push)

### §11.4 초기 스펙 역추적 매트릭스 (새 규율)

Exit gate v2 — 원본 스펙 §6 feature list 와 구현 대조. Phase 3 tag 재선언 전 필수.

| 스펙 항목 | 구현 파일 | 상태 |
|---|---|---|
| §4 schedule_items.category_id FK | 0008_categories.sql | ✅ (code-based FK) |
| §5 카테고리 관리 페이지 | — | ❌ Phase 4 이관 (읽기 전용 시스템 테이블만 완성) |
| §6.4 카테고리 필수 선택 | schedule-item-modal | ✅ |
| §6.4 마커 클릭 스크롤 | schedule-tab + map-panel | ✅ |
| §6.10 기본 6종 | 0008 seed | ✅ |
| §6.5 경비 탭 실 DB | — | ❌ Phase 4 |
| §6.6 Todo 실 DB | — | ❌ Phase 4 |
| §6.7 기록 실 DB | — | ❌ Phase 4 |
| §6.8 게스트 공유 SSR | — | ❌ Phase 4 |
| §6.4 ⋮ "경비 추가" | — | ❌ Phase 4 |

---

## § 12 집행 프로토콜 (이 plan 따라갈 때)

### §12.1 Pre-execution critic gate (강제)

집행 시작 **전**에 `oh-my-claudecode:critic` 로 이 plan 전체를 pre-commitment 템플릿으로 리뷰:
- Verdict 가 `REVISE` 면 inline 패치 반영 후 재실행. `NO-GO` 면 plan 전면 재작성.
- Phase 3 Part A/B/C 가 각각 critic gate 를 거쳤던 관례 준수 ([[sessions/2026-04-20-phase3-plan-part-c-and-critic-2]]).
- critic 입력: §0 verbatim + §1 UX + Task 1~9. 출력을 plan retrospective 상단에 보존.

### §12.2 subagent-driven-development 파이프라인 (Task 단위)

Phase 2 Task 12~15, Phase 3 Task 11~17 과 동일한 4단 파이프라인 사용:
1. **Implementer** (`executor`, opus 권장 for Task 2/6/7) — 실 코드 변경 + 최소 검증
2. **Spec reviewer** (`code-reviewer`) — plan 명세 vs diff 대조, 누락/드리프트 지적
3. **Code-quality reviewer** (같은 agent, 별 세션) — SOLID·가독성·테스트 커버리지·에러 핸들링
4. **Fix pass** (executor) — 1+2+3 피드백 통합 반영

> Task 1 (0008 SQL) / Task 3 (types regen) 같은 단순 작업은 4단계 생략 가능. Task 2 / 6 / 7 은 필수.

### §12.3 집행 루틴

1. 각 Task 착수 전 `§0` verbatim 블록을 grep 으로 재확인 (drift 방지)
2. RPC 변경 시 `drop function` → `create or replace` → `REVOKE/GRANT` 순서 엄수
3. 마이그레이션 적용은 **로컬→Dashboard→migration repair** 3단 fallback
4. 매 Task 끝에 자체 chk + commit
5. Task 2 (0009 RPC) 완료 직후 `pnpm tsc` 로 타입 drift 조기 감지
6. Task 6~7 (modal 재구성) 은 stage 별 unit 테스트 선행 작성 (TDD)
7. Exit gate 진입 전 §0 재확인, §11 자동 + 수동 + 역추적 매트릭스 3 축 모두 충족
8. 집행 중 Plan 에 없는 결정 발생 시 plan 파일에 append 로 기록 (silent decision drift 금지)

---

## § 13 후속 follow-up (이 plan 밖, Phase 4 이후)

### §13.1 이 plan 집행 중 ADR 작성 필요 (세션 내 처리)

이 plan 집행 시점에 **wiki ADR 2건 작성** 필수 ([[docs/decisions]] / 위키 `decisions/`):
- **ADR-010: `categories.code text PK` 선택** — UUID id 대신 `code` 를 PK 로 선택한 이유 (UI union type 과 1:1 매핑, join 불필요, seed 안정성)
- **ADR-011: place 필수 여부 DB 제약 비강제** — CHECK 제약으로 "category ≠ other ⇒ place NOT NULL" 강제하지 않고 **UI 에서만 강제** 한 이유 (기존 row migration 호환성 + 편집 중 임시 상태 허용)

ADR 작성은 Task 1 commit 과 함께. plan exit gate §11.3 retrospective 이전에 wiki 에 생성 완료.

### §13.2 Phase 4 이관 (별도 plan)

1. `categories` **관리 페이지** (group 별 커스텀 카테고리 or 글로벌 수정 권한)
2. 경비·Todo·기록 탭 실 DB 연결
3. 게스트 공유 `/share/[token]` SSR + `get_guest_trip_data` RPC
4. 경비↔일정 연동 (`expenses.schedule_item_id` FK + ⋮ "경비 추가" 메뉴)
5. Exit gate v2 프로토콜의 **"초기 스펙 역추적 매트릭스"** 를 CLAUDE.md 규율로 승격
6. Naver Maps 통합 콘솔 마이그레이션 관련 지식 wiki 화 (오늘 세션 성과 — ncpKeyId, mapx/mapy WGS84×10^7, loading=async importLibrary 3종)

---

## Retrospective (집행 후 작성)

> _Task 집행 완료 후 이 섹션에 실제 수행 내역 / drift / 배움 기록_
