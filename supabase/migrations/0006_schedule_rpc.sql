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
