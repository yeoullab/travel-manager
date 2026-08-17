---
type: plan
date: 2026-08-17
author: sohyun + Claude
spec: docs/specs/2026-08-17-candidate-items-and-category-colors-design.md
---

# 일정 후보 + 카페 카테고리 + 카테고리 색 마커 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 일정을 "후보"(플랜 B / 보관함)로 등록·승격·강등할 수 있게 하고, 카페 카테고리를 추가하며, 지도 마커를 카테고리 색으로 렌더한다.

**Architecture:** `schedule_items`에 `is_candidate` + 비정규화 `trip_id`를 추가하고 `trip_day_id`를 nullable로 완화한다 (풀 후보 = day 없음). sort_order는 (day, is_candidate) / (trip, day-null) 파티션별 독립 시퀀스이며, 재번호가 있는 모든 RPC를 파티션 인식으로 교체한다. 승격·강등·후보 이동은 신규 단일 RPC `set_schedule_item_candidacy`("대상 파티션으로 이동")가 담당한다. 마커 색은 `lib/maps/marker-colors.ts` 단일 소스에서 공급한다.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (raw SQL migration + security-definer RPC + RLS), TanStack Query, dnd-kit, Tailwind v4, Vitest(unit/integration), Playwright(e2e).

**작업 순서 주의:** DB 마이그레이션(Task 1)이 모든 뒤 Task의 전제다. 마이그레이션 적용 전에는 통합 테스트가 성립하지 않으므로, DB 파트는 "마이그레이션 작성 → 적용 → 테스트로 검증" 순서로 진행한다 (일반 TDD 순서의 예외). 클라이언트 파트는 TDD를 따른다.

**배포 호환성:** `create_schedule_item`의 신규 파라미터 2개는 default가 있어 기존 named 호출이 동작한다. 단, 현재 V1의 `trip_days!inner` 조회를 보호하려면 기존 단일 `trip_day_id` FK를 제거하고 복합 FK로 **교체**해야 하며, `create_lodging_schedule_items_for_range`도 같은 마이그레이션에서 신규 `trip_id`를 저장하도록 재정의해야 한다. 통합 테스트·E2E는 `.env.local`을 통해 **linked 원격 DB**를 사용하므로, 원격 push는 Task 2에서 로컬 `db reset` 검증을 통과한 뒤 수행한다 (push 전 로컬 검증이 방어선).

---

## File Structure

| 구분 | 경로 | 책임 |
|---|---|---|
| Create | `supabase/migrations/0023_candidate_items.sql` | 스키마 + 카테고리 seed + RPC 전체 교체 |
| Create | `lib/maps/marker-colors.ts` | 카테고리 → 마커 색/텍스트톤 단일 소스 |
| Create | `lib/schedule/use-set-schedule-item-candidacy.ts` | 승격/강등/후보 이동 mutation 훅 |
| Create | `components/schedule/candidate-section.tsx` | Day 화면 접이식 후보 섹션 |
| Create | `components/schedule/candidate-panel.tsx` | 후보 탭 화면 (풀 + 일자별 모아보기) |
| Modify | `types/database.ts` | `pnpm db:types` 재생성 (trip_day_id nullable, 신규 컬럼/RPC) |
| Modify | `lib/types.ts` | ScheduleCategory에 `cafe` 추가 |
| Modify | `app/globals.css` | `--color-accent-brown/rose/yellow` 토큰 |
| Modify | `components/ui/schedule-item.tsx` | 카테고리 색/라벨 맵 갱신 |
| Modify | `components/schedule/schedule-item-modal.tsx` | cafe 픽커 + "후보로 등록" 체크박스 + 전환 버튼 |
| Modify | `lib/schedule/category-map.ts` | cafe → food 지출 매핑 |
| Modify | `lib/category/use-categories.ts` | CATEGORY_FALLBACK_LABEL에 cafe |
| Modify | `lib/maps/types.ts` | MarkerSpec 확장 (color/textColor/variant) |
| Modify | `lib/maps/providers/naver-provider.ts`, `google-provider.ts` | main/candidate 마커 렌더 |
| Modify | `components/schedule/map-panel.tsx` | MapItem 확장, marker-colors 적용 |
| Modify | `app/share/[token]/page.tsx` | 게스트 main 마커 category/variant 전달 + cafe 허용 |
| Modify | `lib/schedule/use-schedule-list.ts` | inner join → `.eq("trip_id")` 직접 필터 |
| Modify | `lib/schedule/use-create-schedule-item.ts` | p_is_candidate / p_trip_id 전달 |
| Modify | `lib/schedule/apply-local-reorder.ts`, `apply-local-move.ts`, `apply-local-bulk-move.ts` | 파티션 인식 |
| Modify | `components/schedule/day-tab-bar.tsx` | "후보" 탭 추가 |
| Modify | `components/schedule/schedule-list.tsx`, `sortable-schedule-item.tsx` | candidate variant (hollow 배지) |
| Modify | `components/schedule/day-move-sheet.tsx` | 제목 커스텀 + "전체 후보" 옵션 |
| Modify | `components/trip/schedule-tab.tsx` | 파티션 분리, 뷰 전환, 지도 토글, 전환 액션 배선 |
| Modify | `components/trip/date-shrink-confirm.tsx` | 기간 축소 시 본 일정/후보의 서로 다른 이동 목적지 안내 |
| Test | `tests/integration/candidate-items-rpc.test.ts` 등 (Task 3–4) | RPC/RLS/게스트 검증 |
| Modify/Test | `tests/unit/use-categories.test.ts`, `tests/unit/schedule-item-modal-stage.test.ts`, `tests/integration/rls-categories.test.ts`, `tests/e2e/settings-categories.spec.ts` | cafe 7종·신규 DB 필드 회귀 가드 |
| Modify | `playwright.config.ts` | candidate-flow를 alice 프로젝트에서 실제 수집 |
| Test | `tests/unit/marker-colors.test.ts` 외 갱신 다수 | 회귀 가드 |
| Test | `tests/e2e/candidate-flow.spec.ts` | 등록→섹션→탭→승격 플로우 |

---

### Task 1: 마이그레이션 `0023_candidate_items.sql` 작성

**Files:**
- Create: `supabase/migrations/0023_candidate_items.sql`

- [ ] **Step 1: 스키마 파트 작성**

파일을 생성하고 아래 내용으로 시작한다:

```sql
-- 0023_candidate_items.sql
-- 후보(플랜 B) 일정 + 카페 카테고리 + 카테고리 색.
-- 스펙: docs/specs/2026-08-17-candidate-items-and-category-colors-design.md
-- 의존: 0022_schedule_bulk_delete.sql

-- ══════════════════════════════════════════════════════════════════════
-- 1. schedule_items 스키마 확장
-- ══════════════════════════════════════════════════════════════════════

alter table public.schedule_items
  add column is_candidate boolean not null default false,
  add column trip_id uuid references public.trips(id) on delete cascade;

-- 기존 행 백필: trip_day_id → trip_days.trip_id
update public.schedule_items si
  set trip_id = td.trip_id
  from public.trip_days td
  where td.id = si.trip_day_id;

alter table public.schedule_items
  alter column trip_id set not null,
  alter column trip_day_id drop not null;

-- 일자가 없는 행은 반드시 전체 풀 후보
alter table public.schedule_items
  add constraint schedule_items_dayless_is_candidate
  check (trip_day_id is not null or is_candidate);

-- trip_id 비정규화 정합성: (trip_day_id, trip_id) 쌍이 trip_days와 일치해야 함.
-- 기존 단일 FK를 남기면 PostgREST가 trip_days 관계를 2개로 감지하므로 반드시 교체한다.
-- 복합 FK가 기존 on delete cascade 역할도 이어받는다.
alter table public.schedule_items
  drop constraint schedule_items_trip_day_id_fkey;

-- MATCH SIMPLE 이므로 trip_day_id null(풀 후보)이면 제약 미적용 — 의도된 동작.
create unique index trip_days_id_trip_id_key on public.trip_days(id, trip_id);
alter table public.schedule_items
  add constraint schedule_items_day_trip_consistent
  foreign key (trip_day_id, trip_id)
  references public.trip_days(id, trip_id) on delete cascade;

-- 인덱스: 파티션 정렬 + 풀 조회 + 클라이언트 trip_id 직접 필터
create index idx_schedule_items_day_partition
  on public.schedule_items(trip_day_id, is_candidate, sort_order);
create index idx_schedule_items_pool
  on public.schedule_items(trip_id, sort_order)
  where trip_day_id is null;
create index idx_schedule_items_trip on public.schedule_items(trip_id);

-- ══════════════════════════════════════════════════════════════════════
-- 2. RLS 재정의 — 조건부 판정 (단순 OR 금지: 스펙 §3 RLS 참조)
--    day가 있으면 day 경유만, 없으면 trip_id 경유만.
-- ══════════════════════════════════════════════════════════════════════

drop policy "schedule_items_select" on public.schedule_items;
drop policy "schedule_items_insert" on public.schedule_items;
drop policy "schedule_items_update" on public.schedule_items;
drop policy "schedule_items_delete" on public.schedule_items;

create policy "schedule_items_select"
  on public.schedule_items for select to authenticated
  using (
    case when trip_day_id is not null
      then public.can_access_trip(
        (select trip_id from public.trip_days where id = trip_day_id))
      else public.can_access_trip(trip_id)
    end
  );

create policy "schedule_items_insert"
  on public.schedule_items for insert to authenticated
  with check (
    case when trip_day_id is not null
      then public.can_access_trip(
        (select trip_id from public.trip_days where id = trip_day_id))
      else public.can_access_trip(trip_id)
    end
  );

create policy "schedule_items_update"
  on public.schedule_items for update to authenticated
  using (
    case when trip_day_id is not null
      then public.can_access_trip(
        (select trip_id from public.trip_days where id = trip_day_id))
      else public.can_access_trip(trip_id)
    end
  )
  with check (
    case when trip_day_id is not null
      then public.can_access_trip(
        (select trip_id from public.trip_days where id = trip_day_id))
      else public.can_access_trip(trip_id)
    end
  );

create policy "schedule_items_delete"
  on public.schedule_items for delete to authenticated
  using (
    case when trip_day_id is not null
      then public.can_access_trip(
        (select trip_id from public.trip_days where id = trip_day_id))
      else public.can_access_trip(trip_id)
    end
  );
```

- [ ] **Step 2: 카테고리 파트 추가 (같은 파일에 이어서)**

```sql
-- ══════════════════════════════════════════════════════════════════════
-- 3. 카테고리: cafe 추가 + 식당/쇼핑 색 변경 (기존 DB 기준 update + insert)
-- ══════════════════════════════════════════════════════════════════════

update public.categories set sort_order = 7 where code = 'other';
update public.categories set sort_order = 6 where code = 'shopping';
update public.categories set sort_order = 5 where code = 'lodging';

update public.categories set color_token = 'bg-accent-brown'  where code = 'food';
update public.categories set color_token = 'bg-accent-yellow' where code = 'shopping';

insert into public.categories (code, name, color_token, sort_order)
  values ('cafe', '카페', 'bg-accent-rose', 4);
```

- [ ] **Step 3: RPC 파트 — `create_schedule_item` 교체 (구 13-param drop → 15-param)**

```sql
-- ══════════════════════════════════════════════════════════════════════
-- 4. RPC 교체. 시그니처가 바뀌는 함수는 구 버전 drop (PostgREST 오버로드 모호성 방지,
--    0009·0020 패턴). update/delete/reorder/move/resize/guest 는 시그니처 동일 →
--    create or replace 만.
--    sort_order를 읽거나 쓰는 RPC는 모두 trips 행을 FOR UPDATE로 잠근 뒤 계산한다.
-- ══════════════════════════════════════════════════════════════════════

drop function if exists public.create_schedule_item(
  uuid, text, time without time zone, text, text,
  double precision, double precision, text, text, text, text, text, text);

create or replace function public.create_schedule_item(
  p_trip_day_id        uuid,
  p_title              text,
  p_time_of_day        time without time zone default null,
  p_place_name         text default null,
  p_place_address      text default null,
  p_place_lat          double precision default null,
  p_place_lng          double precision default null,
  p_place_provider     text default null,
  p_place_external_id  text default null,
  p_memo               text default null,
  p_url                text default null,
  p_category_code      text default 'other',
  p_place_external_url text default null,
  p_is_candidate       boolean default false,
  p_trip_id            uuid default null
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

  if p_trip_day_id is null then
    -- 풀 후보 생성 경로
    if not p_is_candidate then raise exception 'dayless_must_be_candidate'; end if;
    if p_trip_id is null then raise exception 'trip_id_required'; end if;
    select t.is_domestic into v_is_domestic from public.trips t where t.id = p_trip_id;
    if v_is_domestic is null then raise exception 'trip_not_found'; end if;
    v_trip_id := p_trip_id;
  else
    select td.trip_id, t.is_domestic into v_trip_id, v_is_domestic
      from public.trip_days td
      join public.trips t on t.id = td.trip_id
      where td.id = p_trip_day_id;
    if v_trip_id is null then raise exception 'trip_day_not_found'; end if;
  end if;
  if not public.can_access_trip(v_trip_id) then raise exception 'forbidden'; end if;

  -- 같은 여행의 모든 sort_order mutation과 직렬화한다.
  perform 1 from public.trips where id = v_trip_id for update;

  -- 잠금 대기 중 resize로 day가 삭제될 수 있으므로 day 경로를 다시 검증한다.
  if p_trip_day_id is not null and not exists (
    select 1 from public.trip_days
    where id = p_trip_day_id and trip_id = v_trip_id
  ) then
    raise exception 'trip_day_not_found';
  end if;

  if p_place_provider is not null then
    if p_place_lat is null or p_place_lng is null then
      raise exception 'place_coordinate_required';
    end if;
    if v_is_domestic and p_place_provider != 'naver' then
      raise exception 'place_provider_mismatch';
    end if;
    if not v_is_domestic and p_place_provider != 'google' then
      raise exception 'place_provider_mismatch';
    end if;
  end if;

  -- 파티션 내 max+1
  if p_trip_day_id is null then
    select coalesce(max(sort_order), 0) + 1 into v_next_order
      from public.schedule_items
      where trip_id = v_trip_id and trip_day_id is null;
  else
    select coalesce(max(sort_order), 0) + 1 into v_next_order
      from public.schedule_items
      where trip_day_id = p_trip_day_id and is_candidate = p_is_candidate;
  end if;

  insert into public.schedule_items(
    trip_day_id, trip_id, is_candidate, title, sort_order, time_of_day,
    place_name, place_address, place_lat, place_lng,
    place_provider, place_external_id, memo, url,
    category_code, place_external_url
  ) values (
    p_trip_day_id, v_trip_id, p_is_candidate, p_title, v_next_order, p_time_of_day,
    p_place_name, p_place_address, p_place_lat, p_place_lng,
    p_place_provider, p_place_external_id, p_memo, p_url,
    p_category_code, p_place_external_url
  ) returning id into v_new_id;

  return v_new_id;
end $$;

revoke all on function public.create_schedule_item(
  uuid, text, time without time zone, text, text,
  double precision, double precision, text, text, text, text, text, text,
  boolean, uuid
) from public;
grant execute on function public.create_schedule_item(
  uuid, text, time without time zone, text, text,
  double precision, double precision, text, text, text, text, text, text,
  boolean, uuid
) to authenticated;
```

- [ ] **Step 4: `create_lodging_schedule_items_for_range` 교체 (`trip_id` 저장 + 본 일정 파티션)**

기존 함수는 `trip_id`를 INSERT하지 않으므로 신규 NOT NULL 스키마에서 즉시 실패한다. 시그니처는 유지하고 본 일정 전용으로 재정의한다:

