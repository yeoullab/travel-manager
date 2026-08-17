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

-- ── create_lodging_schedule_items_for_range: trip_id 저장 + 본 일정 파티션 ──
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

-- ── update_schedule_item: 시그니처 동일, dayless 대응 ──
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

-- ── delete_schedule_item: dayless + 파티션 재번호 ──
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

-- ── delete_schedule_items (bulk): trip_days inner join 제거 + 파티션 재번호 ──
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

-- ── reorder_schedule_items_in_day: 파티션 판정 + 파티션 개수 검증 ──
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

-- ── move RPC 2종: 본 일정 전용 가드 + 파티션 인식 재번호 ──
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

-- ── 신규 set_schedule_item_candidacy: "대상 파티션으로 이동" 단일 RPC ──
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

-- ── resize_trip_days: 축소 시 일자 후보 → 풀 ──
-- 0006의 함수 전체를 재작성하되, 축소 분기만 바뀐다 (확장 분기·day date 갱신은 그대로).
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

-- ── get_guest_trip_data: 후보 제외 필터 (0020 본문 복사 + is_candidate = false) ──
create or replace function public.get_guest_trip_data(p_token uuid)
returns json
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_share    public.guest_shares%rowtype;
  v_trip     public.trips%rowtype;
  v_schedule json;
  v_expenses json;
  v_todos    json;
  v_records  json;
begin
  select * into v_share from public.guest_shares
    where token = p_token
      and is_active = true
      and (expires_at is null or expires_at > now());
  if v_share.id is null then return null; end if;

  select * into v_trip from public.trips where id = v_share.trip_id;
  if v_trip.id is null then return null; end if;

  if v_share.show_schedule then
    select json_agg(
      json_build_object(
        'dayNumber', td.day_number,
        'date',      td.date,
        'items', coalesce(
          (
            select json_agg(
              json_build_object(
                'title',            si.title,
                'timeOfDay',        si.time_of_day,
                'placeName',        si.place_name,
                'placeAddress',     si.place_address,
                'placeLat',         si.place_lat,
                'placeLng',         si.place_lng,
                'placeExternalUrl', si.place_external_url,
                'memo',             si.memo,
                'url',              si.url,
                'categoryCode',     si.category_code
              ) order by si.sort_order
            ) from public.schedule_items si
              where si.trip_day_id = td.id and si.is_candidate = false
          ),
          '[]'::json
        )
      ) order by td.day_number
    ) into v_schedule
    from public.trip_days td
    where td.trip_id = v_share.trip_id;
  end if;

  if v_share.show_expenses then
    select json_agg(
      json_build_object(
        'expenseDate',  expense_date,
        'title',        title,
        'amount',       amount,
        'currency',     currency,
        'categoryCode', category_code,
        'memo',         memo
      ) order by expense_date desc, created_at desc
    ) into v_expenses
    from public.expenses where trip_id = v_share.trip_id;
  end if;

  if v_share.show_todos then
    select json_agg(
      json_build_object(
        'title',       title,
        'memo',        memo,
        'isCompleted', is_completed
      ) order by is_completed asc, created_at desc
    ) into v_todos
    from public.todos where trip_id = v_share.trip_id;
  end if;

  if v_share.show_records then
    select json_agg(
      json_build_object(
        'title',   title,
        'content', content,
        'date',    date
      ) order by date desc, created_at desc
    ) into v_records
    from public.records where trip_id = v_share.trip_id;
  end if;

  return json_build_object(
    'trip', json_build_object(
      'title',       v_trip.title,
      'destination', v_trip.destination,
      'startDate',   v_trip.start_date,
      'endDate',     v_trip.end_date,
      'isDomestic',  v_trip.is_domestic
    ),
    'share', json_build_object(
      'showSchedule', v_share.show_schedule,
      'showExpenses', v_share.show_expenses,
      'showTodos',    v_share.show_todos,
      'showRecords',  v_share.show_records
    ),
    'scheduleByDay', coalesce(v_schedule, '[]'::json),
    'expenses',      coalesce(v_expenses, '[]'::json),
    'todos',         coalesce(v_todos,    '[]'::json),
    'records',       coalesce(v_records,  '[]'::json)
  );
end $$;

revoke all on function public.get_guest_trip_data(uuid) from public;
grant execute on function public.get_guest_trip_data(uuid) to anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- ROLLBACK 참고 (수동)
-- ══════════════════════════════════════════════════════════════════════
-- drop function if exists public.set_schedule_item_candidacy(uuid, boolean, uuid);
-- alter table public.schedule_items drop constraint schedule_items_day_trip_consistent;
-- drop index if exists public.trip_days_id_trip_id_key;
-- alter table public.schedule_items drop column is_candidate, drop column trip_id;
-- (RPC/RLS/카테고리는 이전 마이그레이션 버전으로 재적용 필요)
