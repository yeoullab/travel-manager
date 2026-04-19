-- 0002_groups.sql
-- Phase 2: groups + group_members 테이블 + RLS + 트리거 + RPC
-- 의존: 0001_profiles.sql (profiles 테이블)

-- ── profiles.display_name CHECK (Patch L — Phase 1 누락 보강) ──────────
alter table public.profiles
  add constraint profiles_display_name_length
    check (display_name is null or char_length(display_name) <= 40);

-- ── groups 테이블 ─────────────────────────────────────────────────────
create table public.groups (
  id           uuid        primary key default gen_random_uuid(),
  invite_code  uuid        unique not null default gen_random_uuid(),
  status       text        not null check (status in ('pending','active','cancelled','dissolved')),
  max_members  int         not null default 2,
  created_by   uuid        not null references public.profiles(id),
  created_at   timestamptz not null default now()
);

-- ── group_members 테이블 ─────────────────────────────────────────────
-- (groups보다 먼저 생성: groups RLS에서 group_members를 참조하므로)
create table public.group_members (
  id         uuid        primary key default gen_random_uuid(),
  group_id   uuid        not null references public.groups(id) on delete cascade,
  user_id    uuid        not null references public.profiles(id),
  role       text        not null check (role in ('owner','member')),
  joined_at  timestamptz not null default now(),
  unique (group_id, user_id)
);

-- ── 인덱스 ───────────────────────────────────────────────────────────
create index idx_groups_invite       on public.groups(invite_code) where status = 'pending';
create index idx_group_members_user  on public.group_members(user_id);
create index idx_group_members_group on public.group_members(group_id);

-- ── RLS 활성화 ───────────────────────────────────────────────────────
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;

-- INSERT 는 GRANT 에서 제거 (RPC 경유만)
revoke insert on public.group_members from authenticated;

-- ── groups RLS ───────────────────────────────────────────────────────
create policy "groups_select_member_or_owner"
  on public.groups for select to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = groups.id and gm.user_id = auth.uid()
    )
  );

create policy "groups_insert_owner"
  on public.groups for insert to authenticated
  with check (auth.uid() = created_by);

create policy "groups_update_owner"
  on public.groups for update to authenticated
  using (created_by = auth.uid() and status != 'dissolved' and status != 'cancelled')
  with check (created_by = auth.uid());

-- DELETE 없음: 상태 전이로만 표현

-- ── groups_with_invite view (invite_code 는 오너만) ──────────────────
create view public.groups_with_invite
  with (security_invoker = true) as
  select id, invite_code, status, created_at
  from public.groups
  where created_by = auth.uid();
grant select on public.groups_with_invite to authenticated;

-- ── group_members RLS ─────────────────────────────────────────────────
create policy "group_members_select_own_group"
  on public.group_members for select to authenticated
  using (
    exists (
      select 1 from public.group_members me
      where me.group_id = group_members.group_id and me.user_id = auth.uid()
    )
  );

create policy "group_members_no_direct_insert"
  on public.group_members for insert to authenticated
  with check (false);

create policy "group_members_update_own_row"
  on public.group_members for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

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

-- ── 트리거: active group 유저당 1개 제약 ────────────────────────────
create or replace function public.check_active_group_uniqueness()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from public.group_members gm
    join public.groups g on g.id = gm.group_id
    where gm.user_id = new.user_id
      and g.status = 'active'
      and (tg_op = 'INSERT' or gm.id != new.id)
  ) then
    raise exception 'user_already_in_active_group';
  end if;
  return new;
end $$;

create trigger group_members_active_uniqueness
  before insert on public.group_members
  for each row execute function public.check_active_group_uniqueness();

-- ── 트리거: groups 상태 전이 검증 ────────────────────────────────────
create or replace function public.enforce_group_status_transition()
returns trigger language plpgsql security invoker as $$
begin
  if old.status = 'pending' and new.status not in ('pending','active','cancelled') then
    raise exception 'group_invalid_transition_from_pending';
  end if;
  if old.status = 'active' and new.status not in ('active','dissolved') then
    raise exception 'group_invalid_transition_from_active';
  end if;
  if old.status = 'cancelled' and new.status != 'cancelled' then
    raise exception 'group_cannot_revive_cancelled';
  end if;
  if old.status = 'dissolved' and new.status != 'dissolved' then
    raise exception 'group_cannot_revive_dissolved';
  end if;
  return new;