```sql
create or replace function public.create_lodging_schedule_items_for_range(
  p_trip_id            uuid,
  p_start_day_id       uuid,
  p_end_day_id         uuid,
  p_title              text,
  p_time_of_day        time without time zone default null,
  p_place_name         text default null,
  p_place_address      text default null,
  p_place_lat          double precision default null,
  p_place_lng          double precision default null,
  p_place_provider     text default null,
  p_place_external_id  text default null,
  p_memo               text default null,
  p_url                text default null,
  p_place_external_url text default null
) returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_is_domestic boolean;
  v_start_no    int;
  v_end_no      int;
  v_lo          int;
  v_hi          int;
  v_day         record;
  v_next_order  int;
  v_new_id      uuid;
  v_ids         uuid[] := '{}';
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  if not public.can_access_trip(p_trip_id) then raise exception 'forbidden'; end if;

  -- create/reorder/move/delete/candidacy와 동일한 여행 단위 잠금 규칙.
  perform 1 from public.trips where id = p_trip_id for update;

  select td.day_number, t.is_domestic into v_start_no, v_is_domestic
    from public.trip_days td
    join public.trips t on t.id = td.trip_id
    where td.id = p_start_day_id and td.trip_id = p_trip_id;
  if v_start_no is null then raise exception 'start_day_not_found'; end if;

  select day_number into v_end_no
    from public.trip_days
    where id = p_end_day_id and trip_id = p_trip_id;
  if v_end_no is null then raise exception 'end_day_not_found'; end if;

  if p_place_provider is not null then
    if p_place_lat is null or p_place_lng is null then
      raise exception 'place_coordinate_required';
    end if;
    if v_is_domestic and p_place_provider != 'naver' then
      raise exception 'place_provider_mismatch';
    end if;
    if not v_is_domestic and p_place_provider != 'google' then
      raise exception 'place_provider_mismatch';
    end if;
  end if;

  v_lo := least(v_start_no, v_end_no);
  v_hi := greatest(v_start_no, v_end_no);

  for v_day in
    select id
    from public.trip_days
    where trip_id = p_trip_id and day_number between v_lo and v_hi
    order by day_number
  loop
    select coalesce(max(sort_order), 0) + 1 into v_next_order
      from public.schedule_items
      where trip_day_id = v_day.id and is_candidate = false;

    insert into public.schedule_items(
      trip_day_id, trip_id, is_candidate, title, sort_order, time_of_day,
      place_name, place_address, place_lat, place_lng,
      place_provider, place_external_id, memo, url,
      category_code, place_external_url
    ) values (
      v_day.id, p_trip_id, false, p_title, v_next_order, p_time_of_day,
      p_place_name, p_place_address, p_place_lat, p_place_lng,
      p_place_provider, p_place_external_id, p_memo, p_url,
      'lodging', p_place_external_url
    ) returning id into v_new_id;

    v_ids := array_append(v_ids, v_new_id);
  end loop;

  return v_ids;
end $$;
```

(시그니처가 유지되므로 기존 revoke/grant가 보존된다.)

- [ ] **Step 5: `update_schedule_item` 교체 (시그니처 동일, dayless 대응)**

```sql
create or replace function public.update_schedule_item(
  p_item_id            uuid,
  p_title              text,
  p_time_of_day        time without time zone default null,
  p_place_name         text default null,
  p_place_address      text default null,
  p_place_lat          double precision default null,
  p_place_lng          double precision default null,
  p_place_provider     text default null,
  p_place_external_id  text default null,
  p_memo               text default null,
  p_url                text default null,
  p_category_code      text default 'other',
  p_place_external_url text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_trip_id     uuid;
  v_is_domestic boolean;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;

  -- trip_id 는 모든 행에서 not null — null 이면 행이 없는 것 (풀 후보도 조회됨)
  select trip_id into v_trip_id
    from public.schedule_items where id = p_item_id;
  if v_trip_id is null then raise exception 'schedule_item_not_found'; end if;

  select t.is_domestic into v_is_domestic from public.trips t where t.id = v_trip_id;
  if not public.can_access_trip(v_trip_id) then raise exception 'forbidden'; end if;

  if p_place_provider is not null then
    if p_place_lat is null or p_place_lng is null then
      raise exception 'place_coordinate_required';
    end if;
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
        category_code = p_category_code,
        place_external_url = p_place_external_url
    where id = p_item_id;
end $$;
```

(시그니처 동일 → revoke/grant 재선언 불필요. 이하 시그니처 유지 함수 모두 동일.)

- [ ] **Step 6: `delete_schedule_item` 교체 (dayless + 파티션 재번호)**

```sql
create or replace function public.delete_schedule_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_day_id       uuid;
  v_trip_id      uuid;
  v_locked_trip  uuid;
  v_is_candidate boolean;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;

  select trip_day_id, trip_id, is_candidate
    into v_day_id, v_trip_id, v_is_candidate
    from public.schedule_items where id = p_item_id;
  if v_trip_id is null then raise exception 'schedule_item_not_found'; end if;
  if not public.can_access_trip(v_trip_id) then raise exception 'forbidden'; end if;

  v_locked_trip := v_trip_id;
  perform 1 from public.trips where id = v_locked_trip for update;

  -- 잠금 전 값은 식별용일 뿐이다. mutation에 쓸 파티션을 잠금 후 다시 읽는다.
  select trip_day_id, trip_id, is_candidate
    into v_day_id, v_trip_id, v_is_candidate
    from public.schedule_items where id = p_item_id;
  if v_trip_id is null then raise exception 'schedule_item_not_found'; end if;
  if v_trip_id != v_locked_trip then raise exception 'schedule_item_changed'; end if;

  delete from public.schedule_items where id = p_item_id;

  -- 원 파티션 재번호 (본/일자후보/풀 각각 자기 파티션만)
  if v_day_id is null then
    update public.schedule_items si
      set sort_order = rn.ord, updated_at = now()
    from (
      select id, row_number() over (order by sort_order) as ord
      from public.schedule_items
      where trip_id = v_trip_id and trip_day_id is null
    ) rn
    where si.id = rn.id;
  else
    update public.schedule_items si
      set sort_order = rn.ord, updated_at = now()
    from (
      select id, row_number() over (order by sort_order) as ord
      from public.schedule_items
      where trip_day_id = v_day_id and is_candidate = v_is_candidate
    ) rn
    where si.id = rn.id;
  end if;
end $$;
```

- [ ] **Step 7: `delete_schedule_items` (bulk) 교체**

trip_days inner join 제거(풀 후보 매칭 가능), trips 행 잠금으로 동시성 단순화, 파티션별 재번호:

```sql
create or replace function public.delete_schedule_items(p_item_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_input_count int;
  v_expected_count int;
  v_matched_count int;
  v_trip_count int;
  v_trip_id uuid;
  v_locked_trip_id uuid;
  v_inaccessible boolean;
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;

  v_input_count := coalesce(array_length(p_item_ids, 1), 0);
  if v_input_count = 0 then raise exception 'empty_item_ids'; end if;

  select count(*) into v_expected_count
    from (select distinct unnest(p_item_ids) as id) input_ids;
  if v_expected_count <> v_input_count then
    raise exception 'duplicate_item_ids';
  end if;

  -- trip_id 직접 집계 (풀 후보 포함)
  select count(*), count(distinct si.trip_id), (array_agg(distinct si.trip_id))[1]
    into v_matched_count, v_trip_count, v_trip_id
    from public.schedule_items si
    where si.id in (select distinct unnest(p_item_ids));

  if v_matched_count <> v_expected_count then
    raise exception 'missing_schedule_items';
  end if;
  if v_trip_count <> 1 or v_trip_id is null then
    raise exception 'mixed_trip_items';
  end if;

  select not public.can_access_trip(v_trip_id) into v_inaccessible;
  if v_inaccessible then raise exception 'forbidden'; end if;

  -- 여행 단위 직렬화 (파티션 재번호 경합 방지)
  v_locked_trip_id := v_trip_id;
  perform 1 from public.trips where id = v_locked_trip_id for update;

  -- 잠금 대기 중 대상이 이동/삭제됐을 수 있으므로 mutation 직전에 다시 검증한다.
  select count(*), count(distinct si.trip_id), (array_agg(distinct si.trip_id))[1]
    into v_matched_count, v_trip_count, v_trip_id
    from public.schedule_items si
    where si.id in (select distinct unnest(p_item_ids));
  if v_matched_count <> v_expected_count then
    raise exception 'missing_schedule_items';
  end if;
  if v_trip_count <> 1 or v_trip_id is null then
    raise exception 'mixed_trip_items';
  end if;
  if v_trip_id != v_locked_trip_id then
    raise exception 'schedule_items_changed';
  end if;

  with removed as (
    delete from public.schedule_items si
    where si.id in (select distinct unnest(p_item_ids))
    returning si.trip_day_id, si.is_candidate
  ),
  affected as (
    select distinct trip_day_id, is_candidate from removed
  ),
  ranked as (
    select si.id,
           row_number() over (
             partition by si.trip_day_id, si.is_candidate
             order by si.sort_order, si.created_at, si.id
           )::int as rn
    from public.schedule_items si
    join affected a
      on a.trip_day_id is not distinct from si.trip_day_id
     and a.is_candidate = si.is_candidate
    where si.trip_id = v_trip_id
  )
  update public.schedule_items si
     set sort_order = ranked.rn, updated_at = now()
    from ranked
   where si.id = ranked.id;
end $$;
```

- [ ] **Step 8: `reorder_schedule_items_in_day` 교체 (파티션 판정 + 파티션 개수 검증)**

```sql
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
  v_locked_trip    uuid;
  v_expected_count int;
  v_provided_count int;
  v_all_cand       boolean;
  v_any_cand       boolean;
  v_is_candidate   boolean;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;

  select trip_id into v_trip_id from public.trip_days where id = p_trip_day_id;
  if v_trip_id is null then raise exception 'trip_day_not_found'; end if;
  if not public.can_access_trip(v_trip_id) then raise exception 'forbidden'; end if;

  v_locked_trip := v_trip_id;
  perform 1 from public.trips where id = v_locked_trip for update;

  -- resize가 같은 잠금을 먼저 잡고 day를 삭제했을 수 있다.
  select trip_id into v_trip_id from public.trip_days where id = p_trip_day_id;
  if v_trip_id is null then raise exception 'trip_day_not_found'; end if;
  if v_trip_id != v_locked_trip then raise exception 'trip_day_changed'; end if;

  v_provided_count := coalesce(array_length(p_item_ids, 1), 0);
  if v_provided_count = 0 then raise exception 'item_set_mismatch'; end if;

  if exists (
    select 1 from unnest(p_item_ids) as arr(id)
    where not exists (
      select 1 from public.schedule_items si
      where si.id = arr.id and si.trip_day_id = p_trip_day_id
    )
  ) then raise exception 'item_not_in_day'; end if;

  -- 파티션 판정: 전달된 아이템들의 is_candidate 가 모두 같아야 함
  select bool_and(si.is_candidate), bool_or(si.is_candidate)
    into v_all_cand, v_any_cand
    from public.schedule_items si
    where si.id = any(p_item_ids) and si.trip_day_id = p_trip_day_id;
  if v_all_cand is distinct from v_any_cand then
    raise exception 'mixed_partition_items';
  end if;
  v_is_candidate := coalesce(v_all_cand, false);

  -- 개수 검증은 해당 파티션 기준
  select count(*) into v_expected_count
    from public.schedule_items
    where trip_day_id = p_trip_day_id and is_candidate = v_is_candidate;
  if v_expected_count != v_provided_count then
    raise exception 'item_set_mismatch';
  end if;

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
```

- [ ] **Step 9: move RPC 2종 교체 (본 일정 전용 가드 + 파티션 인식 재번호)**

```sql
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
  v_locked_trip_id uuid;
  v_is_candidate   boolean;
  v_target_trip_id uuid;
  v_target_count   int;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;

  select trip_day_id, trip_id, is_candidate
    into v_source_day_id, v_source_trip_id, v_is_candidate
    from public.schedule_items where id = p_item_id;
  if v_source_trip_id is null then raise exception 'schedule_item_not_found'; end if;
  if v_is_candidate then raise exception 'candidate_not_movable_here'; end if;

  select trip_id into v_target_trip_id from public.trip_days where id = p_target_day_id;
  if v_target_trip_id is null then raise exception 'target_day_not_found'; end if;
  if v_source_trip_id != v_target_trip_id then
    raise exception 'cannot_move_across_trips';
  end if;
  if not public.can_access_trip(v_source_trip_id) then
    raise exception 'forbidden';
  end if;

  v_locked_trip_id := v_source_trip_id;
  perform 1 from public.trips where id = v_locked_trip_id for update;

  -- 잠금 전 source/day 값은 식별용이다. 실제 mutation 상태를 다시 읽는다.
  select trip_day_id, trip_id, is_candidate
    into v_source_day_id, v_source_trip_id, v_is_candidate
    from public.schedule_items where id = p_item_id;
  if v_source_trip_id is null then raise exception 'schedule_item_not_found'; end if;
  if v_source_trip_id != v_locked_trip_id then raise exception 'schedule_item_changed'; end if;
  if v_is_candidate then raise exception 'candidate_not_movable_here'; end if;

  select trip_id into v_target_trip_id from public.trip_days where id = p_target_day_id;
  if v_target_trip_id is null then raise exception 'target_day_not_found'; end if;
  if v_target_trip_id != v_locked_trip_id then raise exception 'cannot_move_across_trips'; end if;

  if v_source_day_id = p_target_day_id then
    raise exception 'use_reorder_for_same_day';
  end if;

  select count(*) into v_target_count
    from public.schedule_items
    where trip_day_id = p_target_day_id and is_candidate = false;
  if p_target_position < 1 or p_target_position > v_target_count + 1 then
    raise exception 'invalid_target_position';
  end if;

  update public.schedule_items
    set trip_day_id = p_target_day_id,
        sort_order = 0,
        updated_at = now()
    where id = p_item_id;

  -- source 본 파티션 재번호
  update public.schedule_items si
    set sort_order = rn.ord, updated_at = now()
  from (
    select id, row_number() over (order by sort_order) as ord
    from public.schedule_items
    where trip_day_id = v_source_day_id and is_candidate = false
  ) rn
  where si.id = rn.id;

  -- target 본 파티션 재번호 (삽입 위치 반영)
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
    where trip_day_id = p_target_day_id and is_candidate = false
  ) rn
  where si.id = rn.id;
end $$;

create or replace function public.move_schedule_items_to_day(
  p_item_ids      uuid[],
  p_target_day_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_target_trip  uuid;
  v_locked_trip  uuid;
  v_item_count   int;
  v_unique_count int;
  v_current_max  int;
  v_day_id       uuid;
  v_source_days  uuid[];
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  if p_item_ids is null or array_length(p_item_ids, 1) is null then
    raise exception 'empty_item_ids';
  end if;

  select count(distinct t.id) into v_unique_count from unnest(p_item_ids) as t(id);
  if v_unique_count != array_length(p_item_ids, 1) then
    raise exception 'duplicate_item_ids';
  end if;

  select trip_id into v_target_trip
    from public.trip_days
    where id = p_target_day_id;
  if v_target_trip is null then raise exception 'target_day_not_found'; end if;
  if not public.can_access_trip(v_target_trip) then raise exception 'forbidden'; end if;

  v_locked_trip := v_target_trip;
  perform 1 from public.trips where id = v_locked_trip for update;

  select trip_id into v_target_trip
    from public.trip_days
    where id = p_target_day_id;
  if v_target_trip is null then raise exception 'target_day_not_found'; end if;
  if v_target_trip != v_locked_trip then raise exception 'target_day_changed'; end if;

  select count(*) into v_item_count
    from public.schedule_items
    where id = any(p_item_ids);
  if v_item_count != array_length(p_item_ids, 1) then
    raise exception 'schedule_item_not_found';
  end if;

  -- 본 일정 전용: 후보 포함 시 에러
  if exists (
    select 1 from public.schedule_items
    where id = any(p_item_ids) and is_candidate
  ) then
    raise exception 'candidate_not_movable_here';
  end if;

  if exists (
    select 1 from public.schedule_items si
    where si.id = any(p_item_ids) and si.trip_id != v_target_trip
  ) then
    raise exception 'mixed_trip_items';
  end if;

  if exists (
    select 1 from public.schedule_items
    where id = any(p_item_ids) and trip_day_id = p_target_day_id
  ) then
    raise exception 'target_day_contains_selected_items';
  end if;

  select array_agg(distinct trip_day_id) into v_source_days
    from public.schedule_items
    where id = any(p_item_ids);

  select coalesce(max(sort_order), 0) into v_current_max
    from public.schedule_items
    where trip_day_id = p_target_day_id and is_candidate = false;

  update public.schedule_items si
    set trip_day_id = p_target_day_id,
        sort_order = v_current_max + input.ord::int
    from unnest(p_item_ids) with ordinality as input(id, ord)
    where si.id = input.id;

  for v_day_id in
    select distinct d
    from unnest(coalesce(v_source_days, '{}'::uuid[]) || array[p_target_day_id]) as x(d)
  loop
    update public.schedule_items si
      set sort_order = ranked.rn
      from (
        select id, row_number() over (order by sort_order, created_at, id)::int as rn
        from public.schedule_items
        where trip_day_id = v_day_id and is_candidate = false
      ) ranked
      where si.id = ranked.id;
  end loop;
end $$;
```

- [ ] **Step 10: 신규 `set_schedule_item_candidacy` — "대상 파티션으로 이동" 단일 RPC**

