-- 0004_fix_group_members_rls.sql
-- Fix: group_members_select_own_group policy caused infinite recursion.
-- Solution: introduce a SECURITY DEFINER helper that bypasses RLS, then
-- rewrite the policy and any security-invoker RPCs that query group_members.

-- ── Helper: is_group_member (SECURITY DEFINER — breaks RLS recursion) ───────
create or replace function public.is_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_user_id
  );
$$;
revoke all on function public.is_group_member(uuid, uuid) from public;
grant execute on function public.is_group_member(uuid, uuid) to authenticated;

-- ── Fix group_members SELECT policy (infinite recursion → helper) ────────────
drop policy if exists "group_members_select_own_group" on public.group_members;

create policy "group_members_select_own_group"
  on public.group_members for select to authenticated
  using (public.is_group_member(group_id, auth.uid()));

-- ── Fix group_members DELETE policy (same recursion) ────────────────────────
drop policy if exists "group_members_self_or_owner_delete" on public.group_members;

create policy "group_members_self_or_owner_delete"
  on public.group_members for delete to authenticated
  using (
    (user_id = auth.uid() and role != 'owner')
    or exists (
      select 1 from public.group_members me
      where me.group_id = group_members.group_id
        and me.user_id = auth.uid()
        and me.role = 'owner'
    )
  );

-- The DELETE policy above still references group_members but is a separate
-- sub-query context; Postgres detects recursion only when the outer query
-- table matches the sub-select table AND there is no break. The owner check
-- sub-select is on a different alias/context so it works, BUT to be safe,
-- also use the helper here:
drop policy if exists "group_members_self_or_owner_delete" on public.group_members;

create policy "group_members_self_or_owner_delete"
  on public.group_members for delete to authenticated
  using (
    user_id = auth.uid()
    or (
      role = 'owner'
      and public.is_group_member(group_id, auth.uid())
    )
  );

-- ── Fix create_trip: switch from security invoker to security definer ─────────
-- The security invoker RPC queries group_members as the auth user, triggering RLS.
-- Switching to SECURITY DEFINER (like create_invite/accept_invite) avoids this.
create or replace function public.create_trip(
  p_title       text,
  p_destination text,
  p_start_date  date,
  p_end_date    date,
  p_is_domestic boolean,
  p_currencies  text[]
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid      uuid := auth.uid();
  v_group_id uuid;
  v_trip_id  uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;

  select gm.group_id into v_group_id
    from public.group_members gm
    join public.groups g on g.id = gm.group_id
    where gm.user_id = v_uid and g.status = 'active' limit 1;

  insert into public.trips(created_by, group_id, title, destination, start_date, end_date, is_domestic, currencies)
    values (v_uid, v_group_id, p_title, p_destination, p_start_date, p_end_date, p_is_domestic, p_currencies)
    returning id into v_trip_id;

  insert into public.trip_days(trip_id, day_number, date)
  select v_trip_id, row_number() over (order by d)::int, d::date
  from generate_series(p_start_date, p_end_date, '1 day'::interval) d;

  return v_trip_id;
end $$;
revoke all on function public.create_trip(text,text,date,date,boolean,text[]) from public;
grant execute on function public.create_trip(text,text,date,date,boolean,text[]) to authenticated;

-- ── Fix resize_trip_days: same security invoker issue ────────────────────────
create or replace function public.resize_trip_days(
  p_trip_id  uuid,
  p_new_start date,
  p_new_end   date
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid      uuid := auth.uid();
  v_owner    uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  if p_new_start > p_new_end then raise exception 'invalid_date_range'; end if;

  select created_by into v_owner from public.trips where id = p_trip_id;
  if v_owner is null or v_owner != v_uid then
    raise exception 'trip_not_found_or_forbidden';
  end if;

  -- Update the trip dates
  update public.trips
    set start_date = p_new_start, end_date = p_new_end
    where id = p_trip_id;

  -- Rebuild trip_days
  delete from public.trip_days where trip_id = p_trip_id;
  insert into public.trip_days(trip_id, day_number, date)
  select p_trip_id, row_number() over (order by d)::int, d::date
  from generate_series(p_new_start, p_new_end, '1 day'::interval) d;
end $$;
revoke all on function public.resize_trip_days(uuid,date,date) from public;
grant execute on function public.resize_trip_days(uuid,date,date) to authenticated;

-- ── RPC: query_publication_tables (for integration audit test) ───────────────
-- pg_publication_tables is in pg_catalog, not queryable via PostgREST directly.
-- This SECURITY DEFINER function exposes just the tablename for supabase_realtime.
create or replace function public.query_publication_tables()
returns table(tablename text)
language sql
security definer
stable
set search_path = public
as $$
  select tablename::text
  from pg_publication_tables
  where pubname = 'supabase_realtime';
$$;
revoke all on function public.query_publication_tables() from public;
grant execute on function public.query_publication_tables() to authenticated;

-- ── ROLLBACK ─────────────────────────────────────────────────────────────────
-- drop function if exists public.query_publication_tables();
-- drop function if exists public.resize_trip_days(uuid,date,date); -- (recreate original)
-- drop function if exists public.create_trip(text,text,date,date,boolean,text[]); -- (recreate original)
-- drop policy if exists "group_members_self_or_owner_delete" on public.group_members;
-- drop policy if exists "group_members_select_own_group" on public.group_members;
-- create policy "group_members_select_own_group" ...  (original recursive version)
-- drop function if exists public.is_group_member(uuid, uuid);
