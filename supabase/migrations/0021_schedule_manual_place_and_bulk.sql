-- 0021_schedule_manual_place_and_bulk.sql
-- v1.1: manual places without coordinates + lodging range create + bulk day move.
-- Depends on 0020_schedule_rpc_place_external_url.sql.

alter table public.schedule_items
  drop constraint if exists schedule_items_place_atomic;

alter table public.schedule_items
  add constraint schedule_items_place_atomic check (
    (
      place_name is null
      and place_address is null
      and place_lat is null
      and place_lng is null
      and place_provider is null
      and place_external_id is null
    )
    or
    (
      place_name is not null
      and place_address is not null
      and place_lat is null
      and place_lng is null
      and place_provider is null
      and place_external_id is null
    )
    or
    (
      place_name is not null
      and place_lat is not null
      and place_lng is not null
      and place_provider is not null
    )
  );

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
  p_place_external_url text default null
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

  select coalesce(max(sort_order), 0) + 1 into v_next_order
    from public.schedule_items where trip_day_id = p_trip_day_id;

  insert into public.schedule_items(
    trip_day_id, title, sort_order, time_of_day,
    place_name, place_address, place_lat, place_lng,
    place_provider, place_external_id, memo, url,
    category_code, place_external_url
  ) values (
    p_trip_day_id, p_title, v_next_order, p_time_of_day,
    p_place_name, p_place_address, p_place_lat, p_place_lng,
    p_place_provider, p_place_external_id, p_memo, p_url,
    p_category_code, p_place_external_url
  ) returning id into v_new_id;

  return v_new_id;
end $$;

revoke all on function public.create_schedule_item(
  uuid, text, time without time zone, text, text,
  double precision, double precision, text, text, text, text, text, text
) from public;
grant execute on function public.create_schedule_item(
  uuid, text, time without time zone, text, text,
  double precision, double precision, text, text, text, text, text, text
) to authenticated;

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

revoke all on function public.update_schedule_item(
  uuid, text, time without time zone, text, text,
  double precision, double precision, text, text, text, text, text, text
) from public;
grant execute on function public.update_schedule_item(
  uuid, text, time without time zone, text, text,
  double precision, double precision, text, text, text, text, text, text
) to authenticated;

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
      from public.schedule_items where trip_day_id = v_day.id;

    insert into public.schedule_items(
      trip_day_id, title, sort_order, time_of_day,
      place_name, place_address, place_lat, place_lng,
      place_provider, place_external_id, memo, url,
      category_code, place_external_url
    ) values (
      v_day.id, p_title, v_next_order, p_time_of_day,
      p_place_name, p_place_address, p_place_lat, p_place_lng,
      p_place_provider, p_place_external_id, p_memo, p_url,
      'lodging', p_place_external_url
    ) returning id into v_new_id;

    v_ids := array_append(v_ids, v_new_id);
  end loop;

  return v_ids;
end $$;

revoke all on function public.create_lodging_schedule_items_for_range(
  uuid, uuid, uuid, text, time without time zone, text, text,
  double precision, double precision, text, text, text, text, text
) from public;
grant execute on function public.create_lodging_schedule_items_for_range(
  uuid, uuid, uuid, text, time without time zone, text, text,
  double precision, double precision, text, text, text, text, text
) to authenticated;

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

  select count(*) into v_item_count
    from public.schedule_items
    where id = any(p_item_ids);
  if v_item_count != array_length(p_item_ids, 1) then
    raise exception 'schedule_item_not_found';
  end if;

  if exists (
    select 1
    from public.schedule_items si
    join public.trip_days td on td.id = si.trip_day_id
    where si.id = any(p_item_ids) and td.trip_id != v_target_trip
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
    where trip_day_id = p_target_day_id;

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
        where trip_day_id = v_day_id
      ) ranked
      where si.id = ranked.id;
  end loop;
end $$;

revoke all on function public.move_schedule_items_to_day(uuid[], uuid) from public;
grant execute on function public.move_schedule_items_to_day(uuid[], uuid) to authenticated;