```sql
-- 승격(후보→본)·강등(본→후보)·후보 일자 이동·풀 이동을 모두 담당.
-- 규칙: p_is_candidate=false 면 p_target_day_id 필수 (본 일정은 day 필수).
--       p_is_candidate=true + day null → 풀. 이미 대상 파티션이면 no-op(멱등).
create or replace function public.set_schedule_item_candidacy(
  p_item_id       uuid,
  p_is_candidate  boolean,
  p_target_day_id uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_trip_id     uuid;
  v_locked_trip uuid;
  v_src_day     uuid;
  v_src_cand    boolean;
  v_target_trip uuid;
  v_next_order  int;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;

  select trip_id, trip_day_id, is_candidate
    into v_trip_id, v_src_day, v_src_cand
    from public.schedule_items where id = p_item_id;
  if v_trip_id is null then raise exception 'schedule_item_not_found'; end if;
  if not public.can_access_trip(v_trip_id) then raise exception 'forbidden'; end if;

  v_locked_trip := v_trip_id;
  perform 1 from public.trips where id = v_locked_trip for update;

  -- 잠금 대기 뒤 현재 파티션을 다시 읽는다.
  select trip_id, trip_day_id, is_candidate
    into v_trip_id, v_src_day, v_src_cand
    from public.schedule_items where id = p_item_id;
  if v_trip_id is null then raise exception 'schedule_item_not_found'; end if;
  if v_trip_id != v_locked_trip then raise exception 'schedule_item_changed'; end if;

  if not p_is_candidate and p_target_day_id is null then
    raise exception 'target_day_required';
  end if;

  if p_target_day_id is not null then
    select trip_id into v_target_trip
      from public.trip_days where id = p_target_day_id;
    if v_target_trip is null then raise exception 'target_day_not_found'; end if;
    if v_target_trip != v_trip_id then raise exception 'cannot_move_across_trips'; end if;
  end if;

  -- no-op: 이미 대상 파티션에 있음
  if v_src_cand = p_is_candidate and v_src_day is not distinct from p_target_day_id then
    return;
  end if;

  -- 대상 파티션 끝 번호
  if p_target_day_id is null then
    select coalesce(max(sort_order), 0) + 1 into v_next_order
      from public.schedule_items
      where trip_id = v_trip_id and trip_day_id is null;
  else
    select coalesce(max(sort_order), 0) + 1 into v_next_order
      from public.schedule_items
      where trip_day_id = p_target_day_id and is_candidate = p_is_candidate;
  end if;

  update public.schedule_items
    set trip_day_id = p_target_day_id,
        is_candidate = p_is_candidate,
        sort_order = v_next_order,
        updated_at = now()
    where id = p_item_id;

  -- 원 파티션 재압축
  if v_src_day is null then
    update public.schedule_items si
      set sort_order = rn.ord, updated_at = now()
    from (
      select id, row_number() over (order by sort_order) as ord
      from public.schedule_items
      where trip_id = v_trip_id and trip_day_id is null
    ) rn
    where si.id = rn.id and si.sort_order != rn.ord;
  else
    update public.schedule_items si
      set sort_order = rn.ord, updated_at = now()
    from (
      select id, row_number() over (order by sort_order) as ord
      from public.schedule_items
      where trip_day_id = v_src_day and is_candidate = v_src_cand
    ) rn
    where si.id = rn.id and si.sort_order != rn.ord;
  end if;
end $$;

revoke all on function public.set_schedule_item_candidacy(uuid, boolean, uuid) from public;
grant execute on function public.set_schedule_item_candidacy(uuid, boolean, uuid) to authenticated;
```

- [ ] **Step 11: `resize_trip_days` 교체 (축소 시 일자 후보 → 풀)**

0006의 함수 전체를 재작성하되, 축소 분기만 바뀐다 (확장 분기·day date 갱신은 그대로):

```sql
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
  v_pool_max         int;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  if p_new_start > p_new_end then raise exception 'invalid_date_range'; end if;

  select created_by into v_owner from public.trips where id = p_trip_id;
  if v_owner is null or v_owner != v_uid then
    raise exception 'trip_not_found_or_forbidden';
  end if;

  -- 이 UPDATE가 trips 행 잠금을 획득한다 — 다른 sort_order RPC들의
  -- `for update` 잠금과 같은 잠금이므로 day 삭제·이동이 그들과 직렬화된다.
  update public.trips
    set start_date = p_new_start, end_date = p_new_end
    where id = p_trip_id;

  v_new_day_count := (p_new_end - p_new_start) + 1;
  select count(*) into v_old_day_count from public.trip_days where trip_id = p_trip_id;

  update public.trip_days td
    set date = p_new_start + (day_number - 1)
  where td.trip_id = p_trip_id
    and day_number <= least(v_old_day_count, v_new_day_count);

  if v_new_day_count > v_old_day_count then
    insert into public.trip_days(trip_id, day_number, date)
    select p_trip_id,
           v_old_day_count + gs,
           p_new_start + (v_old_day_count + gs - 1)
    from generate_series(1, v_new_day_count - v_old_day_count) as gs;

  elsif v_new_day_count < v_old_day_count then
    select id into v_last_kept_day_id
      from public.trip_days
      where trip_id = p_trip_id and day_number = v_new_day_count;

    -- (1) 삭제 대상 day 의 "일자 후보" → 풀 후보로 이동
    select coalesce(max(sort_order), 0) into v_pool_max
      from public.schedule_items
      where trip_id = p_trip_id and trip_day_id is null;

    update public.schedule_items si
      set trip_day_id = null,
          sort_order = v_pool_max
            + (td.day_number - v_new_day_count) * 10000
            + si.sort_order,
          updated_at = now()
      from public.trip_days td
      where td.id = si.trip_day_id
        and td.trip_id = p_trip_id
        and td.day_number > v_new_day_count
        and si.is_candidate;

    -- 풀 재번호
    update public.schedule_items si
      set sort_order = rn.ord, updated_at = now()
    from (
      select id, row_number() over (order by sort_order) as ord
      from public.schedule_items
      where trip_id = p_trip_id and trip_day_id is null
    ) rn
    where si.id = rn.id and si.sort_order != rn.ord;

    -- (2) 삭제 대상 day 의 "본 일정" → 마지막 유지일 본 파티션 끝으로 (현행 유지)
    select coalesce(max(sort_order), 0) into v_max_sort
      from public.schedule_items
      where trip_day_id = v_last_kept_day_id and is_candidate = false;

    update public.schedule_items si
      set trip_day_id = v_last_kept_day_id,
          sort_order = v_max_sort
            + (td.day_number - v_new_day_count) * 10000
            + si.sort_order,
          updated_at = now()
      from public.trip_days td
      where td.id = si.trip_day_id
        and td.trip_id = p_trip_id
        and td.day_number > v_new_day_count
        and si.is_candidate = false;

    -- 마지막 유지일 본 파티션 재번호 (후보 파티션은 건드리지 않음)
    update public.schedule_items si
      set sort_order = rn.ord, updated_at = now()
    from (
      select id, row_number() over (order by sort_order) as ord
      from public.schedule_items
      where trip_day_id = v_last_kept_day_id and is_candidate = false
    ) rn
    where si.id = rn.id and si.sort_order != rn.ord;

    delete from public.trip_days
      where trip_id = p_trip_id and day_number > v_new_day_count;
  end if;
end $$;
```

- [ ] **Step 12: `get_guest_trip_data` 교체 (후보 제외 필터)**

0020의 함수 전체를 그대로 재작성하되 items 서브쿼리 where 절만 바꾼다. 유일한 변경점:

```sql
            ) from public.schedule_items si
              where si.trip_day_id = td.id and si.is_candidate = false
```

(0020의 `where si.trip_day_id = td.id` → `and si.is_candidate = false` 추가. trip/share/expenses/todos/records/return 블록은 0020과 글자 단위로 동일하게 복사. 파일 끝에 ROLLBACK 주석 블록 추가: `-- drop function if exists public.set_schedule_item_candidacy(uuid, boolean, uuid);` 등.)

- [ ] **Step 13: Commit**

```bash
git add supabase/migrations/0023_candidate_items.sql
git commit --no-verify -m "feat(db): candidate items schema + partition-aware RPCs + cafe category"
```

---

### Task 2: 마이그레이션 검증·적용 + 타입 재생성

**Files:**
- Modify: `types/database.ts` (자동 생성)

**DB 대상 주의:** 이 저장소의 통합 테스트(`vitest.integration.config.ts`)와 E2E(dev 서버)는 모두
`.env.local`의 `NEXT_PUBLIC_SUPABASE_URL` — 즉 **linked 원격 DB** — 를 사용한다. 로컬 스택으로
우회하는 배선은 없다. 따라서 로컬 reset은 **SQL 검증용**이고, Task 3 이후의 테스트가 성립하려면
이 Task에서 원격 push까지 완료해야 한다. 0023은 배포 중인 V1과 하위 호환으로 설계됐으므로
(신규 파라미터 default, FK 교체, 게스트 RPC 시그니처 동일) 클라이언트 배포 전 원격 적용이 안전하다.

- [ ] **Step 1: 로컬 Supabase에서 SQL 검증**

전제: Docker + 로컬 Supabase 스택 (`supabase start`). 스택이 없으면 이 검증 단계만 건너뛰고
Step 2의 dry-run을 유일한 사전 점검으로 삼는다.

Run: `supabase db reset --local`
Expected: 로컬 DB가 0001~0023을 처음부터 적용하고 seed까지 성공. 실패하면 SQL을 고친 뒤 재실행 — **원격 push 전에 여기서 전부 잡는다.**

- [ ] **Step 2: linked 원격에 적용**

Run: `supabase db push --dry-run`
Expected: 적용 예정 목록에 `0023_candidate_items.sql`만 표시. 예상 밖 migration이 보이면 중단하고 원인 확인.

Run: `supabase db push`
Expected: `0023_candidate_items.sql` 적용 성공. 부분 적용으로 실패하면 `supabase migration repair` 후 재적용.

- [ ] **Step 3: 타입 재생성**

Run: `pnpm db:types`
Expected: `types/database.ts` 갱신 — `schedule_items.Row`에 `is_candidate: boolean`, `trip_id: string`, `trip_day_id: string | null`; Functions에 `set_schedule_item_candidacy` 추가. (`db:types`는 `--linked`라 Step 2의 push가 선행되어야 반영된다.)

- [ ] **Step 4: 타입 파급 확인**

Run: `pnpm exec tsc --noEmit` (또는 `pnpm lint`)
Expected: `trip_day_id`가 nullable이 되면서 `schedule-tab.tsx`(itemsByDay 그룹핑), `apply-local-*` 등에서 컴파일 에러가 날 수 있다. **여기서는 고치지 말고 에러 목록만 기록** — Task 7·10에서 파티션 로직과 함께 수정한다. 에러가 안 나면 그대로 진행.

추가로 `app/share/[token]/page.tsx`의 `MapPanel` 인자, `tests/unit/schedule-item-modal-stage.test.ts`의 신규 필드 누락이 오류 목록에 포함되는지 확인하고 각각 Task 5·7에서 해결한다.

- [ ] **Step 5: Commit**

```bash
git add types/database.ts
git commit --no-verify -m "chore(types): regenerate database types for candidate schema"
```

---

### Task 3: 통합 테스트 — 후보 RPC 파티션 동작

**Files:**
- Create: `tests/integration/candidate-items-rpc.test.ts`

기존 패턴(`tests/integration/create-schedule-item-with-category.test.ts`)을 따른다: admin 클라이언트로 유저 생성 → 유저 클라이언트로 `create_trip` → day id 조회 → RPC 호출 검증 → afterAll cleanup.

- [ ] **Step 1: 테스트 작성**

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
let userId = "";
let userC: SupabaseClient<Database>;
let tripId = "";
let day1Id = "";
let day2Id = "";

// Postgres 함수 인자에는 nullability 메타데이터가 없어 생성 타입이 null을 거부할 수 있다.
// 이 저장소의 기존 integration 테스트와 같은 RPC 경계 캐스트를 한 곳에 모은다.
function callRpc(name: string, args: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (userC as any).rpc(name, args);
}

