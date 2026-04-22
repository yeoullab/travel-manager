-- 0015_records_rpc.sql
-- Phase 4: records CRUD RPC
-- 의존: 0014_records.sql

-- ── create_record ──────────────────────────────────────────────────────
create or replace function public.create_record(
  p_trip_id  uuid,
  p_title    text,
  p_content  text,
  p_date     date
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_new_id uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  if not public.can_access_trip(p_trip_id) then raise exception 'forbidden'; end if;

  insert into public.records(trip_id, title, content, date)
    values (p_trip_id, p_title, p_content, p_date)
    returning id into v_new_id;
  return v_new_id;
end $$;
revoke all on function public.create_record(uuid, text, text, date) from public;
grant execute on function public.create_record(uuid, text, text, date) to authenticated;

-- ── update_record ──────────────────────────────────────────────────────
create or replace function public.update_record(
  p_record_id uuid,
  p_title     text,
  p_content   text,
  p_date      date
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_trip_id uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  select trip_id into v_trip_id from public.records where id = p_record_id;
  if v_trip_id is null then raise exception 'record_not_found'; end if;
  if not public.can_access_trip(v_trip_id) then raise exception 'forbidden'; end if;

  update public.records
    set title = p_title,
        content = p_content,
        date = p_date
    where id = p_record_id;
end $$;
revoke all on function public.update_record(uuid, text, text, date) from public;
grant execute on function public.update_record(uuid, text, text, date) to authenticated;

-- ── delete_record ──────────────────────────────────────────────────────
create or replace function public.delete_record(p_record_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_trip_id uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  select trip_id into v_trip_id from public.records where id = p_record_id;
  if v_trip_id is null then raise exception 'record_not_found'; end if;
  if not public.can_access_trip(v_trip_id) then raise exception 'forbidden'; end if;
  delete from public.records where id = p_record_id;
end $$;
revoke all on function public.delete_record(uuid) from public;
grant execute on function public.delete_record(uuid) to authenticated;

-- ROLLBACK
-- drop function if exists public.delete_record(uuid);
-- drop function if exists public.update_record(uuid, text, text, date);
-- drop function if exists public.create_record(uuid, text, text, date);