end $$;

create trigger groups_status_transition
  before update on public.groups
  for each row execute function public.enforce_group_status_transition();

-- ── 트리거: dissolve → trips.group_id fanout ─────────────────────────
-- (trips 테이블이 아직 없으므로 body 는 비워두고 0003_trips.sql 에서 CREATE OR REPLACE)
create or replace function public.on_group_dissolved()
returns trigger language plpgsql security invoker as $$
begin
  return new; -- 0003_trips.sql 에서 body 교체
end $$;

create trigger groups_dissolution_fanout
  after update on public.groups
  for each row execute function public.on_group_dissolved();

-- ── RPC: create_invite ───────────────────────────────────────────────
create or replace function public.create_invite()
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_group_id uuid;
  v_code    uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;

  if exists (
    select 1 from public.group_members gm
    join public.groups g on g.id = gm.group_id
    where gm.user_id = v_uid and g.status = 'active'
  ) then raise exception 'already_in_active_group'; end if;

  select id, invite_code into v_group_id, v_code
    from public.groups where created_by = v_uid and status = 'pending' limit 1;
  if v_group_id is not null then
    return json_build_object('group_id', v_group_id, 'invite_code', v_code, 'reused', true);
  end if;

  insert into public.groups(created_by, status)
    values (v_uid, 'pending')
    returning id, invite_code into v_group_id, v_code;
  insert into public.group_members(group_id, user_id, role)
    values (v_group_id, v_uid, 'owner');
  return json_build_object('group_id', v_group_id, 'invite_code', v_code, 'reused', false);
end $$;
revoke all on function public.create_invite() from public;
grant execute on function public.create_invite() to authenticated;

-- ── RPC: accept_invite ───────────────────────────────────────────────
create or replace function public.accept_invite(p_invite_code uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_group_id uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;

  if exists (select 1 from public.groups where invite_code = p_invite_code and created_by = v_uid) then
    raise exception 'cannot_accept_own_invite';
  end if;

  if exists (
    select 1 from public.group_members gm
    join public.groups g on g.id = gm.group_id
    where gm.user_id = v_uid and g.status = 'active'
  ) then raise exception 'already_in_active_group'; end if;

  update public.groups set status = 'active'
    where invite_code = p_invite_code and status = 'pending'
    returning id into v_group_id;
  if v_group_id is null then raise exception 'invite_invalid_or_consumed'; end if;

  insert into public.group_members(group_id, user_id, role)
    values (v_group_id, v_uid, 'member');

  return json_build_object('group_id', v_group_id, 'status', 'active');
end $$;
revoke all on function public.accept_invite(uuid) from public;
grant execute on function public.accept_invite(uuid) to authenticated;

-- ── RPC: cancel_invite ───────────────────────────────────────────────
create or replace function public.cancel_invite()
returns void language plpgsql security invoker set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  update public.groups set status = 'cancelled'
    where status = 'pending' and created_by = v_uid;
  if not found then raise exception 'no_pending_invite'; end if;
end $$;
revoke all on function public.cancel_invite() from public;
grant execute on function public.cancel_invite() to authenticated;

-- ── RPC: dissolve_group ──────────────────────────────────────────────
create or replace function public.dissolve_group()
returns void language plpgsql security invoker set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  update public.groups set status = 'dissolved'
    where status = 'active' and created_by = v_uid;
  if not found then raise exception 'no_active_group'; end if;
end $$;
revoke all on function public.dissolve_group() from public;
grant execute on function public.dissolve_group() to authenticated;

-- ── ROLLBACK (역순) ──────────────────────────────────────────────────
-- drop function if exists public.dissolve_group();
-- drop function if exists public.cancel_invite();
-- drop function if exists public.accept_invite(uuid);
-- drop function if exists public.create_invite();
-- drop trigger if exists groups_dissolution_fanout on public.groups;
-- drop function if exists public.on_group_dissolved();
-- drop trigger if exists groups_status_transition on public.groups;
-- drop function if exists public.enforce_group_status_transition();
-- drop trigger if exists group_members_active_uniqueness on public.group_members;
-- drop function if exists public.check_active_group_uniqueness();
-- drop view if exists public.groups_with_invite;
-- drop table if exists public.group_members;
-- drop table if exists public.groups;
-- alter table public.profiles drop constraint if exists profiles_display_name_length;