async function sortOrders(filter: {
  dayId?: string | null;
  isCandidate: boolean;
}): Promise<Array<{ id: string; sort_order: number; title: string }>> {
  let q = userC
    .from("schedule_items")
    .select("id, sort_order, title")
    .eq("trip_id", tripId)
    .eq("is_candidate", filter.isCandidate)
    .order("sort_order");
  q = filter.dayId === null ? q.is("trip_day_id", null) : q.eq("trip_day_id", filter.dayId!);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

beforeAll(async () => {
  const u = await admin.auth.admin.createUser({
    email: `cand+${STAMP}@test.local`,
    password: PWD,
    email_confirm: true,
  });
  if (u.error) throw u.error;
  userId = u.data.user!.id;
  userC = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  await userC.auth.signInWithPassword({ email: `cand+${STAMP}@test.local`, password: PWD });

  const { data: tid } = await callRpc("create_trip", {
    p_title: "CandT",
    p_destination: "Tokyo",
    p_start_date: "2026-09-01",
    p_end_date: "2026-09-03",
    p_is_domestic: false,
    p_currencies: [],
  });
  tripId = tid as string;
  const { data: ds } = await userC
    .from("trip_days")
    .select("id, day_number")
    .eq("trip_id", tripId)
    .order("day_number");
  day1Id = ds![0].id;
  day2Id = ds![1].id;
});

afterAll(async () => {
  await admin.from("trips").delete().eq("id", tripId);
  await admin.auth.admin.deleteUser(userId);
});

describe("candidate creation partitions (0023)", () => {
  it("main / day-candidate / pool 이 각각 독립 시퀀스로 번호를 가진다", async () => {
    // 본 2 + 일자 후보 2 + 풀 2
    for (const t of ["m1", "m2"]) {
      const { error } = await callRpc("create_schedule_item", {
        p_trip_day_id: day1Id,
        p_title: t,
      });
      expect(error).toBeNull();
    }
    for (const t of ["c1", "c2"]) {
      const { error } = await callRpc("create_schedule_item", {
        p_trip_day_id: day1Id,
        p_title: t,
        p_is_candidate: true,
      });
      expect(error).toBeNull();
    }
    for (const t of ["p1", "p2"]) {
      const { error } = await callRpc("create_schedule_item", {
        p_trip_day_id: null,
        p_title: t,
        p_is_candidate: true,
        p_trip_id: tripId,
      });
      expect(error).toBeNull();
    }
    expect((await sortOrders({ dayId: day1Id, isCandidate: false })).map((r) => r.sort_order))
      .toEqual([1, 2]);
    expect((await sortOrders({ dayId: day1Id, isCandidate: true })).map((r) => r.sort_order))
      .toEqual([1, 2]);
    expect((await sortOrders({ dayId: null, isCandidate: true })).map((r) => r.sort_order))
      .toEqual([1, 2]);
  });

  it("day 없이 is_candidate=false 는 에러", async () => {
    const { error } = await callRpc("create_schedule_item", {
      p_trip_day_id: null,
      p_title: "bad",
      p_is_candidate: false,
      p_trip_id: tripId,
    });
    expect(error?.message).toMatch(/dayless_must_be_candidate/);
  });

  it("day 없이 trip_id 도 없으면 에러", async () => {
    const { error } = await callRpc("create_schedule_item", {
      p_trip_day_id: null,
      p_title: "bad2",
      p_is_candidate: true,
    });
    expect(error?.message).toMatch(/trip_id_required/);
  });
});

describe("set_schedule_item_candidacy", () => {
  it("강등: 본 → 같은 일자 후보 끝, 원 파티션 재압축", async () => {
    const mains = await sortOrders({ dayId: day1Id, isCandidate: false });
    const demoted = mains[0]; // m1 (sort 1)
    const { error } = await callRpc("set_schedule_item_candidacy", {
      p_item_id: demoted.id,
      p_is_candidate: true,
      p_target_day_id: day1Id,
    });
    expect(error).toBeNull();
    // 본: m2 만 남고 1로 재압축
    const mainsAfter = await sortOrders({ dayId: day1Id, isCandidate: false });
    expect(mainsAfter.map((r) => [r.title, r.sort_order])).toEqual([["m2", 1]]);
    // 후보: c1,c2 뒤에 m1 이 3번으로
    const candsAfter = await sortOrders({ dayId: day1Id, isCandidate: true });
    expect(candsAfter.map((r) => [r.title, r.sort_order]))
      .toEqual([["c1", 1], ["c2", 2], ["m1", 3]]);
  });

  it("승격: 후보 → 다른 일자 본 일정 끝", async () => {
    const cands = await sortOrders({ dayId: day1Id, isCandidate: true });
    const promoted = cands[0]; // c1
    const { error } = await callRpc("set_schedule_item_candidacy", {
      p_item_id: promoted.id,
      p_is_candidate: false,
      p_target_day_id: day2Id,
    });
    expect(error).toBeNull();
    const day2Mains = await sortOrders({ dayId: day2Id, isCandidate: false });
    expect(day2Mains.map((r) => [r.title, r.sort_order])).toEqual([["c1", 1]]);
    // day1 후보 재압축: c2=1, m1=2
    const day1Cands = await sortOrders({ dayId: day1Id, isCandidate: true });
    expect(day1Cands.map((r) => [r.title, r.sort_order])).toEqual([["c2", 1], ["m1", 2]]);
  });

  it("풀 이동: 일자 후보 → 풀 끝", async () => {
    const day1Cands = await sortOrders({ dayId: day1Id, isCandidate: true });
    const toPool = day1Cands[0]; // c2
    const { error } = await callRpc("set_schedule_item_candidacy", {
      p_item_id: toPool.id,
      p_is_candidate: true,
      p_target_day_id: null,
    });
    expect(error).toBeNull();
    const pool = await sortOrders({ dayId: null, isCandidate: true });
    expect(pool.map((r) => [r.title, r.sort_order]))
      .toEqual([["p1", 1], ["p2", 2], ["c2", 3]]);
  });

  it("no-op: 이미 대상 파티션이면 에러 없이 순서 유지 (멱등)", async () => {
    const pool = await sortOrders({ dayId: null, isCandidate: true });
    const { error } = await callRpc("set_schedule_item_candidacy", {
      p_item_id: pool[0].id,
      p_is_candidate: true,
      p_target_day_id: null,
    });
    expect(error).toBeNull();
    expect(await sortOrders({ dayId: null, isCandidate: true })).toEqual(pool);
  });

  it("승격에 target day 누락 시 에러", async () => {
    const pool = await sortOrders({ dayId: null, isCandidate: true });
    const { error } = await callRpc("set_schedule_item_candidacy", {
      p_item_id: pool[0].id,
      p_is_candidate: false,
    });
    expect(error?.message).toMatch(/target_day_required/);
  });
});

describe("partition-aware reorder / move / delete", () => {
  it("reorder: 본·후보 혼합 입력은 에러", async () => {
    const mains = await sortOrders({ dayId: day1Id, isCandidate: false });
    const cands = await sortOrders({ dayId: day1Id, isCandidate: true });
    expect(mains.length).toBeGreaterThan(0);
    expect(cands.length).toBeGreaterThan(0);
    const { error } = await callRpc("reorder_schedule_items_in_day", {
      p_trip_day_id: day1Id,
      p_item_ids: [mains[0].id, cands[0].id],
    });
    expect(error?.message).toMatch(/mixed_partition_items|item_set_mismatch/);
  });

  it("reorder: 후보 파티션만 재정렬, 본 일정 순서는 영향 없음", async () => {
    // day1 후보를 2개로 만들고 역순 재정렬
    await callRpc("create_schedule_item", {
      p_trip_day_id: day1Id,
      p_title: "c3",
      p_is_candidate: true,
    });
    const cands = await sortOrders({ dayId: day1Id, isCandidate: true });
    const mainsBefore = await sortOrders({ dayId: day1Id, isCandidate: false });
    const reversed = [...cands].reverse().map((r) => r.id);
    const { error } = await callRpc("reorder_schedule_items_in_day", {
      p_trip_day_id: day1Id,
      p_item_ids: reversed,
    });
    expect(error).toBeNull();
    const candsAfter = await sortOrders({ dayId: day1Id, isCandidate: true });
    expect(candsAfter.map((r) => r.id)).toEqual(reversed);
    expect(await sortOrders({ dayId: day1Id, isCandidate: false })).toEqual(mainsBefore);
  });

  it("move RPC 는 후보 입력을 거부한다", async () => {
    const cands = await sortOrders({ dayId: day1Id, isCandidate: true });
    const { error: e1 } = await callRpc("move_schedule_item_across_days", {
      p_item_id: cands[0].id,
      p_target_day_id: day2Id,
      p_target_position: 1,
    });
    expect(e1?.message).toMatch(/candidate_not_movable_here/);
    const { error: e2 } = await callRpc("move_schedule_items_to_day", {
      p_item_ids: [cands[0].id],
      p_target_day_id: day2Id,
    });
    expect(e2?.message).toMatch(/candidate_not_movable_here/);
  });

  it("풀 후보 update / 단건 delete 가 동작한다", async () => {
    const pool = await sortOrders({ dayId: null, isCandidate: true });
    const target = pool[pool.length - 1];
    const { error: ue } = await callRpc("update_schedule_item", {
      p_item_id: target.id,
      p_title: "pool-updated",
      p_category_code: "cafe",
    });
    expect(ue).toBeNull();
    const { error: de } = await callRpc("delete_schedule_item", {
      p_item_id: target.id,
    });
    expect(de).toBeNull();
    const after = await sortOrders({ dayId: null, isCandidate: true });
    expect(after.map((r) => r.sort_order)).toEqual(after.map((_, i) => i + 1)); // gap 없음
  });

  it("bulk delete: 풀 후보 + 본 일정 섞어 삭제해도 각 파티션이 재압축된다", async () => {
    // 풀 1개 + day1 본 1개 추가 후 함께 삭제
    const { data: poolId } = await callRpc("create_schedule_item", {
      p_trip_day_id: null,
      p_title: "bulk-pool",
      p_is_candidate: true,
      p_trip_id: tripId,
    });
    const { data: mainId } = await callRpc("create_schedule_item", {
      p_trip_day_id: day1Id,
      p_title: "bulk-main",
    });
    const { error } = await callRpc("delete_schedule_items", {
      p_item_ids: [poolId as string, mainId as string],
    });
    expect(error).toBeNull();
    const pool = await sortOrders({ dayId: null, isCandidate: true });
    const mains = await sortOrders({ dayId: day1Id, isCandidate: false });
    expect(pool.map((r) => r.sort_order)).toEqual(pool.map((_, i) => i + 1));
    expect(mains.map((r) => r.sort_order)).toEqual(mains.map((_, i) => i + 1));
  });

  it("cafe 카테고리 FK insert 가 성공한다", async () => {
    const { data: id, error } = await callRpc("create_schedule_item", {
      p_trip_day_id: day1Id,
      p_title: "커피",
      p_category_code: "cafe",
    });
    expect(error).toBeNull();
    const { data: row } = await userC
      .from("schedule_items")
      .select("category_code")
      .eq("id", id as string)
      .single();
    expect(row?.category_code).toBe("cafe");
  });

  it("숙소 범위 생성은 trip_id를 저장하고 후보와 독립된 본 일정 번호를 쓴다", async () => {
    await callRpc("create_schedule_item", {
      p_trip_day_id: day1Id,
      p_title: "candidate-before-lodging",
      p_is_candidate: true,
    });
    const { data: ids, error } = await callRpc("create_lodging_schedule_items_for_range", {
      p_trip_id: tripId,
      p_start_day_id: day1Id,
      p_end_day_id: day2Id,
      p_title: "range-lodging",
    });
    expect(error).toBeNull();
    expect(ids).toHaveLength(2);

    const { data: rows, error: rowsError } = await userC
      .from("schedule_items")
      .select("trip_id, trip_day_id, is_candidate, sort_order")
      .in("id", ids ?? []);
    expect(rowsError).toBeNull();
    expect(rows?.every((r) => r.trip_id === tripId && !r.is_candidate)).toBe(true);

    const day1Main = await sortOrders({ dayId: day1Id, isCandidate: false });
    expect(day1Main.map((r) => r.sort_order)).toEqual(day1Main.map((_, i) => i + 1));
  });

  it("같은 파티션 동시 생성 후 sort_order가 유일하고 연속이다", async () => {
    const before = await sortOrders({ dayId: day2Id, isCandidate: true });
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        callRpc("create_schedule_item", {
          p_trip_day_id: day2Id,
          p_title: `concurrent-${i}`,
          p_is_candidate: true,
        }),
      ),
    );
    expect(results.every((r) => r.error === null)).toBe(true);

    const after = await sortOrders({ dayId: day2Id, isCandidate: true });
    expect(after).toHaveLength(before.length + 5);
    expect(after.map((r) => r.sort_order)).toEqual(after.map((_, i) => i + 1));
  });
});
```

- [ ] **Step 2: 실행 → 통과 확인**

Run: `pnpm test:integration -- candidate-items-rpc`
Expected: PASS 전건. 실패 시 마이그레이션 SQL을 수정하고 `supabase db reset --local`로 로컬 검증 → 수정분을 반영하는 후속 migration(또는 0023이 아직 다른 곳에 공유되지 않았다면 `supabase migration repair` 후 재push)으로 원격에 재적용한 뒤 재실행한다.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/candidate-items-rpc.test.ts
git commit --no-verify -m "test(integration): candidate partition RPC coverage"
```

---

### Task 4: 통합 테스트 — RLS 교차 소유 차단 / resize→풀 / 게스트 제외

**Files:**
- Create: `tests/integration/candidate-security-and-edges.test.ts`

- [ ] **Step 1: 테스트 작성**

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

function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
}

let aliceId = "", malloryId = "";
let alice: SupabaseClient<Database>, mallory: SupabaseClient<Database>;
let aliceTripId = "", aliceDay1Id = "";
let malloryTripId = "";

beforeAll(async () => {
  for (const [name, setId, setClient] of [
    ["alice", (v: string) => (aliceId = v), (c: SupabaseClient<Database>) => (alice = c)],
    ["mallory", (v: string) => (malloryId = v), (c: SupabaseClient<Database>) => (mallory = c)],
  ] as const) {
    const email = `cand_${name}+${STAMP}@test.local`;
    const u = await admin.auth.admin.createUser({ email, password: PWD, email_confirm: true });
    if (u.error) throw u.error;
    setId(u.data.user!.id);
    const c = anonClient();
    await c.auth.signInWithPassword({ email, password: PWD });
    setClient(c);
  }

  const { data: at } = await alice.rpc("create_trip", {
    p_title: "AliceT", p_destination: "Jeju",
    p_start_date: "2026-09-01", p_end_date: "2026-09-04",
    p_is_domestic: true, p_currencies: [],
  });
  aliceTripId = at as string;
  const { data: ad } = await alice
    .from("trip_days").select("id").eq("trip_id", aliceTripId).eq("day_number", 1).single();
  aliceDay1Id = ad!.id;

  const { data: mt } = await mallory.rpc("create_trip", {
    p_title: "MalT", p_destination: "Busan",
    p_start_date: "2026-09-01", p_end_date: "2026-09-02",
    p_is_domestic: true, p_currencies: [],
  });
  malloryTripId = mt as string;
});

afterAll(async () => {
  await admin.from("trips").delete().eq("id", aliceTripId);
  await admin.from("trips").delete().eq("id", malloryTripId);
  await admin.auth.admin.deleteUser(aliceId);
  await admin.auth.admin.deleteUser(malloryId);
});

describe("RLS: trip_id 위조 삽입 차단", () => {
  it("남의 trip_day_id + 내 trip_id 직접 insert 는 거부된다", async () => {
    const { error } = await mallory.from("schedule_items").insert({
      trip_day_id: aliceDay1Id,   // 남(alice)의 day
      trip_id: malloryTripId,     // 자기 trip — OR 정책이면 뚫리는 조합
      title: "forged",
      sort_order: 999,
      is_candidate: false,
    });
    expect(error).not.toBeNull(); // RLS 또는 복합 FK 위반 — 어느 쪽이든 거부
  });

  it("남의 trip_id 로 풀 후보 직접 insert 도 거부된다", async () => {
    const { error } = await mallory.from("schedule_items").insert({
      trip_day_id: null,
      trip_id: aliceTripId,
      title: "forged-pool",
      sort_order: 999,
      is_candidate: true,
    });
    expect(error).not.toBeNull();
  });
});

describe("resize 축소: 일자 후보 → 풀", () => {
  it("삭제되는 날의 후보는 풀로, 본 일정은 마지막 유지일로 간다", async () => {
    const { data: days } = await alice
      .from("trip_days").select("id, day_number")
      .eq("trip_id", aliceTripId).order("day_number");
    const day4 = days![3].id;
    await alice.rpc("create_schedule_item", { p_trip_day_id: day4, p_title: "d4-main" });
    await alice.rpc("create_schedule_item", {
      p_trip_day_id: day4, p_title: "d4-cand", p_is_candidate: true,
    });

    const { error } = await alice.rpc("resize_trip_days", {
      p_trip_id: aliceTripId,
      p_new_start: "2026-09-01",
      p_new_end: "2026-09-03", // 4일 → 3일
    });
    expect(error).toBeNull();

    const { data: pool } = await alice
      .from("schedule_items").select("title, sort_order, is_candidate")
      .eq("trip_id", aliceTripId).is("trip_day_id", null).order("sort_order");
    expect(pool!.map((r) => r.title)).toContain("d4-cand");
    expect(pool!.every((r) => r.is_candidate)).toBe(true);
    expect(pool!.map((r) => r.sort_order)).toEqual(pool!.map((_, i) => i + 1));

    const day3 = days![2].id;
    const { data: kept } = await alice
      .from("schedule_items").select("title")
      .eq("trip_day_id", day3).eq("is_candidate", false);
    expect(kept!.map((r) => r.title)).toContain("d4-main");
  });
});

describe("게스트 공유: 후보 제외", () => {
  it("get_guest_trip_data 는 후보를 반환하지 않는다", async () => {
    await alice.rpc("create_schedule_item", {
      p_trip_day_id: aliceDay1Id, p_title: "guest-visible",
    });
    await alice.rpc("create_schedule_item", {
      p_trip_day_id: aliceDay1Id, p_title: "guest-hidden-cand", p_is_candidate: true,
    });
    const { data: share, error: shareError } = await alice
      .from("guest_shares")
      .insert({
        trip_id: aliceTripId,
        show_schedule: true,
        show_expenses: false,
        show_todos: false,
        show_records: false,
      })
      .select("token")
      .single();
    expect(shareError).toBeNull();
    const token = share!.token;
    const guest = anonClient();
    const { data } = await guest.rpc("get_guest_trip_data", { p_token: token });
    const json = JSON.stringify(data);
    expect(json).toContain("guest-visible");
    expect(json).not.toContain("guest-hidden-cand");
  });
});
```

`guest_shares` 생성은 RPC가 아니라 현재 앱과 동일한 테이블 INSERT 경로를 사용한다 (`lib/guest/use-create-guest-share.ts`).

- [ ] **Step 2: 실행 → 통과 확인**

Run: `pnpm test:integration -- candidate-security-and-edges`
Expected: PASS. RLS 테스트가 실패(= 삽입 성공)하면 0023의 정책이 OR 형태로 잘못 작성된 것 — 조건부 case 형태로 수정 후 재적용.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/candidate-security-and-edges.test.ts
git commit --no-verify -m "test(integration): candidate RLS forgery guard, resize-to-pool, guest exclusion"
```

---

### Task 5: 카페 카테고리 + 색 변경 (TS/UI 동기화 4곳)

**Files:**
- Modify: `tests/unit/schedule-category-mapping.test.ts`
- Modify: `tests/unit/schedule-expense-category-map.test.ts`
- Modify: `lib/types.ts:63-69`
- Modify: `app/globals.css` (`:root` 및 `@theme inline` 블록)
- Modify: `components/ui/schedule-item.tsx:7-31`
- Modify: `components/schedule/schedule-item-modal.tsx:44-69`
- Modify: `lib/schedule/category-map.ts`
- Modify: `lib/category/use-categories.ts` (CATEGORY_FALLBACK_LABEL)
- Modify: `app/share/[token]/page.tsx` (SCHEDULE_CATEGORIES에 cafe)
- Modify: `app/settings/categories/page.tsx` (7종 설명 + skeleton 개수)
- Modify: `tests/unit/use-categories.test.ts`
- Modify: `tests/unit/schedule-item-modal-stage.test.ts`
- Modify: `tests/integration/rls-categories.test.ts`
- Modify: `tests/e2e/settings-categories.spec.ts`

- [ ] **Step 1: 회귀 가드 테스트를 먼저 갱신 (실패 상태로 만든다)**

`tests/unit/schedule-category-mapping.test.ts`의 상수·검증을 7종으로 교체:

