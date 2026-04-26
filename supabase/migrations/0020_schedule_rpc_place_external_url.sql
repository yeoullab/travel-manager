-- 0020_schedule_rpc_place_external_url.sql
-- §6.13 V1: create/update_schedule_item RPC 에 p_place_external_url 파라미터 추가 (12 → 13).
-- get_guest_trip_data RPC 도 schedule items JSON 에 placeExternalUrl 포함하도록 확장.
-- 의존: 0009_schedule_rpc_category.sql, 0019_schedule_items_place_external_url.sql, 0018_guest_share_with_coords.sql

-- ── 기존 12-파라미터 함수 drop (signature 변경 필수) ──
drop function if exists public.create_schedule_item(
  uuid, text, time without time zone, text, text,
  double precision, double precision, text, text, text, text, text
);
drop function if exists public.update_schedule_item(
  uuid, text, time without time zone, text, text,
  double precision, double precision, text, text, text, text, text
);

-- ── create_schedule_item (13 파라미터) ──
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

-- ── update_schedule_item (13 파라미터) ──
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

-- ── get_guest_trip_data: schedule items JSON 에 placeExternalUrl 추가 ──
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
            ) from public.schedule_items si where si.trip_day_id = td.id
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

-- ROLLBACK
-- drop function if exists public.create_schedule_item(uuid, text, time without time zone, text, text, double precision, double precision, text, text, text, text, text, text);
-- drop function if exists public.update_schedule_item(uuid, text, time without time zone, text, text, double precision, double precision, text, text, text, text, text, text);
-- 그 다음 0009_schedule_rpc_category.sql 의 12-파라미터 버전 + 0018_guest_share_with_coords.sql 재적용.
