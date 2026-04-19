-- 0003_trips.sql
-- Phase 2: trips + trip_days + helper + RPC + Realtime publication 관리
-- 의존: 0002_groups.sql

-- ── trips 테이블 ─────────────────────────────────────────────────────
create table public.trips (
  id           uuid        primary key default gen_random_uuid(),
  group_id     uuid        references public.groups(id) on delete set null,
  created_by   uuid        not null references public.profiles(id),
  title        text        not null,
  destination  text        not null,
  start_date   date        not null,
  end_date     date        not null,
  is_domestic  boolean     not null default true,
  currencies   text[]      not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint trips_title_length        check (char_length(title) between 1 and 100),
  constraint trips_destination_length  check (char_length(destination) between 1 and 100),
  constraint trips_date_range          check (end_date >= start_date),
  constraint trips_duration_max        check (end_date - start_date <= 90),
  constraint trips_currencies_count    check (array_length(currencies, 1) is null or array_length(currencies, 1) <= 5)
);

create index idx_trips_created_by on public.trips(created_by);
create index idx_trips_group      on public.trips(group_id);

alter table public.trips enable row level security;

-- ── Helper: can_access_trip (SECURITY DEFINER, RLS 재귀 회피) ────────
create or replace function public.can_access_trip(p_trip_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_created_by uuid;
  v_group_id   uuid;
begin
  if v_uid is null then return false; end if;
  select created_by, group_id into v_created_by, v_group_id
    from public.trips where id = p_trip_id;
  if v_created_by is null then return false; end if;
  if v_created_by = v_uid then return true; end if;
  if v_group_id is null then return false; end if;
  return exists (
    select 1 from public.group_members gm
    join public.groups g on g.id = gm.group_id
    where gm.user_id = v_uid and gm.group_id = v_group_id and g.status = 'active'
  );
end;
$$;
revoke all on function public.can_access_trip(uuid) from public;
grant execute on function public.can_access_trip(uuid) to authenticated;

-- ── trips RLS ────────────────────────────────────────────────────────
create policy "trips_select"
  on public.trips for select to authenticated
  using (public.can_access_trip(id));

create policy "trips_insert"
  on public.trips for insert to authenticated
  with check (auth.uid() = created_by);

create policy "trips_update"
  on public.trips for update to authenticated
  using (public.can_access_trip(id) and created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "trips_delete"
  on public.trips for delete to authenticated
  using (auth.uid() = created_by);

-- ── trip_days 테이블 ─────────────────────────────────────────────────
create table public.trip_days (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips(id) on delete cascade,
  day_number int  not null,
  date       date not null,
  unique (trip_id, day_number)
);

create index idx_trip_days_trip on public.trip_days(trip_id);

alter table public.trip_days enable row level security;

create policy "trip_days_all"
  on public.trip_days for all to authenticated
  using (public.can_access_trip(trip_id))
  with check (public.can_access_trip(trip_id));

-- ── 트리거: updated_at 자동 갱신 ────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

-- ── 트리거: on_group_dissolved body 교체 ────────────────────────────
create or replace function public.on_group_dissolved()
returns trigger language plpgsql security invoker as $$
begin
  if new.status = 'dissolved' and old.status = 'active' then
    update public.trips set group_id = null where group_id = new.id;
  end if;
  return new;
end $$;

-- ── RPC: create_trip ─────────────────────────────────────────────────
create or replace function public.create_trip(
  p_title       text,
  p_destination text,
  p_start_date  date,
  p_end_date    date,
  p_is_domestic boolean,
  p_currencies  text[]
) returns uuid language plpgsql security invoker set search_path = public as $$
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

-- ── RPC: resize_trip_days ────────────────────────────────────────────
create or replace function public.resize_trip_days(
  p_trip_id   uuid,
  p_new_start date,
  p_new_end   date
) returns void language plpgsql security invoker set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_owner uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  if p_new_start > p_new_end then raise exception 'invalid_date_range'; end if;

  select created_by into v_owner from public.trips where id = p_trip_id;
  if v_owner is null or v_owner != v_uid then
    raise exception 'trip_not_found_or_forbidden';
  end if;

  update public.trips set start_date = p_new_start, end_date = p_new_end
    where id = p_trip_id;

  delete from public.trip_days where trip_id = p_trip_id;
  insert into public.trip_days(trip_id, day_number, date)
  select p_trip_id, row_number() over (order by d)::int, d::date
  from generate_series(p_new_start, p_new_end, '1 day'::interval) d;
  -- Phase 3 확장 지점: DELETE 전 schedule_items → last-kept day 재배치 로직 삽입
end $$;
revoke all on function public.resize_trip_days(uuid,date,date) from public;
grant execute on function public.resize_trip_days(uuid,date,date) to authenticated;

-- ── Realtime publication 관리 ────────────────────────────────────────
-- profiles 는 email 컬럼 WebSocket 누출 방지를 위해 의도적으로 제외
-- profiles 는 publication 에 포함돼 있을 경우에만 제거 (조건부 실행)
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime drop table public.profiles;
  end if;
end $$;
alter publication supabase_realtime add table public.trips;
-- group_members / groups 는 이미 publication 에 없을 경우에만 추가
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'group_members'
  ) then
    alter publication supabase_realtime add table public.group_members;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'groups'
  ) then
    alter publication supabase_realtime add table public.groups;
  end if;
end $$;

-- ── ROLLBACK (역순) ──────────────────────────────────────────────────
-- alter publication supabase_realtime drop table public.groups;
-- alter publication supabase_realtime drop table public.group_members;
-- alter publication supabase_realtime drop table public.trips;
-- alter publication supabase_realtime add table public.profiles;
-- drop function if exists public.resize_trip_days(uuid,date,date);
-- drop function if exists public.create_trip(text,text,date,date,boolean,text[]);
-- drop trigger if exists trips_set_updated_at on public.trips;
-- drop function if exists public.set_updated_at();
-- drop table if exists public.trip_days;
-- drop policy if exists "trips_delete" on public.trips;
-- drop policy if exists "trips_update" on public.trips;
-- drop policy if exists "trips_insert" on public.trips;
-- drop policy if exists "trips_select" on public.trips;
-- drop function if exists public.can_access_trip(uuid);
-- drop table if exists public.trips;