```typescript
const CATEGORY_CODES = [
  "transport",
  "sightseeing",
  "food",
  "cafe",
  "lodging",
  "shopping",
  "other",
] as const;

const EXPECTED_COLORS: Record<(typeof CATEGORY_CODES)[number], string> = {
  transport: "bg-ti-read",
  sightseeing: "bg-ti-grep",
  food: "bg-accent-brown",
  cafe: "bg-accent-rose",
  lodging: "bg-ti-edit",
  shopping: "bg-accent-yellow",
  other: "bg-ink-400",
};

const EXPECTED_LABELS: Record<(typeof CATEGORY_CODES)[number], string> = {
  transport: "교통",
  sightseeing: "관광",
  food: "식당",
  cafe: "카페",
  lodging: "숙소",
  shopping: "쇼핑",
  other: "기타",
};
```

`it("has exactly 6 categories")` → `it("has exactly 7 categories")` + `toHaveLength(7)`.

`tests/unit/schedule-expense-category-map.test.ts`에 케이스 추가:

```typescript
it("cafe 는 지출 카테고리 food 로 매핑된다", () => {
  expect(expenseCategoryForScheduleCategory("cafe")).toBe("food");
});
```

`tests/unit/use-categories.test.ts`의 정확한 fallback 객체에 `cafe: "카페"`를 food 다음에 추가한다.

`tests/unit/schedule-item-modal-stage.test.ts`:

```typescript
// mkItem 기본 Row에 타입 재생성으로 추가된 필드
trip_id: "trip-1",
is_candidate: false,

// place_search 전수 케이스에도 cafe 포함
for (const code of ["transport", "sightseeing", "food", "cafe", "lodging", "shopping"] as const) {
```

`tests/integration/rls-categories.test.ts`는 authenticated 결과를 7개로 바꾸고 code 순서에 `cafe`를 food 다음에 추가한다. `tests/e2e/settings-categories.spec.ts`도 테스트 이름을 "일정 7종 + 경비 6종"으로 바꾸고 일정 라벨 배열에 `"카페"`를 추가한다.

- [ ] **Step 2: 실패 확인**

Run: `pnpm test -- schedule-category-mapping schedule-expense-category-map`
Expected: FAIL — `cafe`가 ScheduleCategory에 없어 타입 에러이거나 매핑 누락.

- [ ] **Step 3: 구현**

`lib/types.ts` ScheduleCategory 유니온에 cafe 추가 (food 다음):

```typescript
export type ScheduleCategory =
  | "transport"
  | "sightseeing"
  | "food"
  | "cafe"
  | "lodging"
  | "shopping"
  | "other";
```

`app/globals.css` — `:root` 블록의 `--color-accent-gold` 아래에 추가:

```css
  --color-accent-brown: #a5673f;
  --color-accent-rose: #e08cab;
  --color-accent-yellow: #e0b64f;
```

`@theme inline` 블록의 `--color-accent-gold: var(--color-accent-gold);` 아래에도 동일 패턴으로 3줄 추가:

```css
  --color-accent-brown: var(--color-accent-brown);
  --color-accent-rose: var(--color-accent-rose);
  --color-accent-yellow: var(--color-accent-yellow);
```

`components/ui/schedule-item.tsx` — 로컬 ScheduleCategory 유니온에 `"cafe"` 추가(7-13행), 맵 교체:

```typescript
const categoryColor: Record<ScheduleCategory, string> = {
  transport: "bg-ti-read",
  sightseeing: "bg-ti-grep",
  food: "bg-accent-brown",
  cafe: "bg-accent-rose",
  lodging: "bg-ti-edit",
  shopping: "bg-accent-yellow",
  other: "bg-ink-400",
};

const categoryLabel: Record<ScheduleCategory, string> = {
  transport: "교통",
  sightseeing: "관광",
  food: "식당",
  cafe: "카페",
  lodging: "숙소",
  shopping: "쇼핑",
  other: "기타",
};
```

`components/schedule/schedule-item-modal.tsx` — 44-69행의 3개 상수를 갱신 (CATEGORY_CODES는 food 다음에 cafe; 픽커 grid는 `grid-cols-3` 유지 — 7개면 3+3+1로 렌더됨):

```typescript
const CATEGORY_CODES: ScheduleCategory[] = [
  "transport",
  "sightseeing",
  "food",
  "cafe",
  "lodging",
  "shopping",
  "other",
];

const CATEGORY_LABEL: Record<ScheduleCategory, string> = {
  transport: "교통",
  sightseeing: "관광",
  food: "식당",
  cafe: "카페",
  lodging: "숙소",
  shopping: "쇼핑",
  other: "기타",
};

const CATEGORY_COLOR: Record<ScheduleCategory, string> = {
  transport: "bg-ti-read",
  sightseeing: "bg-ti-grep",
  food: "bg-accent-brown",
  cafe: "bg-accent-rose",
  lodging: "bg-ti-edit",
  shopping: "bg-accent-yellow",
  other: "bg-ink-400",
};
```

(모달 stage 분기는 `code === "other" ? "other_form" : "place_search"` 이므로 cafe는 자동으로 장소검색 플로우 — 코드 변경 불필요.)

`lib/schedule/category-map.ts` — SCHEDULE_TO_EXPENSE_CATEGORY에 추가:

```typescript
  cafe: "food",
```

`lib/category/use-categories.ts` — CATEGORY_FALLBACK_LABEL에 추가:

```typescript
  cafe: "카페",
```

`app/share/[token]/page.tsx`의 `SCHEDULE_CATEGORIES`에도 `"cafe"`를 food 다음에 추가해 공개된 cafe 본 일정이 `other`로 강등되지 않게 한다.

`app/settings/categories/page.tsx`의 일정 카테고리 설명을 7종으로 고치고 `ScheduleSkeleton` 반복 횟수를 7로 변경한다.

- [ ] **Step 4: 통과 확인**

Run: `pnpm test -- schedule-category-mapping schedule-expense-category-map schedule-item-modal-stage use-categories`
Expected: PASS.

Run: `pnpm test:integration -- rls-categories`
Expected: PASS — authenticated 사용자가 정확히 7개를 정렬 순서대로 조회.

- [ ] **Step 5: Commit**

```bash
git add -- lib/types.ts app/globals.css components/ui/schedule-item.tsx components/schedule/schedule-item-modal.tsx lib/schedule/category-map.ts lib/category/use-categories.ts 'app/share/[token]/page.tsx' app/settings/categories/page.tsx tests/unit/schedule-category-mapping.test.ts tests/unit/schedule-expense-category-map.test.ts tests/unit/use-categories.test.ts tests/unit/schedule-item-modal-stage.test.ts tests/integration/rls-categories.test.ts tests/e2e/settings-categories.spec.ts
git commit --no-verify -m "feat(category): add cafe category, recolor food/shopping"
```

---

### Task 6: 마커 색 단일 소스 `lib/maps/marker-colors.ts`

**Files:**
- Create: `lib/maps/marker-colors.ts`
- Create: `tests/unit/marker-colors.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
import { describe, it, expect } from "vitest";
import { CATEGORY_MARKER_COLORS, markerColorsFor } from "@/lib/maps/marker-colors";

describe("marker colors", () => {
  it("7개 카테고리 전부에 fill 이 있다", () => {
    expect(Object.keys(CATEGORY_MARKER_COLORS)).toHaveLength(7);
  });

  it("밝은 배경은 dark 텍스트, 어두운 배경은 light 텍스트", () => {
    expect(CATEGORY_MARKER_COLORS.shopping.text).toBe("dark");   // #e0b64f
    expect(CATEGORY_MARKER_COLORS.cafe.text).toBe("dark");       // #e08cab
    expect(CATEGORY_MARKER_COLORS.transport.text).toBe("dark");  // #9fbbe0
    expect(CATEGORY_MARKER_COLORS.food.text).toBe("light");      // #a5673f
  });

  it("markerColorsFor 는 미지 카테고리를 other 로 폴백한다", () => {
    expect(markerColorsFor("nonexistent")).toEqual(markerColorsFor("other"));
    expect(markerColorsFor(null)).toEqual(markerColorsFor("other"));
  });

  it("markerColorsFor 는 hex 텍스트 컬러를 돌려준다", () => {
    expect(markerColorsFor("food")).toEqual({ fill: "#a5673f", textColor: "#f2f1ed" });
    expect(markerColorsFor("shopping")).toEqual({ fill: "#e0b64f", textColor: "#26251e" });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test -- marker-colors`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

```typescript
import type { ScheduleCategory } from "@/lib/types";

export type MarkerTextTone = "light" | "dark";

/**
 * 카테고리 → 지도 마커 색 단일 소스 (스펙 §6).
 * globals.css 토큰과 hex 를 일치시킬 것: brown/rose/yellow 는 0023 에서 신설.
 * text: 배경 명도 기반 — 밝은 배경은 dark(잉크), 어두운 배경은 light(크림).
 */
export const CATEGORY_MARKER_COLORS: Record<
  ScheduleCategory,
  { fill: string; text: MarkerTextTone }
> = {
  transport: { fill: "#9fbbe0", text: "dark" },
  sightseeing: { fill: "#9fc9a2", text: "dark" },
  food: { fill: "#a5673f", text: "light" },
  cafe: { fill: "#e08cab", text: "dark" },
  lodging: { fill: "#c0a8dd", text: "dark" },
  shopping: { fill: "#e0b64f", text: "dark" },
  other: { fill: "rgba(38,37,30,0.2)", text: "dark" },
};

const MARKER_TEXT_COLOR: Record<MarkerTextTone, string> = {
  light: "#f2f1ed", // cream
  dark: "#26251e", // ink-900
};

export function markerColorsFor(
  category: ScheduleCategory | string | null | undefined,
): { fill: string; textColor: string } {
  const entry =
    CATEGORY_MARKER_COLORS[(category ?? "other") as ScheduleCategory] ??
    CATEGORY_MARKER_COLORS.other;
  return { fill: entry.fill, textColor: MARKER_TEXT_COLOR[entry.text] };
}
```

- [ ] **Step 4: 통과 확인 + Commit**

Run: `pnpm test -- marker-colors`
Expected: PASS

```bash
git add lib/maps/marker-colors.ts tests/unit/marker-colors.test.ts
git commit --no-verify -m "feat(maps): category marker color source of truth"
```

---

### Task 7: MarkerSpec 확장 + provider 렌더러 + MapPanel

**Files:**
- Modify: `lib/maps/types.ts:19-24`
- Modify: `lib/maps/providers/naver-provider.ts:56-91`
- Modify: `lib/maps/providers/google-provider.ts:109-159`
- Modify: `components/schedule/map-panel.tsx`
- Modify: `app/share/[token]/page.tsx`

- [ ] **Step 1: MarkerSpec 확장**

`lib/maps/types.ts`:

```typescript
export type MarkerVariant = "main" | "candidate";

export interface MarkerSpec {
  lat: number;
  lng: number;
  label: string;
  /** 카테고리 fill (marker-colors.ts) */
  color: string;
  /** main 배지의 숫자색 — 밝은 배경이면 잉크색 */
  textColor: string;
  variant: MarkerVariant;
  onClick?: () => void;
}
```

- [ ] **Step 2: Naver 렌더러**

`naver-provider.ts`의 `renderMarkerHtml`을 spec 기반으로 교체하고 호출부를 맞춘다:

```typescript
function renderMarkerHtml(spec: MarkerSpec): string {
  // 22×22 원형 배지. main: 카테고리색 채움 + 흰 테두리 / candidate: 크림 바탕 + 카테고리색 점선.
  const base =
    "width:22px;height:22px;border-radius:50%;display:flex;align-items:center;" +
    "justify-content:center;font-weight:600;font-size:11px;" +
    "font-variant-numeric:tabular-nums;box-shadow:0 2px 6px rgba(38,37,30,0.18)";
  if (spec.variant === "candidate") {
    return `<div style="background:#f2f1ed;color:${spec.color};border:2px dashed ${spec.color};${base}">${spec.label}</div>`;
  }
  return `<div style="background:${spec.color};color:${spec.textColor};border:2px solid #fff;${base}">${spec.label}</div>`;
}
```

`addMarkers`의 `icon: { content: renderMarkerHtml(spec.label) }` → `icon: { content: renderMarkerHtml(spec) }`.

- [ ] **Step 3: Google 렌더러**

`google-provider.ts`의 `renderPinElement`를 동일 규칙으로 교체:

```typescript
function renderPinElement(spec: MarkerSpec): HTMLElement {
  const el = document.createElement("div");
  const base = [
    "width:22px",
    "height:22px",
    "border-radius:50%",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "font-weight:600",
    "font-size:11px",
    "cursor:pointer",
    "font-variant-numeric:tabular-nums",
    "box-shadow:0 2px 6px rgba(38,37,30,0.18)",
  ];
  if (spec.variant === "candidate") {
    base.push("background:#f2f1ed", `color:${spec.color}`, `border:2px dashed ${spec.color}`);
  } else {
    base.push(`background:${spec.color}`, `color:${spec.textColor}`, "border:2px solid #fff");
  }
  el.style.cssText = base.join(";");
  el.textContent = spec.label;
  return el;
}
```

`addMarkers`의 `content: renderPinElement(spec.label)` → `content: renderPinElement(spec)`.

- [ ] **Step 4: MapPanel MapItem 확장**

`map-panel.tsx`:

```typescript
import { markerColorsFor } from "@/lib/maps/marker-colors";
import type { MapHandle, MarkerVariant } from "@/lib/maps/types";

type MapItem = {
  id: string;
  place_lat: number;
  place_lng: number;
  label: string;
  /** schedule_items.category_code */
  category: string;
  variant: MarkerVariant;
  /** 후보 탭에서 중복 번호의 소속을 명시적으로 알릴 문구 */
  contextLabel?: string;
};

type Props = {
  isDomestic: boolean;
  items: MapItem[];
  onMarkerClick?: (itemId: string, contextLabel?: string) => void;
  focusItemId?: string | null;
  className?: string;
};
```

`addMarkers` 매핑 교체:

```typescript
    handleRef.current.addMarkers(
      items.map((it) => {
        const { fill, textColor } = markerColorsFor(it.category);
        return {
          lat: it.place_lat,
          lng: it.place_lng,
          label: it.label,
          color: fill,
          textColor,
          variant: it.variant,
          onClick: onMarkerClick ? () => onMarkerClick(it.id, it.contextLabel) : undefined,
        };
      }),
    );
```

게스트 공유 페이지의 `mapItems`도 새 필수 필드를 제공한다:

```typescript
return {
  id: `${d.dayNumber}-${idx}`,
  place_lat: it.placeLat,
  place_lng: it.placeLng,
  label: String(idx + 1),
  category: it.categoryCode,
  variant: "main" as const,
};
```

해당 `.filter`의 type predicate에도 `category: string; variant: "main"`을 포함한다.

- [ ] **Step 5: 타입 체크**

Run: `pnpm exec tsc --noEmit`
Expected: `schedule-tab.tsx`의 mapItems가 category/variant 누락으로 에러 — Task 10에서 해결하므로 이 시점에는 schedule-tab 에러만 남아 있어야 한다. provider/map-panel/게스트 페이지 자체 에러는 여기서 해결.

- [ ] **Step 6: Commit**

```bash
git add -- lib/maps/types.ts lib/maps/providers/naver-provider.ts lib/maps/providers/google-provider.ts components/schedule/map-panel.tsx 'app/share/[token]/page.tsx'
git commit --no-verify -m "feat(maps): category-colored main/candidate marker rendering"
```

---

### Task 8: 데이터 훅 — 조회 경로 + 생성 + 승격/강등

**Files:**
- Modify: `lib/schedule/use-schedule-list.ts`
- Modify: `lib/schedule/use-create-schedule-item.ts`
- Create: `lib/schedule/use-set-schedule-item-candidacy.ts`

- [ ] **Step 1: `use-schedule-list.ts` — inner join 제거, trip_id 직접 필터**

queryFn 교체 (풀 후보는 join 으로는 영원히 조회 불가 — 스펙 §7 클라이언트 변경):

```typescript
    queryFn: async (): Promise<ScheduleItem[]> => {
      if (!tripId) return [];
      const { data, error } = await supabase
        .from("schedule_items")
        .select("*")
        .eq("trip_id", tripId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
```

- [ ] **Step 2: `use-create-schedule-item.ts` — 후보 파라미터 전달**

Input 타입과 rpc 호출 갱신:

```typescript
export type CreateScheduleItemInput = {
  tripId: string;
  /** null 이면 전체 풀 후보 (isCandidate 필수 true) */
  tripDayId: string | null;
  isCandidate?: boolean;
  title: string;
  categoryCode: ScheduleCategory;
  timeOfDay?: string | null;
  placeName?: string | null;
  placeAddress?: string | null;
  placeLat?: number | null;
  placeLng?: number | null;
  placeProvider?: "naver" | "google" | null;
  placeExternalId?: string | null;
  placeExternalUrl?: string | null;
  memo?: string | null;
  url?: string | null;
};
```

