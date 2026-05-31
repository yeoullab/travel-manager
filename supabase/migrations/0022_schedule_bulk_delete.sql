-- Atomic bulk deletion for selected schedule items.
-- Keeps every affected trip_day sort_order 1-based and gap-free.

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
  v_affected_days uuid[];
  v_inaccessible_count int;
  v_locked_day_id uuid;
  v_locked_item_id uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  v_input_count := coalesce(array_length(p_item_ids, 1), 0);
  if v_input_count = 0 then
    raise exception 'empty_item_ids';
  end if;

  select count(*)
    into v_expected_count
  from (select distinct unnest(p_item_ids) as id) input_ids;

  if v_expected_count <> v_input_count then
    raise exception 'duplicate_item_ids';
  end if;

  for v_locked_day_id in
    select td.id
    from public.trip_days td
    where td.id in (
      select distinct si.trip_day_id
      from public.schedule_items si
      where si.id in (select distinct unnest(p_item_ids))
    )
    order by td.id
    for update
  loop
    null;
  end loop;

  for v_locked_item_id in
    select si.id
    from public.schedule_items si
    join public.trip_days td on td.id = si.trip_day_id
    where si.id in (select distinct unnest(p_item_ids))
    order by si.trip_day_id, si.sort_order, si.created_at, si.id
    for update of si
  loop
    null;
  end loop;

  select
    count(*),
    count(distinct td.trip_id),
    (array_agg(distinct td.trip_id))[1],
    array_agg(distinct si.trip_day_id order by si.trip_day_id)
    into v_matched_count, v_trip_count, v_trip_id, v_affected_days
  from public.schedule_items si
  join public.trip_days td on td.id = si.trip_day_id
  where si.id in (select distinct unnest(p_item_ids));

  if v_matched_count <> v_expected_count then
    raise exception 'missing_schedule_items';
  end if;

  select count(*)
    into v_inaccessible_count
  from (
    select distinct td.trip_id
    from public.schedule_items si
    join public.trip_days td on td.id = si.trip_day_id
    where si.id in (select distinct unnest(p_item_ids))
  ) selected_trips
  where not public.can_access_trip(selected_trips.trip_id);

  if v_inaccessible_count > 0 then
    raise exception 'forbidden';
  end if;

  if v_trip_count <> 1 or v_trip_id is null then
    raise exception 'mixed_trip_items';
  end if;

  perform 1
  from (
    select td.id
    from public.trip_days td
    where td.id = any(v_affected_days)
    order by td.id
    for update
  ) locked_days;

  perform 1
  from (
    select si.id
    from public.schedule_items si
    where si.trip_day_id = any(v_affected_days)
    order by si.trip_day_id, si.sort_order, si.created_at, si.id
    for update
  ) locked_items;

  delete from public.schedule_items si
  where si.id in (select distinct unnest(p_item_ids));

  with affected(day_id) as (
    select unnest(v_affected_days)
  ),
  ranked as (
    select
      si.id,
      row_number() over (
        partition by si.trip_day_id
        order by si.sort_order, si.created_at, si.id
      )::int as rn
    from public.schedule_items si
    join affected a on a.day_id = si.trip_day_id
  )
  update public.schedule_items si
     set sort_order = ranked.rn,
         updated_at = now()
    from ranked
   where si.id = ranked.id;
end;
$$;

revoke all on function public.delete_schedule_items(uuid[]) from public;
grant execute on function public.delete_schedule_items(uuid[]) to authenticated;
