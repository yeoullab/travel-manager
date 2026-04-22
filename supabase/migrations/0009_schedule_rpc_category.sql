-- 0009_schedule_rpc_category.sql
-- Phase 3 갭 복구: create/update_schedule_item 에 p_category_code 파라미터 추가 (11 → 12)
-- 의존: 0006_schedule_rpc.sql, 0008_categories.sql

-- ── 기존 11-파라미터 함수 drop (signature 변경 필수) ──
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

  -- category 존재성은 FK 로 자동 검증 (invalid 값이면 foreign_key_violation)
  -- provider ↔ is_domestic 정합성 (0006 동일)
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