rpc 인자에 추가:

```typescript
        p_is_candidate: input.isCandidate ?? false,
        p_trip_id: input.tripId,
```

- [ ] **Step 3: 신규 훅 `use-set-schedule-item-candidacy.ts`**

```typescript
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export type SetCandidacyInput = {
  tripId: string; // invalidate 키 용도
  itemId: string;
  isCandidate: boolean;
  /** null = 전체 풀 (isCandidate=true 일 때만 유효) */
  targetDayId: string | null;
};

/** 승격·강등·후보 이동 겸용 — set_schedule_item_candidacy RPC (스펙 §4). */
export function useSetScheduleItemCandidacy() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SetCandidacyInput): Promise<void> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("set_schedule_item_candidacy", {
        p_item_id: input.itemId,
        p_is_candidate: input.isCandidate,
        p_target_day_id: input.targetDayId,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.schedule.byTripId(vars.tripId) });
    },
  });
}
```

- [ ] **Step 4: 타입 체크 + Commit**

Run: `pnpm exec tsc --noEmit` — 이 3개 파일에서 에러가 없어야 한다 (schedule-tab 잔여 에러는 Task 10에서).

```bash
git add lib/schedule/use-schedule-list.ts lib/schedule/use-create-schedule-item.ts lib/schedule/use-set-schedule-item-candidacy.ts
git commit --no-verify -m "feat(schedule): candidate-aware fetch/create hooks + candidacy hook"
```

---

### Task 9: 낙관적 업데이트 헬퍼 파티션 인식 (TDD)

**Files:**
- Modify: `tests/unit/apply-local-reorder.test.ts`, `apply-local-move.test.ts`, `apply-local-bulk-move.test.ts`
- Modify: `lib/schedule/apply-local-reorder.ts`, `apply-local-move.ts`, `apply-local-bulk-move.ts`

- [ ] **Step 1: 테스트 픽스처에 신규 필드 추가 + 파티션 케이스 작성**

기존 테스트의 ScheduleItem 픽스처 생성부에 `trip_id: "trip-1", is_candidate: false` 필드를 추가한다 (타입 재생성으로 필수 필드가 됨). 그리고 각 파일에 파티션 케이스를 추가:

`apply-local-reorder.test.ts`:

```typescript
it("후보 파티션 재정렬은 같은 날 본 일정 sort_order 를 건드리지 않는다", () => {
  const items = [
    makeItem({ id: "m1", trip_day_id: "d1", sort_order: 1, is_candidate: false }),
    makeItem({ id: "m2", trip_day_id: "d1", sort_order: 2, is_candidate: false }),
    makeItem({ id: "c1", trip_day_id: "d1", sort_order: 1, is_candidate: true }),
    makeItem({ id: "c2", trip_day_id: "d1", sort_order: 2, is_candidate: true }),
  ];
  const next = applyLocalReorder(items, "d1", ["c2", "c1"]);
  const find = (id: string) => next.find((i) => i.id === id)!;
  expect(find("c2").sort_order).toBe(1);
  expect(find("c1").sort_order).toBe(2);
  expect(find("m1").sort_order).toBe(1);
  expect(find("m2").sort_order).toBe(2);
});
```

(`makeItem`은 각 테스트 파일의 기존 픽스처 헬퍼를 따른다 — 없으면 기존 인라인 객체 스타일에 두 필드를 추가.)

`apply-local-move.test.ts` / `apply-local-bulk-move.test.ts`:

```typescript
it("후보 아이템 이동 시도는 에러 (main 전용)", () => {
  const items = [
    makeItem({ id: "c1", trip_day_id: "d1", sort_order: 1, is_candidate: true }),
  ];
  expect(() => applyLocalMove(items, "c1", "d2", 1)).toThrow(/candidate/);
});

it("본 일정 이동은 후보 sort_order 에 영향을 주지 않는다", () => {
  const items = [
    makeItem({ id: "m1", trip_day_id: "d1", sort_order: 1, is_candidate: false }),
    makeItem({ id: "c1", trip_day_id: "d1", sort_order: 1, is_candidate: true }),
    makeItem({ id: "c9", trip_day_id: "d2", sort_order: 1, is_candidate: true }),
  ];
  const next = applyLocalMove(items, "m1", "d2", 1);
  const find = (id: string) => next.find((i) => i.id === id)!;
  expect(find("m1").trip_day_id).toBe("d2");
  expect(find("m1").sort_order).toBe(1);
  expect(find("c1").sort_order).toBe(1);
  expect(find("c9").sort_order).toBe(1);
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test -- apply-local`
Expected: FAIL (파티션 미인식으로 본·후보가 한 시퀀스로 압축됨 / 에러 미발생).

- [ ] **Step 3: 구현**

`apply-local-reorder.ts`:

```typescript
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";

export function applyLocalReorder(
  items: ScheduleItem[],
  tripDayId: string,
  orderedIds: string[],
): ScheduleItem[] {
  // 파티션 판정: orderedIds 가 가리키는 아이템들의 is_candidate (RPC 와 동일 규칙)
  const orderedSet = new Set(orderedIds);
  const sample = items.find((i) => orderedSet.has(i.id));
  const isCandidate = sample?.is_candidate ?? false;
  const inPartition = items.filter(
    (i) => i.trip_day_id === tripDayId && i.is_candidate === isCandidate,
  );
  const currentIds = new Set(inPartition.map((i) => i.id));
  const nextIds = new Set(orderedIds);
  if (currentIds.size !== nextIds.size || orderedIds.length !== nextIds.size) {
    throw new Error("applyLocalReorder: set mismatch");
  }
  for (const id of orderedIds) {
    if (!currentIds.has(id)) throw new Error("applyLocalReorder: set mismatch");
  }

  const byId = new Map(inPartition.map((i) => [i.id, i]));
  const reordered = new Map<string, ScheduleItem>();
  orderedIds.forEach((id, idx) => {
    const src = byId.get(id)!;
    reordered.set(id, { ...src, sort_order: idx + 1 });
  });

  return items.map((i) =>
    i.trip_day_id === tripDayId && i.is_candidate === isCandidate ? reordered.get(i.id)! : i,
  );
}
```

`apply-local-move.ts` — 본 전용 가드 + 파티션 필터:

```typescript
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";

export function applyLocalMove(
  items: ScheduleItem[],
  itemId: string,
  targetDayId: string,
  targetPosition: number, // 1-based, 1..targetCount+1
): ScheduleItem[] {
  const src = items.find((i) => i.id === itemId);
  if (!src) throw new Error("applyLocalMove: item not found");
  if (src.is_candidate) {
    throw new Error("applyLocalMove: candidate items use set_schedule_item_candidacy");
  }
  if (src.trip_day_id === targetDayId) {
    throw new Error("applyLocalMove: same day — use applyLocalReorder (use_reorder_for_same_day)");
  }

  const sourceDayId = src.trip_day_id;
  const inMain = (i: ScheduleItem, dayId: string | null) =>
    i.trip_day_id === dayId && !i.is_candidate;

  const targetExisting = items
    .filter((i) => inMain(i, targetDayId))
    .sort((a, b) => a.sort_order - b.sort_order);
  if (targetPosition < 1 || targetPosition > targetExisting.length + 1) {
    throw new Error(
      `applyLocalMove: invalid_target_position (got ${targetPosition}, max ${targetExisting.length + 1})`,
    );
  }

  const sourceRemaining = items
    .filter((i) => inMain(i, sourceDayId) && i.id !== itemId)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i, idx) => ({ ...i, sort_order: idx + 1 }));

  const movedItem: ScheduleItem = { ...src, trip_day_id: targetDayId, sort_order: targetPosition };
  const targetNext = [
    ...targetExisting.slice(0, targetPosition - 1),
    movedItem,
    ...targetExisting.slice(targetPosition - 1),
  ].map((i, idx) => ({ ...i, sort_order: idx + 1 }));

  const untouched = items.filter(
    (i) => i.is_candidate || (i.trip_day_id !== sourceDayId && i.trip_day_id !== targetDayId),
  );
  return [...untouched, ...sourceRemaining, ...targetNext];
}
```

`apply-local-bulk-move.ts` — 동일 원칙 (compact 는 본 파티션만, 후보는 untouched):

```typescript
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";

function compactMainDay(items: ScheduleItem[]): ScheduleItem[] {
  return [...items]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item, index) => ({ ...item, sort_order: index + 1 }));
}

export function applyLocalBulkMove(
  items: ScheduleItem[],
  itemIds: string[],
  targetDayId: string,
): ScheduleItem[] {
  if (itemIds.length === 0) {
    throw new Error("applyLocalBulkMove: empty item ids");
  }
  if (new Set(itemIds).size !== itemIds.length) {
    throw new Error("applyLocalBulkMove: duplicate item ids");
  }

  const byId = new Map(items.map((item) => [item.id, item]));
  const selected = itemIds.map((id) => {
    const item = byId.get(id);
    if (!item) throw new Error("applyLocalBulkMove: item not found");
    if (item.is_candidate) {
      throw new Error("applyLocalBulkMove: candidate items use set_schedule_item_candidacy");
    }
    if (item.trip_day_id === targetDayId) {
      throw new Error("applyLocalBulkMove: target day contains selected item");
    }
    return item;
  });

  const affectedDayIds = new Set(selected.map((item) => item.trip_day_id));
  affectedDayIds.add(targetDayId);
  const selectedIds = new Set(itemIds);
  const isMainOf = (i: ScheduleItem, dayId: string | null) =>
    i.trip_day_id === dayId && !i.is_candidate;

  const targetExisting = compactMainDay(items.filter((i) => isMainOf(i, targetDayId)));
  const moved = selected.map((item, index) => ({
    ...item,
    trip_day_id: targetDayId,
    sort_order: targetExisting.length + index + 1,
  }));

  const nextByDay = new Map<string | null, ScheduleItem[]>();
  for (const dayId of affectedDayIds) {
    if (dayId === targetDayId) {
      nextByDay.set(dayId, compactMainDay([...targetExisting, ...moved]));
      continue;
    }
    nextByDay.set(
      dayId,
      compactMainDay(items.filter((i) => isMainOf(i, dayId) && !selectedIds.has(i.id))),
    );
  }

  const untouched = items.filter(
    (item) => item.is_candidate || !affectedDayIds.has(item.trip_day_id),
  );
  return [...untouched, ...Array.from(nextByDay.values()).flat()];
}
```

- [ ] **Step 4: 통과 확인 + Commit**

Run: `pnpm test -- apply-local`
Expected: PASS (기존 케이스 + 신규 케이스 전건)

```bash
git add lib/schedule/apply-local-reorder.ts lib/schedule/apply-local-move.ts lib/schedule/apply-local-bulk-move.ts tests/unit/apply-local-reorder.test.ts tests/unit/apply-local-move.test.ts tests/unit/apply-local-bulk-move.test.ts
git commit --no-verify -m "feat(schedule): partition-aware optimistic helpers"
```

---

### Task 10: ScheduleTab 파티션 분리 + 지도 후보 토글

**Files:**
- Modify: `components/trip/schedule-tab.tsx`
- Modify: `components/trip/date-shrink-confirm.tsx`

이 Task 는 schedule-tab 의 **데이터 계층**만 바꾼다 (UI 컴포넌트 연결은 Task 11–13). 완료 시점에 `tsc --noEmit` 이 깨끗해야 한다.

- [ ] **Step 1: 파티션 memo 교체**

`itemsByDay` memo(142-149행)를 세 개로 분리:

```typescript
  // 본 일정만 day 별 그룹 (후보·풀 제외) — 기존 번호/이동 로직의 입력
  const itemsByDay = useMemo(() => {
    const grouped: Record<string, ScheduleItem[]> = {};
    for (const it of items) {
      if (!it.trip_day_id || it.is_candidate) continue;
      (grouped[it.trip_day_id] ??= []).push(it);
    }
    for (const k of Object.keys(grouped)) {
      grouped[k].sort((a, b) => a.sort_order - b.sort_order);
    }
    return grouped;
  }, [items]);

  const candidatesByDay = useMemo(() => {
    const grouped: Record<string, ScheduleItem[]> = {};
    for (const it of items) {
      if (!it.trip_day_id || !it.is_candidate) continue;
      (grouped[it.trip_day_id] ??= []).push(it);
    }
    for (const k of Object.keys(grouped)) {
      grouped[k].sort((a, b) => a.sort_order - b.sort_order);
    }
    return grouped;
  }, [items]);

  const poolItems = useMemo(
    () =>
      items
        .filter((it) => !it.trip_day_id && it.is_candidate)
        .sort((a, b) => a.sort_order - b.sort_order),
    [items],
  );
```

`activeDayItems`는 이름을 유지하되 본 파티션을 가리킨다 (아래에서 activeDayCandidates 추가):

```typescript
  const activeDayItems = useMemo(
    () => (activeDayId ? (itemsByDay[activeDayId] ?? []) : []),
    [activeDayId, itemsByDay],
  );
  const activeDayCandidates = useMemo(
    () => (activeDayId ? (candidatesByDay[activeDayId] ?? []) : []),
    [activeDayId, candidatesByDay],
  );
```

- [ ] **Step 2: 뷰 상태 + URL 파라미터**

상단 상태에 추가:

```typescript
  const [view, setView] = useState<"day" | "candidates">("day");
  const candidatesOnMap = params.get("candidates") === "1";
```

토글 함수 (`toggleMap` 아래):

```typescript
  function toggleCandidatesOnMap() {
    const next = new URLSearchParams(params.toString());
    if (candidatesOnMap) next.delete("candidates");
    else next.set("candidates", "1");
    router.push(`/trips/${tripId}?${next.toString()}`);
  }
```

- [ ] **Step 3: mapItems — 카테고리 색 + variant + 후보**

`mapItems` memo 교체:

```typescript
  const mapItems = useMemo(() => {
    type Entry = {
      it: ScheduleItem;
      label: string;
      variant: "main" | "candidate";
      contextLabel?: string;
    };
    const entries: Entry[] = [];
    if (view === "candidates") {
      // 후보 탭 지도: 풀 + 모든 일자 후보, 그룹별 1..N (스펙 §6)
      poolItems.forEach((it, idx) =>
        entries.push({
          it,
          label: String(idx + 1),
          variant: "candidate",
          contextLabel: `전체 풀 후보 ${idx + 1}`,
        }),
      );
      for (const d of days) {
        (candidatesByDay[d.id] ?? []).forEach((it, idx) =>
          entries.push({
            it,
            label: String(idx + 1),
            variant: "candidate",
            contextLabel: `Day ${d.day_number} 후보 ${idx + 1}`,
          }),
        );
      }
    } else {
      activeDayItems.forEach((it, idx) =>
        entries.push({ it, label: String(idx + 1), variant: "main" }),
      );
      if (candidatesOnMap) {
        activeDayCandidates.forEach((it, idx) =>
          entries.push({ it, label: String(idx + 1), variant: "candidate" }),
        );
      }
    }
    return entries
      .filter(({ it }) => it.place_lat != null && it.place_lng != null)
      .map(({ it, label, variant, contextLabel }) => ({
        id: it.id,
        place_lat: it.place_lat!,
        place_lng: it.place_lng!,
        label,
        category: it.category_code,
        variant,
        contextLabel,
      }));
  }, [view, activeDayItems, activeDayCandidates, candidatesOnMap, poolItems, candidatesByDay, days]);
```

기존 `handleMarkerClick`은 카드 스크롤과 함께 후보 소속을 명시적으로 알린다. `MapPanel`이 두 번째 인자로 넘기는 `contextLabel`을 사용하므로 헤더가 화면 밖이어도 번호 소속을 확인할 수 있다:

```typescript
  const handleMarkerClick = useCallback(
    (id: string, contextLabel?: string) => {
      if (contextLabel) showToast(contextLabel);
      const el = scheduleRefs.current[id];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [showToast],
  );
```

- [ ] **Step 4: DragEnd 파티션 가드**

`handleDragEnd`의 아이템 판별 뒤에 가드 추가, 후보 reorder 분기 추가:

