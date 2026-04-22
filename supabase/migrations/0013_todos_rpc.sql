-- 0013_todos_rpc.sql
-- Phase 4: todos CRUD + toggle RPC
-- 의존: 0012_todos.sql

-- ── create_todo ────────────────────────────────────────────────────────
create or replace function public.create_todo(
  p_trip_id     uuid,
  p_title       text,
  p_memo        text default null,
  p_assigned_to uuid default null
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

  if p_assigned_to is not null then
    if not (
      exists (select 1 from public.trips where id = p_trip_id and created_by = p_assigned_to)
      or exists (
        select 1 from public.group_members gm
        join public.trips t on t.group_id = gm.group_id
        where t.id = p_trip_id and gm.user_id = p_assigned_to
      )
    ) then raise exception 'assigned_to_not_trip_member'; end if;
  end if;

  insert into public.todos(trip_id, title, memo, assigned_to)
    values (p_trip_id, p_title, p_memo, p_assigned_to)
    returning id into v_new_id;
  return v_new_id;
end $$;

revoke all on function public.create_todo(uuid, text, text, uuid) from public;
grant execute on function public.create_todo(uuid, text, text, uuid) to authenticated;

-- ── update_todo ────────────────────────────────────────────────────────
create or replace function public.update_todo(
  p_todo_id     uuid,
  p_title       text,
  p_memo        text default null,
  p_assigned_to uuid default null
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
  select trip_id into v_trip_id from public.todos where id = p_todo_id;
  if v_trip_id is null then raise exception 'todo_not_found'; end if;
  if not public.can_access_trip(v_trip_id) then raise exception 'forbidden'; end if;

  if p_assigned_to is not null then
    if not (
      exists (select 1 from public.trips where id = v_trip_id and created_by = p_assigned_to)
      or exists (
        select 1 from public.group_members gm
        join public.trips t on t.group_id = gm.group_id
        where t.id = v_trip_id and gm.user_id = p_assigned_to
      )
    ) then raise exception 'assigned_to_not_trip_member'; end if;
  end if;

  update public.todos
    set title = p_title,
        memo = p_memo,
        assigned_to = p_assigned_to
    where id = p_todo_id;
end $$;

revoke all on function public.update_todo(uuid, text, text, uuid) from public;
grant execute on function public.update_todo(uuid, text, text, uuid) to authenticated;

-- ── toggle_todo ────────────────────────────────────────────────────────
create or replace function public.toggle_todo(
  p_todo_id  uuid,
  p_complete boolean
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
  select trip_id into v_trip_id from public.todos where id = p_todo_id;
  if v_trip_id is null then raise exception 'todo_not_found'; end if;
  if not public.can_access_trip(v_trip_id) then raise exception 'forbidden'; end if;

  update public.todos set is_completed = p_complete where id = p_todo_id;
end $$;

revoke all on function public.toggle_todo(uuid, boolean) from public;
grant execute on function public.toggle_todo(uuid, boolean) to authenticated;

-- ── delete_todo ────────────────────────────────────────────────────────
create or replace function public.delete_todo(p_todo_id uuid)
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
  select trip_id into v_trip_id from public.todos where id = p_todo_id;
  if v_trip_id is null then raise exception 'todo_not_found'; end if;
  if not public.can_access_trip(v_trip_id) then raise exception 'forbidden'; end if;
  delete from public.todos where id = p_todo_id;
end $$;

revoke all on function public.delete_todo(uuid) from public;
grant execute on function public.delete_todo(uuid) to authenticated;

-- ROLLBACK
-- drop function if exists public.delete_todo(uuid);
-- drop function if exists public.toggle_todo(uuid, boolean);
-- drop function if exists public.update_todo(uuid, text, text, uuid);
-- drop function if exists public.create_todo(uuid, text, text, uuid);
