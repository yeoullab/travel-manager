-- 0001_profiles.sql
-- Phase 1: profiles 테이블 + auto-create trigger + RLS + 공개 view
-- 스펙 §5.profiles, §RLS profiles ("이메일은 본인만"), ADR-007 (color 6색 팔레트)

-- ── 테이블 ────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  color text not null default 'orange'
    check (color in ('orange','blue','gold','violet','green','rose')),
  created_at timestamptz not null default now()
);

comment on column public.profiles.color is
  'ADR-007 6색 팔레트. DESIGN.md 토큰과 1:1 매핑.';

-- ── auth.users → profiles 자동 생성 trigger ────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  resolved_name text := coalesce(
    meta->>'name',
    meta->>'full_name',
    meta->>'preferred_username',
    new.email
  );
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    resolved_name,
    coalesce(meta->>'avatar_url', meta->>'picture')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── RLS (테이블) ──────────────────────────────────────────────────────
alter table public.profiles enable row level security;

create policy "profiles_self_select"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_self_update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ── 공개 컬럼 view ────────────────────────────────────────────────────
create view public.profiles_public
with (security_invoker = true) as
  select id, display_name, avatar_url, color, created_at
  from public.profiles;

create policy "profiles_others_public_columns"
  on public.profiles for select
  to authenticated
  using (auth.uid() <> id);

revoke all on public.profiles from anon, authenticated;
grant select (id, display_name, avatar_url, color, created_at) on public.profiles to authenticated;
grant update (display_name, avatar_url, color) on public.profiles to authenticated;

grant select on public.profiles_public to authenticated;

-- ── ROLLBACK 절차 (수동, 회귀 시 참조) ───────────────────────────────
-- begin;
--   drop view if exists public.profiles_public;
--   drop policy if exists "profiles_others_public_columns" on public.profiles;
--   drop policy if exists "profiles_self_update" on public.profiles;
--   drop policy if exists "profiles_self_select" on public.profiles;
--   drop trigger if exists on_auth_user_created on auth.users;
--   drop function if exists public.handle_new_user();
--   drop table if exists public.profiles;     -- ⚠ 사용자 데이터 손실
-- commit;