```typescript
    if (!activeItem || !overItem) return;
    // 파티션 경계를 넘는 드래그는 무시 (전환은 메뉴 액션으로만 — 스펙 §7)
    if (activeItem.is_candidate !== overItem.is_candidate) return;

    if (activeItem.is_candidate) {
      // 일자 후보 파티션 내 재정렬만 허용
      if (!activeItem.trip_day_id || activeItem.trip_day_id !== overItem.trip_day_id) return;
      const dayList = (candidatesByDay[activeItem.trip_day_id] ?? []).map((i) => i.id);
      const fromIdx = dayList.indexOf(activeItem.id);
      const toIdx = dayList.indexOf(overItem.id);
      if (fromIdx === -1 || toIdx === -1) return;
      const nextOrder = [...dayList];
      nextOrder.splice(fromIdx, 1);
      nextOrder.splice(toIdx, 0, activeItem.id);
      reorder.mutate({ tripId, tripDayId: activeItem.trip_day_id, orderedIds: nextOrder });
      return;
    }
```

(기존 본 일정 분기는 그대로 — `activeItem.trip_day_id`가 이 시점엔 non-null임이 보장되므로 `activeItem.trip_day_id === overItem.trip_day_id` 비교와 `itemsByDay[activeItem.trip_day_id]` 인덱싱에 `!` 또는 조기 반환 가드를 추가해 nullable 타입 에러를 해소한다: `if (!activeItem.trip_day_id || !overItem.trip_day_id) return;` 를 candidate 분기 뒤에 삽입.)

- [ ] **Step 5: handleNumberTap — 후보 번호 탭 시 토글 자동 ON**

```typescript
  const handleNumberTap = useCallback(
    (item: ScheduleItem) => {
      if (item.place_lat == null || item.place_lng == null) {
        showToast("지도 좌표가 없는 일정이에요");
        return;
      }
      setFocusMapItemId(item.id);
      const next = new URLSearchParams(params.toString());
      let changed = false;
      if (!mapOpen) {
        next.set("map", "open");
        changed = true;
      }
      if (item.is_candidate && params.get("candidates") !== "1") {
        next.set("candidates", "1");
        changed = true;
      }
      if (changed) router.push(`/trips/${tripId}?${next.toString()}`);
    },
    [mapOpen, params, router, showToast, tripId],
  );
```

- [ ] **Step 6: 지도 위 "후보 보기" 토글 UI**

`mapPanel` 정의 교체 (Day 뷰에서만 토글 노출):

```typescript
  const mapPanel = trip ? (
    <div className="flex h-full flex-col">
      {view === "day" && (
        <label className="text-ink-700 mb-1 flex shrink-0 items-center gap-1.5 self-end text-[12px]">
          <input
            type="checkbox"
            checked={candidatesOnMap}
            onChange={toggleCandidatesOnMap}
            className="accent-ink-900 h-4 w-4"
          />
          후보 보기
        </label>
      )}
      <MapPanel
        isDomestic={trip.is_domestic}
        items={mapItems}
        onMarkerClick={handleMarkerClick}
        focusItemId={focusMapItemId}
        className="mt-0 min-h-0 flex-1"
      />
    </div>
  ) : null;
```

`components/trip/date-shrink-confirm.tsx`의 안내 문구도 실제 RPC 동작에 맞춘다:

```tsx
<p className="text-ink-700 text-[14px]">
  Day {fromDay}~{toDay}의 본 일정은 마지막 Day로, 후보는 전체 후보로 이동해요
</p>
```

- [ ] **Step 7: handleSubmit — 후보 생성 분기**

create 분기 교체 (lodging range 분기는 그대로 두되 후보와 조합 금지 — 모달이 체크 시 range를 숨기지만 이중 방어):

```typescript
    if (modal.mode === "create") {
      const asCandidate = view === "candidates" || Boolean(value.isCandidate);
      if (
        !asCandidate &&
        value.categoryCode === "lodging" &&
        value.lodgingRange &&
        value.lodgingRange.startDayId &&
        value.lodgingRange.endDayId &&
        value.lodgingRange.startDayId !== value.lodgingRange.endDayId
      ) {
        // ... (기존 createLodgingRange.mutate 블록 그대로)
        return;
      }
      createItem.mutate(
        {
          ...base,
          tripId,
          tripDayId: view === "candidates" ? null : activeDayId,
          isCandidate: asCandidate,
        },
        {
          onSuccess: () => {
            showToast(asCandidate ? "후보로 등록했어요" : "일정을 추가했어요", "success");
            closeModal();
          },
          onError: (e) => showToast(`추가 실패: ${e instanceof Error ? e.message : ""}`, "error"),
        },
      );
    }
```

handleSubmit 첫 줄 가드도 완화: `if (!modal) return; if (view === "day" && !activeDayId) return;`

- [ ] **Step 8: 타입 체크**

Run: `pnpm exec tsc --noEmit`
Expected: PASS — `value.isCandidate`는 Task 12에서 폼 타입에 추가되므로, 이 시점에는 `ScheduleItemFormValue`에 임시로 추가해 둔다 (Task 12에서 UI까지 완성):

```typescript
// schedule-item-modal.tsx ScheduleItemFormValue 에 추가
  isCandidate?: boolean;
```

- [ ] **Step 9: Commit**

```bash
git add -- components/trip/schedule-tab.tsx components/trip/date-shrink-confirm.tsx components/schedule/schedule-item-modal.tsx
git commit --no-verify -m "feat(schedule): partition-aware schedule tab data layer + map candidate toggle"
```

---

### Task 11: 후보 UI — hollow 배지 + Day 후보 섹션 + 후보 탭

**Files:**
- Modify: `components/schedule/sortable-schedule-item.tsx`
- Modify: `components/schedule/schedule-list.tsx`
- Modify: `components/schedule/day-tab-bar.tsx`
- Create: `components/schedule/candidate-section.tsx`
- Create: `components/schedule/candidate-panel.tsx`
- Modify: `components/trip/schedule-tab.tsx`

- [ ] **Step 1: SortableScheduleItem — candidate variant 배지**

Props 에 `variant?: "main" | "candidate"` 추가하고, 번호 배지 span 교체:

```typescript
import { markerColorsFor } from "@/lib/maps/marker-colors";
```

```typescript
type Props = {
  // ...기존 그대로...
  variant?: "main" | "candidate";
};
```

배지 렌더 (94-96행 span 교체):

```tsx
          {variant === "candidate" ? (
            <span
              className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-dashed bg-transparent text-[11px] font-semibold tabular-nums"
              style={{
                borderColor: markerColorsFor(item.category_code).fill,
                color: markerColorsFor(item.category_code).fill,
              }}
            >
              {index}
            </span>
          ) : (
            <span className="bg-accent-orange text-cream flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-semibold tabular-nums">
              {index}
            </span>
          )}
```

(함수 시그니처 destructuring 에 `variant = "main"` 추가.)

- [ ] **Step 2: ScheduleList — variant 전달**

Props 에 `variant?: "main" | "candidate"` 추가, `SortableScheduleItem`에 `variant={variant}` 전달.

- [ ] **Step 3: DayTabBar — "후보" 탭**

Props 확장 + 리스트 끝에 탭 추가:

```typescript
type Props = {
  days: TripDay[];
  activeDayId: string | null;
  onSelect: (dayId: string) => void;
  candidateActive?: boolean;
  onSelectCandidates?: () => void;
  className?: string;
};
```

`</ul>` 직전 (days.map 다음)에:

```tsx
        {onSelectCandidates && (
          <li>
            <button
              type="button"
              role="tab"
              aria-selected={candidateActive}
              onClick={onSelectCandidates}
              className={cn(
                "flex h-10 min-w-[58px] flex-col items-center justify-center rounded-[8px] border-2 border-dashed px-2.5 transition-colors duration-150",
                candidateActive
                  ? "border-accent-orange bg-accent-orange/10 text-accent-orange"
                  : "border-border-medium text-ink-700 hover:text-ink-900",
              )}
            >
              <span className="text-[10px] font-medium tracking-wider uppercase">Plan B</span>
              <span className="mt-0.5 text-[13px] font-semibold">후보</span>
            </button>
          </li>
        )}
```

- [ ] **Step 4: Day 후보 섹션 `candidate-section.tsx`**

```tsx
"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ScheduleList } from "./schedule-list";
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";
import { cn } from "@/lib/cn";

type Props = {
  items: ScheduleItem[];
  isDomestic: boolean;
  onTapItem: (item: ScheduleItem) => void;
  onTapNumber?: (item: ScheduleItem) => void;
  registerItemRef?: (id: string, el: HTMLLIElement | null) => void;
};

/**
 * Day 화면 하단 접이식 "후보 (M)" 섹션 (스펙 §7).
 * 후보 0개면 부모에서 렌더하지 않는다. 기본 접힘.
 * 부모의 DndContext 안에서 렌더되어야 드래그 재정렬이 동작한다.
 */
export function CandidateSection({
  items,
  isDomestic,
  onTapItem,
  onTapNumber,
  registerItemRef,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-4" data-testid="candidate-section">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "border-border-medium text-ink-700 flex w-full items-center gap-1.5 rounded-[8px] border-2 border-dashed px-3 py-2 text-[13px] font-medium",
        )}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        후보 ({items.length})
      </button>
      {open && (
        <ScheduleList
          items={items}
          variant="candidate"
          isDomestic={isDomestic}
          onTapItem={onTapItem}
          onTapNumber={onTapNumber}
          registerItemRef={registerItemRef}
        />
      )}
    </section>
  );
}
```

(후보 행은 selectionMode·onLongPress 를 넘기지 않는다 — 다중 선택 이동은 본 일정 전용, 스펙 §7.)

- [ ] **Step 5: 후보 탭 화면 `candidate-panel.tsx`**

풀 + 일자별 모아보기. 드래그 없음(풀 정렬 V1 제외), 탭하면 편집 모달:

```tsx
"use client";

import { Inbox } from "lucide-react";
import { ScheduleItem as ScheduleItemCard } from "@/components/ui/schedule-item";
import { EmptyState } from "@/components/ui/empty-state";
import { markerColorsFor } from "@/lib/maps/marker-colors";
import { resolvePlaceLink } from "@/lib/maps/place-link";
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";
import type { ScheduleCategory } from "@/lib/types";
import type { TripDay } from "@/lib/trip/use-trip-days";

type Props = {
  poolItems: ScheduleItem[];
  candidatesByDay: Record<string, ScheduleItem[]>;
  days: TripDay[];
  isDomestic: boolean;
  onTapItem: (item: ScheduleItem) => void;
  onTapNumber?: (item: ScheduleItem) => void;
  registerItemRef?: (id: string, el: HTMLLIElement | null) => void;
};

/** 후보 탭 (스펙 §7): ① 전체 풀 후보 → ② 일자별 후보 그룹 (있는 날만). 정렬 없음(V1). */
export function CandidatePanel({
  poolItems,
  candidatesByDay,
  days,
  isDomestic,
  onTapItem,
  onTapNumber,
  registerItemRef,
}: Props) {
  const daysWithCandidates = days.filter((d) => (candidatesByDay[d.id] ?? []).length > 0);
  const empty = poolItems.length === 0 && daysWithCandidates.length === 0;

  if (empty) {
    return (
      <EmptyState
        className="py-16"
        icon={<Inbox size={48} strokeWidth={1.5} />}
        title="아직 후보가 없어요"
        description="일정 추가 시 '후보로 등록'을 체크하거나, 여기서 바로 등록해보세요."
      />
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-5" data-testid="candidate-panel">
      <section>
        <h3 className="text-ink-700 mb-2 text-[13px] font-semibold">
          전체 풀 후보 ({poolItems.length})
        </h3>
        {poolItems.length === 0 ? (
          <p className="text-ink-500 text-[12px]">
            여행 전체에서 고려할 후보를 + 버튼으로 등록하세요.
          </p>
        ) : (
          <CandidateRows
            items={poolItems}
            isDomestic={isDomestic}
            onTapItem={onTapItem}
            onTapNumber={onTapNumber}
            registerItemRef={registerItemRef}
          />
        )}
      </section>

      {daysWithCandidates.map((d) => (
        <section key={d.id}>
          <h3 className="text-ink-700 mb-2 text-[13px] font-semibold">
            Day {d.day_number} 후보 ({(candidatesByDay[d.id] ?? []).length})
          </h3>
          <CandidateRows
            items={candidatesByDay[d.id] ?? []}
            isDomestic={isDomestic}
            onTapItem={onTapItem}
            onTapNumber={onTapNumber}
            registerItemRef={registerItemRef}
          />
        </section>
      ))}
    </div>
  );
}

function CandidateRows({
  items,
  isDomestic,
  onTapItem,
  onTapNumber,
  registerItemRef,
}: {
  items: ScheduleItem[];
  isDomestic: boolean;
  onTapItem: (item: ScheduleItem) => void;
  onTapNumber?: (item: ScheduleItem) => void;
  registerItemRef?: (id: string, el: HTMLLIElement | null) => void;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, idx) => {
        const { fill } = markerColorsFor(item.category_code);
        return (
          <li
            key={item.id}
            ref={(el) => registerItemRef?.(item.id, el)}
            className="flex items-stretch gap-1"
          >
            <button
              type="button"
              aria-label={`후보 ${idx + 1}번 지도에서 보기`}
              className="flex h-11 w-11 shrink-0 items-center justify-center bg-transparent"
              onClick={(e) => {
                e.stopPropagation();
                onTapNumber?.(item);
              }}
            >
              <span
                className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-dashed bg-transparent text-[11px] font-semibold tabular-nums"
                style={{ borderColor: fill, color: fill }}
              >
                {idx + 1}
              </span>
            </button>
            <div className="min-w-0 flex-1">
              <ScheduleItemCard
                category={item.category_code as ScheduleCategory}
                title={item.title}
                time={item.time_of_day ? item.time_of_day.slice(0, 5) : undefined}
                placeName={item.place_name ?? undefined}
                placeAddress={item.place_address ?? undefined}
                memo={item.memo ?? undefined}
                onClick={() => onTapItem(item)}
                placeUrl={resolvePlaceLink({
                  placeExternalUrl: item.place_external_url,
                  placeLat: item.place_lat,
                  placeLng: item.place_lng,
                  placeName: item.place_name,
                  placeAddress: item.place_address,
                  isDomestic,
                })}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 6: ScheduleTab 배선**

`schedule-tab.tsx`에서:

imports 추가:

```typescript
import { CandidateSection } from "@/components/schedule/candidate-section";
import { CandidatePanel } from "@/components/schedule/candidate-panel";
```

DayTabBar 에 props 연결:

```tsx
            <DayTabBar
              days={days}
              activeDayId={view === "day" ? activeDayId : null}
              onSelect={(dayId) => {
                setView("day");
                setActiveDayId(dayId);
              }}
              candidateActive={view === "candidates"}
              onSelectCandidates={() => setView("candidates")}
              className="min-w-0 flex-1 lg:top-0"
            />
```

리스트 영역: 기존 `<DndContext>` 블록을 `view === "day"` 조건으로 감싸고, Day 뷰에서는 CandidateSection 을 main 리스트 뒤(DndContext 안)에 추가, candidates 뷰에서는 CandidatePanel 렌더:

```tsx
          {view === "day" ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              {activeDayItems.length === 0 && activeDayCandidates.length === 0 ? (
                <EmptyState /* ...기존 그대로... */ />
              ) : (
                <>
                  <ScheduleList
                    items={activeDayItems}
                    isDomestic={trip?.is_domestic ?? true}
                    onTapItem={selectionMode ? toggleSelected : openEdit}
                    onLongPressItem={enterSelectionMode}
                    onTapNumber={handleNumberTap}
                    selectionMode={selectionMode}
                    selectedIds={selectedIds}
                    onToggleSelected={toggleSelected}
                    registerItemRef={registerItemRef}
                  />
                  {activeDayCandidates.length > 0 && (
                    <CandidateSection
                      items={activeDayCandidates}
                      isDomestic={trip?.is_domestic ?? true}
                      onTapItem={openEdit}
                      onTapNumber={handleNumberTap}
                      registerItemRef={registerItemRef}
                    />
                  )}
                </>
              )}
            </DndContext>
          ) : (
            <CandidatePanel
              poolItems={poolItems}
              candidatesByDay={candidatesByDay}
              days={days}
              isDomestic={trip?.is_domestic ?? true}
              onTapItem={openEdit}
              onTapNumber={handleNumberTap}
              registerItemRef={registerItemRef}
            />
          )}
