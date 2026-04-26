-- Phase 4 hotfix: get_guest_trip_data 가 schedule items 의 좌표를 함께 반환하도록 확장.
-- 게스트 페이지에서 지도를 그릴 수 있게 하기 위함. PII 무관 (좌표는 위치 자체로 PII 가 아니며,
-- placeName/placeAddress 와 동일 수준).

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
                'title',        si.title,
                'timeOfDay',    si.time_of_day,
                'placeName',    si.place_name,
                'placeAddress', si.place_address,
                'placeLat',     si.place_lat,
                'placeLng',     si.place_lng,
                'memo',         si.memo,
                'url',          si.url,
                'categoryCode', si.category_code
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