```

(selectionMode 툴바는 `view === "day"` 조건 추가: `{view === "day" && selectionMode && ( ... )}`.)

- [ ] **Step 7: 검증 (수동 + 타입)**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS

브라우저 프리뷰로 Day 화면 후보 섹션 접기/펼치기, 후보 탭 전환, 지도 후보 토글이 동작하는지 확인 (dev 서버 + 로그인 상태 필요; e2e 는 Task 13).

- [ ] **Step 8: Commit**

```bash
git add components/schedule/sortable-schedule-item.tsx components/schedule/schedule-list.tsx components/schedule/day-tab-bar.tsx components/schedule/candidate-section.tsx components/schedule/candidate-panel.tsx components/trip/schedule-tab.tsx
git commit --no-verify -m "feat(schedule): candidate tab, day candidate section, hollow badges"
```

---

### Task 12: 등록 모달 후보 체크박스 + 전환 액션

**Files:**
- Modify: `components/schedule/schedule-item-modal.tsx`
- Modify: `components/schedule/day-move-sheet.tsx`
- Modify: `components/trip/schedule-tab.tsx`

- [ ] **Step 1: DayMoveSheet — 제목 커스텀 + "전체 후보" 옵션**

```typescript
type Props = {
  open: boolean;
  days: TripDay[];
  currentDayId: string;
  onClose: () => void;
  onPick: (targetDayId: string) => void;
  /** 시트 제목 (기본: "다른 날로 이동") */
  title?: string;
  /** 렌더 시 목록 맨 위에 "전체 후보" 행 추가 */
  onPickPool?: () => void;
};
```

`BottomSheet title={title ?? "다른 날로 이동"}`, 목록 위에:

```tsx
        {onPickPool && (
          <li>
            <button
              type="button"
              className="text-ink-900 w-full py-3 text-left text-[14px] font-medium"
              onClick={onPickPool}
            >
              전체 후보
              <span className="text-ink-500 ml-2 text-[12px]">여행 전체 풀로 이동</span>
            </button>
          </li>
        )}
```

(빈 목록 분기 조건도 `others.length === 0 && !onPickPool` 로 변경.)

- [ ] **Step 2: 모달 — "후보로 등록" 체크박스**

`ScheduleItemFormValue`의 `isCandidate?: boolean`은 Task 10에서 추가됨. Props 확장:

```typescript
  /** create 모드: "day-toggle" 이면 후보 체크박스 노출, "pool-fixed" 면 자동 풀 후보(체크박스 없음) */
  candidateMode?: "day-toggle" | "pool-fixed";
  /** edit 모드 전환 액션 (본 일정이면 demote, 후보면 promote/move) */
  onDemoteToCandidate?: () => void;
  onPromoteToSchedule?: () => void;
  onMoveCandidate?: () => void;
```

상태 추가 + open 리셋:

```typescript
  const [isCandidate, setIsCandidate] = useState(false);
  // open effect 안에 추가:
  setIsCandidate(false);
```

submit 에 포함:

```typescript
      isCandidate: candidateMode === "pool-fixed" ? true : isCandidate,
```

lodging range 렌더 조건 2곳(`place_search`·`manual_place`)에 `&& !isCandidate` 추가, submit 의 lodgingRange 도 `mode === "create" && categoryCode === "lodging" && !isCandidate ? {...} : null`.

체크박스 UI — 바깥 `<div className="space-y-4">` 안, stage 블록들 뒤에 추가:

```tsx
        {mode === "create" && candidateMode === "day-toggle" && stage !== "category_select" && (
          <label className="text-ink-700 flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={isCandidate}
              onChange={(e) => setIsCandidate(e.target.checked)}
              className="accent-ink-900 h-4 w-4"
            />
            후보로 등록 (본 일정 번호에 넣지 않음)
          </label>
        )}
```

전환 버튼 — footer 의 edit 버튼 행 교체:

```tsx
          {mode === "edit" && (
            <div className="flex w-full flex-wrap gap-2">
              {onDemoteToCandidate && (
                <Button fullWidth size="sm" variant="tertiary" onClick={onDemoteToCandidate}>
                  후보로 빼기
                </Button>
              )}
              {onPromoteToSchedule && (
                <Button fullWidth size="sm" variant="tertiary" onClick={onPromoteToSchedule}>
                  일정으로 승격
                </Button>
              )}
              {onMoveCandidate && (
                <Button fullWidth size="sm" variant="tertiary" onClick={onMoveCandidate}>
                  후보 이동
                </Button>
              )}
              {onOpenDayMove && (
                <Button fullWidth size="sm" variant="tertiary" onClick={onOpenDayMove}>
                  다른 날로 이동
                </Button>
              )}
              {onDelete && (
                <Button fullWidth size="sm" variant="ghost" onClick={onDelete}>
                  삭제
                </Button>
              )}
            </div>
          )}
```

- [ ] **Step 3: ScheduleTab — 전환 액션 배선**

imports/훅:

```typescript
import { useSetScheduleItemCandidacy } from "@/lib/schedule/use-set-schedule-item-candidacy";
// ...
  const candidacy = useSetScheduleItemCandidacy();
  const [candidacySheet, setCandidacySheet] = useState<{
    item: ScheduleItem;
    mode: "promote" | "move";
  } | null>(null);
```

핸들러 (handleBulkDelete 아래):

```typescript
  function runCandidacy(itemId: string, isCandidate: boolean, targetDayId: string | null, msg: string) {
    candidacy.mutate(
      { tripId, itemId, isCandidate, targetDayId },
      {
        onSuccess: () => showToast(msg, "success"),
        onError: (e) => showToast(`실패: ${e instanceof Error ? e.message : ""}`, "error"),
      },
    );
    setCandidacySheet(null);
    closeModal();
  }

  function handleDemote() {
    if (!modal?.initial) return;
    runCandidacy(modal.initial.id, true, modal.initial.trip_day_id, "후보로 옮겼어요");
  }
```

Modal 렌더에 props 연결 (기존 `onOpenDayMove` 조건 강화 — 본 일정에서만):

```tsx
        <ScheduleItemModal
          open
          mode={modal.mode}
          initial={modal.initial}
          pickedPlace={pickedPlace}
          candidateMode={view === "candidates" ? "pool-fixed" : "day-toggle"}
          onClose={closeModal}
          onSubmit={handleSubmit}
          onDelete={modal.mode === "edit" ? handleDelete : undefined}
          onOpenPlaceSearch={() => setPlaceSheetOpen(true)}
          onOpenDayMove={
            modal.mode === "edit" && modal.initial && !modal.initial.is_candidate
              ? () => setDayMoveFor(modal.initial)
              : undefined
          }
          onDemoteToCandidate={
            modal.mode === "edit" && modal.initial && !modal.initial.is_candidate
              ? handleDemote
              : undefined
          }
          onPromoteToSchedule={
            modal.mode === "edit" && modal.initial?.is_candidate
              ? () => setCandidacySheet({ item: modal.initial!, mode: "promote" })
              : undefined
          }
          onMoveCandidate={
            modal.mode === "edit" && modal.initial?.is_candidate
              ? () => setCandidacySheet({ item: modal.initial!, mode: "move" })
              : undefined
          }
          days={days}
          currentDayId={activeDayId}
          onAddExpense={/* ...기존 그대로... */}
        />
```

승격/이동 시트 (기존 DayMoveSheet 2개 아래에 추가):

```tsx
      <DayMoveSheet
        open={candidacySheet?.mode === "promote"}
        days={days}
        currentDayId=""
        title="일정으로 승격할 날짜"
        onClose={() => setCandidacySheet(null)}
        onPick={(dayId) => {
          if (!candidacySheet) return;
          runCandidacy(candidacySheet.item.id, false, dayId, "일정으로 승격했어요");
        }}
      />
      <DayMoveSheet
        open={candidacySheet?.mode === "move"}
        days={days}
        currentDayId={candidacySheet?.item.trip_day_id ?? ""}
        title="후보 이동"
        onClose={() => setCandidacySheet(null)}
        onPick={(dayId) => {
          if (!candidacySheet) return;
          runCandidacy(candidacySheet.item.id, true, dayId, "후보를 이동했어요");
        }}
        onPickPool={() => {
          if (!candidacySheet) return;
          runCandidacy(candidacySheet.item.id, true, null, "전체 후보로 이동했어요");
        }}
      />
```

- [ ] **Step 4: 검증 + Commit**

Run: `pnpm exec tsc --noEmit && pnpm test`
Expected: PASS (unit 전체 — `schedule-item-modal-stage`, `sortable-schedule-item-selection` 등 기존 테스트 포함)

```bash
git add components/schedule/schedule-item-modal.tsx components/schedule/day-move-sheet.tsx components/trip/schedule-tab.tsx
git commit --no-verify -m "feat(schedule): candidate registration toggle and promote/demote/move actions"
```

---

### Task 13: E2E — 후보 플로우

**Files:**
- Create: `tests/e2e/candidate-flow.spec.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: 스펙 작성**

`tests/e2e/schedule-crud.spec.ts` 패턴 (alice storageState, serial):

```typescript
import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

let tripId = "";

test.describe("후보 일정 플로우", () => {
  test("후보로 등록 → 후보 섹션에 표시, 본 일정 번호에는 없음", async ({ page }) => {
    await page.goto("/trips/new");
    await page.getByLabel("여행 제목").fill("E2E 후보 테스트");
    await page.getByLabel("목적지").fill("Seoul");
    await page.getByLabel("시작일").fill("2026-10-01");
    await page.getByLabel("종료일").fill("2026-10-02");
    await page.getByRole("button", { name: "국내" }).click();
    await page.getByRole("button", { name: "여행 만들기" }).click();
    await expect(page).toHaveURL(
      /\/trips\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
      { timeout: 10_000 },
    );
    tripId = page.url().split("/trips/")[1].split("?")[0];

    // 본 일정 1개
    await page.getByLabel("일정 추가").click();
    await page.getByRole("radio", { name: "기타" }).click();
    await page.getByLabel("제목").fill("본 일정 A");
    await page.getByRole("button", { name: "추가", exact: true }).click();
    await expect(page.getByText("본 일정 A")).toBeVisible({ timeout: 5_000 });

    // 후보 1개
    await page.getByLabel("일정 추가").click();
    await page.getByRole("radio", { name: "기타" }).click();
    await page.getByLabel("제목").fill("후보 B");
    await page.getByText("후보로 등록", { exact: false }).click();
    await page.getByRole("button", { name: "추가", exact: true }).click();

    // 접이식 후보 섹션에 카운트 표시, 펼치면 항목 노출
    const section = page.getByTestId("candidate-section");
    await expect(section.getByText("후보 (1)")).toBeVisible({ timeout: 5_000 });
    await section.getByRole("button", { name: /후보 \(1\)/ }).click();
    await expect(section.getByText("후보 B")).toBeVisible();
  });

  test("후보 탭 모아보기 + 풀 후보 등록", async ({ page }) => {
    await page.goto(`/trips/${tripId}`);
    await page.getByRole("tab", { name: /후보/ }).click();
    const panel = page.getByTestId("candidate-panel");
    await expect(panel.getByText("Day 1 후보 (1)")).toBeVisible({ timeout: 5_000 });
    await expect(panel.getByText("후보 B")).toBeVisible();

    // 후보 탭에서 등록 → 풀 후보
    await page.getByLabel("일정 추가").click();
    await page.getByRole("radio", { name: "기타" }).click();
    await page.getByLabel("제목").fill("풀 후보 C");
    await page.getByRole("button", { name: "추가", exact: true }).click();
    await expect(panel.getByText("전체 풀 후보 (1)")).toBeVisible({ timeout: 5_000 });
    await expect(panel.getByText("풀 후보 C")).toBeVisible();
  });

  test("승격: 후보 → 본 일정 끝 번호", async ({ page }) => {
    await page.goto(`/trips/${tripId}`);
    const section = page.getByTestId("candidate-section");
    await section.getByRole("button", { name: /후보 \(1\)/ }).click();
    await section.getByText("후보 B").click();
    await page.getByRole("button", { name: "일정으로 승격" }).click();
    const promoteSheet = page.getByRole("dialog", { name: "일정으로 승격할 날짜" });
    await promoteSheet.getByRole("button", { name: /Day 1/ }).click();

    // 본 일정 리스트에 후보 B 가 2번으로 합류, 후보 섹션은 사라짐
    await expect(page.getByText("일정으로 승격했어요")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("candidate-section")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "2번 일정 지도에서 보기. 길게 눌러 순서 변경" }),
    ).toBeVisible();
  });
});
```

승격 시트의 day 선택은 위처럼 처음부터 dialog로 범위를 좁혀 모호성을 없앤다. `Day 1` 텍스트의 전역 `.last()`에는 의존하지 않는다.

- [ ] **Step 2: Playwright alice 프로젝트에 테스트 등록**

`playwright.config.ts`의 alice `testMatch` 배열에 추가:

```typescript
"candidate-flow.spec.ts",
```

- [ ] **Step 3: 수집 확인 후 실행 → 통과 확인**

Run: `pnpm test:e2e -- candidate-flow --list`
Expected: alice 프로젝트 아래 candidate-flow 테스트 3개가 출력됨. `No tests found`면 실행하지 말고 `testMatch`를 먼저 수정한다.

Run: `pnpm test:e2e -- candidate-flow`
Expected: PASS (dev 서버·seed 는 playwright global-setup 이 처리)

- [ ] **Step 4: Commit**

```bash
git add -- tests/e2e/candidate-flow.spec.ts playwright.config.ts
git commit --no-verify -m "test(e2e): candidate register/aggregate/promote flow"
```

---

### Task 14: 전체 검증 + 문서/위키 갱신

- [ ] **Step 1: 전체 스위트**

Run:
```bash
pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm test:integration && pnpm test:e2e
```
Expected: 전건 PASS. 기존 e2e 중 `schedule-crud`, `drag-same-day`, `drag-cross-day`, `lodging-range-and-bulk-move`, `resize-with-items`, `guest-share-flow` 는 이번 변경의 회귀 위험 지점이므로 실패 시 우선 분석.

- [ ] **Step 2: 애플리케이션 배포**

migration `0023`은 Task 2에서 이미 원격에 적용됐고 하위 호환이므로, 여기서는 애플리케이션 배포만 남는다:

1. `supabase migration list`로 원격에 `0023`이 적용되어 있는지 최종 확인
2. 애플리케이션 배포
3. 후보 생성/승격/게스트 공유 smoke test

애플리케이션 배포는 외부 상태를 바꾸므로, 계획 실행자가 대상 프로젝트와 배포 승인을 다시 확인한 뒤 수행한다.

- [ ] **Step 3: 위키/문서 갱신**

- 위키 `projects/travel-manager` 상태 페이지에 이번 기능 반영 (경로는 `/Users/sohyun/` 하위 — CLAUDE.md의 `/Users/sh/`는 다른 머신용).
- 스키마 변경이므로 위키 architecture 문서에 `schedule_items` 파티션 모델 한 줄 추가, 원본 상세는 스펙 문서 링크.

- [ ] **Step 4: 최종 Commit**

```bash
git status --short
git diff --check
git add -- \
  docs/specs/2026-08-17-candidate-items-and-category-colors-design.md \
  docs/plans/2026-08-17-candidate-items-implementation.md
git commit --no-verify -m "docs: candidate items feature wrap-up"
```

---

## Self-Review Checklist (플랜 작성자용)

- 스펙 §3(스키마·RLS·기존 FK 제거 후 복합 FK) → Task 1 / §4(RPC 전체·여행 잠금·잠금 후 재검증·숙소 RPC) → Task 1 / §5(카페·색) → Task 1 Step 2 + Task 5 / §6(마커) → Task 6–7 + Task 10 Step 3 / §7(목록 UI·모달·전환·날짜 축소 문구·클라이언트 경로) → Task 8–12 / §8(게스트 조회·게스트 MapPanel) → Task 1 Step 12 + Task 4·7 / §9(테스트) → Task 3·4·5·6·9·13
- 후보 탭 지도 "마커 탭 시 소속 표시"는 `contextLabel`을 toast/label로 명시하고 해당 카드로 스크롤한다. 스크롤 위치만으로 소속을 암시하지 않는다.
- 풀 후보 재정렬 V1 제외 → CandidatePanel 드래그 없음 + reorder RPC 는 day 필수 유지
- 혼합 선택 이동 → 후보 행이 selectionMode 에 참여하지 않으므로 UI 레벨 차단 + RPC `candidate_not_movable_here` 이중 방어
- 카테고리 7개 회귀 → `use-categories`, modal stage fixture, RLS category integration, settings category E2E를 모두 갱신
- Playwright 수집 누락 방지 → alice `testMatch`에 `candidate-flow.spec.ts` 등록 후 `--list`로 3건 확인
- 원격 반영 안전장치 → 통합 테스트·E2E가 linked 원격 DB를 사용하므로 push는 Task 2에서 수행하되, 그 전에 로컬 `db reset` 검증 + `db push --dry-run`으로 방어. 애플리케이션 배포는 전체 스위트 통과 후(Task 14)
