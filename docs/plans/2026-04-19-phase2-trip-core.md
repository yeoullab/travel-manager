# Phase 2 — Trip Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 1(인증·프로필) 위에 여행 CRUD + 커플 그룹 연결 + trips 리스트 Realtime을 얹어, "파트너와 함께 여행 목록을 공유하는" 기반 체감을 실 데이터로 완성한다.

**Architecture:** TanStack Query가 캐싱·무효화 단일 진입점. Supabase RPC(SECURITY DEFINER)로 복잡한 비즈니스 로직 캡슐화, RLS로 행 수준 보안 강제. `<RealtimeGateway />`가 전역 Postgres Changes 3채널 구독을 lifecycle 관리하고 수신 이벤트를 QueryClient invalidate로 연결.

**Tech Stack:** Next.js 16 App Router · TypeScript strict · `@supabase/supabase-js@^2` · `@supabase/ssr@^0.5` · `@tanstack/react-query@^5` · `zustand@^5` · `zod@^3` · `vitest@^2` · `@playwright/test` · Supabase CLI

---

## Pre-flight (사용자 확인)

| 항목 | 확인 방법 |
|---|---|
| Phase 1 완료 (`pnpm build` 0 에러, tag `phase-1-foundation-auth`) | `git tag \| grep phase-1` |
| Supabase CLI 로그인 + 프로젝트 링크 | `supabase status` |
| `.env.local` 값 완비 | `pnpm exec vitest run tests/unit/env.test.ts` |
| Supabase Dashboard → Database → Publications → `supabase_realtime` | 수동 육안 확인: profiles가 포함돼 있으면 Task 5에서 제거 예정 |
| alice/bob 테스트 유저 (integration fixture) | Phase 1 에서 생성된 유저 재사용 또는 신규 생성 |

---

## Risks

| ID | Sev | 리스크 | 대응 |
|---|---|---|---|
| R1 | High | Realtime 이벤트 유실 (무료 tier 200 concurrent) | 재연결 시 `['trips','list']` invalidate 복구. E2E 5초 soft 타임아웃 |
| R2 | High | `accept_invite` race 20회 루프 flaky | `UPDATE ... RETURNING` atomic 패턴으로 race-safe |
| R3 | Med | `resize_trip_days` Phase 3 확장 시 atomicity | Phase 2 7 케이스 baseline → Phase 3 diff 회귀 감지 |
| R4 | Med | Mock factory production 번들 포함 | `NODE_ENV==='production'` throw + eslint guard |
| R5 | Med | `display_name` 40자 IME·emoji 경계 | 서버 40, UI 36 + live count |
| R6 | Med | supabase-js 업그레이드 → `update() never` 재발 | Phase 1 workaround 유지 + `pnpm db:types` 후 typecheck |

---

## Mock vs Real-DB Scope (Phase 2 종료 시점)

| 항목 | 상태 |
|---|---|
| `auth.users`, `public.profiles` | ✅ 실 DB (Phase 1) |
| `public.groups`, `group_members` | ✅ 실 DB (Phase 2 신규) |
| `public.trips`, `trip_days` | ✅ 실 DB (Phase 2 신규) |
| `schedule_items`, `expenses`, `todos`, `records`, `guest_shares` | ⚠️ mock (factory 재배선) |
| `/trips`, `/trips/new`, `/trips/[id]` shell+Manage, `/settings/*`, `/invite/[code]` | ✅ 실 DB |
| `/trips/[id]` 4 탭 | ⚠️ mock UI + 영구 배너 |
| Realtime trips/group_members/groups | ✅ 활성 |

---

## File Structure

**신규 생성:**
```
supabase/migrations/
├── 0002_groups.sql        # groups + group_members + RLS + trigger + RPC
└── 0003_trips.sql         # trips + trip_days + RLS + helper + RPC + Realtime pub

lib/
├── profile/
│   └── use-update-display-name.ts     # 신규
├── group/
│   ├── use-my-group.ts
│   ├── use-create-invite.ts
│   ├── use-accept-invite.ts
│   ├── use-cancel-invite.ts
│   ├── use-dissolve-group.ts
│   └── invite-url.ts
├── trip/
│   ├── use-trips-list.ts
│   ├── use-trip-detail.ts
│   ├── use-create-trip.ts
│   ├── use-update-trip.ts
│   ├── use-resize-trip-days.ts
│   ├── use-delete-trip.ts
│   ├── use-partner-share-toggle.ts
│   └── trip-grouping.ts
├── realtime/
│   ├── channel.ts                  # 기존 scaffold 확장
│   ├── trips-channel.ts
│   ├── group-members-channel.ts
│   ├── groups-channel.ts
│   └── use-realtime-gateway.ts
└── mocks/
    ├── trips.ts      → 삭제
    ├── groups.ts     → 삭제
    ├── factory.ts    # 신규
    ├── helpers.ts    # 축소
    └── index.ts      # 축소

app/
├── providers.tsx                  # + <RealtimeGateway />
├── settings/profile/page.tsx      # 신규
├── settings/couple/page.tsx       # 신규
└── invite/[code]/page.tsx         # mockup → accept_invite 실연결

components/
├── trip/
│   ├── edit-trip-modal.tsx        # 신규
│   ├── delete-trip-dialog.tsx     # 신규
│   ├── date-shrink-confirm.tsx    # 신규
│   └── trip-unavailable.tsx       # 신규
├── settings/
│   ├── profile-display-name.tsx   # 신규
│   └── couple-section.tsx         # 신규
├── invite/
│   ├── invite-accept-card.tsx     # mockup → 실연결
│   └── invite-copy-screen.tsx     # 신규
└── realtime/
    └── realtime-gateway.tsx       # 신규

tests/
├── unit/
│   ├── trip-grouping.test.ts      # 신규
│   ├── invite-url.test.ts         # 신규
│   └── trip-date-validation.test.ts  # 신규
├── integration/
│   ├── rls-groups.test.ts
│   ├── rls-trips.test.ts
│   ├── accept-invite-race.test.ts
│   ├── create-invite-idempotent.test.ts
│   ├── cancel-invite.test.ts
│   ├── create-trip.test.ts
│   ├── resize-trip-days.test.ts
│   ├── dissolve-group-cascade.test.ts
│   ├── updated-at-trigger.test.ts
│   ├── realtime-publication-audit.test.ts
│   └── display-name-xss.test.ts
└── e2e/
    ├── invite-flow.spec.ts
    ├── trip-crud.spec.ts
    ├── partner-realtime.spec.ts
    ├── dissolution.spec.ts
    └── share-toggle.spec.ts
```

**수정:**
- `lib/query/keys.ts` — trip/group 키 추가
- `types/database.ts` — `pnpm db:types` 재생성
- `app/trips/page.tsx` — useTripsList 배선
- `app/trips/new/page.tsx` — useCreateTrip 배선
- `app/trips/[id]/page.tsx` — useTripDetail + TripUnavailable 분기
- `app/settings/page.tsx` — 링크 허브 업데이트

---

## Verification Targets

1. `pnpm build` — TypeScript 0 에러
2. `pnpm test` unit — pass, `lib/trip/`, `lib/group/`, `lib/realtime/` ≥ 80% coverage
3. `pnpm test:integration` — 11 spec 전수 pass, race 20회 deterministic
4. `pnpm exec playwright test` — 6 E2E pass, flaky 허용 0
5. `pnpm audit --production` — high/critical 0
6. `pnpm lint` — 0 error
7. Verification SQL 6쿼리 예상 결과 매칭
8. `types/database.ts` 최신 (`pnpm db:types` diff 없음)
9. 수동 검증 시나리오 11종 통과 (실 Google 계정 2개)

---

## Tasks

### Task 1: DB 마이그레이션 — `0002_groups.sql`

**Files:**
- Create: `supabase/migrations/0002_groups.sql`

- [ ] **Step 1: 마이그레이션 파일 생성**

```bash
supabase migration new 0002_groups
```
생성된 파일 경로를 확인한다 (`supabase/migrations/YYYYMMDD_0002_groups.sql` 또는 `0002_groups.sql`). 파일명을 `0002_groups.sql`로 맞춘다.

- [ ] **Step 2: SQL 작성**

`supabase/migrations/0002_groups.sql` 전체 내용:

```sql
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

create index idx_groups_invite on public.groups(invite_code) where status = 'pending';

alter table public.groups enable row level security;

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

-- ── group_members 테이블 ─────────────────────────────────────────────
create table public.group_members (
  id         uuid        primary key default gen_random_uuid(),
  group_id   uuid        not null references public.groups(id) on delete cascade,
  user_id    uuid        not null references public.profiles(id),
  role       text        not null check (role in ('owner','member')),
  joined_at  timestamptz not null default now(),
  unique (group_id, user_id)
);

create index idx_group_members_user  on public.group_members(user_id);
create index idx_group_members_group on public.group_members(group_id);

alter table public.group_members enable row level security;

-- INSERT 는 GRANT 에서 제거 (RPC 경유만)
revoke insert on public.group_members from authenticated;

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
```

- [ ] **Step 3: 마이그레이션 적용**

```bash
supabase db push
```
Expected: `Applied 1 migration` 또는 `Applying migration 0002_groups.sql`

- [ ] **Step 4: 적용 확인 (Supabase Studio 또는 SQL)**

```sql
select tablename from pg_tables where schemaname='public' order by tablename;
-- Expected: group_members, groups, profiles 포함
```

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/0002_groups.sql
git commit -m "feat(db): add groups + group_members migration with RLS and RPCs"
```

---

### Task 2: DB 마이그레이션 — `0003_trips.sql`

**Files:**
- Create: `supabase/migrations/0003_trips.sql`

- [ ] **Step 1: 마이그레이션 파일 생성**

```bash
supabase migration new 0003_trips
```
파일명을 `0003_trips.sql`로 맞춘다.

- [ ] **Step 2: SQL 작성**

`supabase/migrations/0003_trips.sql` 전체 내용:

```sql
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
alter publication supabase_realtime drop table if exists public.profiles;
alter publication supabase_realtime add table public.trips;
alter publication supabase_realtime add table public.group_members;
alter publication supabase_realtime add table public.groups;

-- ── ROLLBACK (역순) ──────────────────────────────────────────────────
-- alter publication supabase_realtime drop table if exists public.groups;
-- alter publication supabase_realtime drop table if exists public.group_members;
-- alter publication supabase_realtime drop table if exists public.trips;
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
```

- [ ] **Step 3: 마이그레이션 적용**

```bash
supabase db push
```
Expected: `Applied 1 migration`

- [ ] **Step 4: Verification SQL 실행 (Supabase Studio SQL Editor)**

```sql
-- (1) 정책 확인
select tablename, policyname from pg_policies
where schemaname='public' and tablename in ('groups','group_members','trips','trip_days')
order by tablename, policyname;

-- (2) Realtime publication (profiles 없음, 3개만)
select tablename from pg_publication_tables where pubname='supabase_realtime';

-- (3) RLS 활성 여부
select relname, relrowsecurity from pg_class
where relnamespace='public'::regnamespace and relname in ('groups','group_members','trips','trip_days');
-- Expected: 모두 t
```

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/0003_trips.sql
git commit -m "feat(db): add trips + trip_days migration with helper, RPCs, Realtime pub"
```

---

### Task 3: TypeScript 타입 재생성 + query keys 확장

**Files:**
- Modify: `types/database.ts` (자동 생성)
- Modify: `lib/query/keys.ts`

- [ ] **Step 1: 타입 재생성**

```bash
pnpm db:types
```
Expected: `types/database.ts` 가 갱신되어 `groups`, `group_members`, `trips`, `trip_days` Row/Insert/Update 타입 포함.

- [ ] **Step 2: `lib/query/keys.ts` 수정**

```ts
export const queryKeys = {
  profile: {
    me: ["profile", "me"] as const,
    byId: (id: string) => ["profile", "byId", id] as const,
  },
  tripMembers: {
    byTripId: (tripId: string) => ["tripMembers", tripId] as const,
  },
  trips: {
    all: ["trips"] as const,
    list: ["trips", "list"] as const,
    detail: (id: string) => ["trips", "detail", id] as const,
  },
  group: {
    me: ["group", "me"] as const,
  },
} as const;
```

- [ ] **Step 3: TypeScript 컴파일 확인**

```bash
pnpm tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 4: 커밋**

```bash
git add types/database.ts lib/query/keys.ts
git commit -m "feat(types): regenerate DB types and extend query keys for trips/group"
```

---

### Task 4: Unit 테스트 — trip-grouping, invite-url, trip-date-validation

**Files:**
- Create: `tests/unit/trip-grouping.test.ts`
- Create: `tests/unit/invite-url.test.ts`
- Create: `tests/unit/trip-date-validation.test.ts`
- Create: `lib/trip/trip-grouping.ts`
- Create: `lib/group/invite-url.ts`
- Create: `lib/trip/trip-date-validation.ts`

- [ ] **Step 1: `tests/unit/trip-grouping.test.ts` 작성**

```ts
import { describe, expect, it } from "vitest";
import { groupTripsByStatus } from "@/lib/trip/trip-grouping";
import type { Database } from "@/types/database";

type TripRow = Database["public"]["Tables"]["trips"]["Row"];

function makeTrip(overrides: Partial<TripRow>): TripRow {
  const today = new Date().toISOString().split("T")[0];
  return {
    id: "00000000-0000-0000-0000-000000000001",
    group_id: null,
    created_by: "00000000-0000-0000-0000-000000000002",
    title: "Test Trip",
    destination: "Seoul",
    start_date: today,
    end_date: today,
    is_domestic: true,
    currencies: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("groupTripsByStatus", () => {
  it("오늘 포함 여행은 ongoing", () => {
    const today = new Date().toISOString().split("T")[0];
    const trip = makeTrip({ start_date: today, end_date: today });
    const result = groupTripsByStatus([trip]);
    expect(result.ongoing).toHaveLength(1);
    expect(result.upcoming).toHaveLength(0);
    expect(result.past).toHaveLength(0);
  });

  it("미래 시작 여행은 upcoming", () => {
    const future = new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0];
    const trip = makeTrip({ start_date: future, end_date: future });
    const result = groupTripsByStatus([trip]);
    expect(result.upcoming).toHaveLength(1);
  });

  it("어제 종료 여행은 past", () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const trip = makeTrip({ start_date: yesterday, end_date: yesterday });
    const result = groupTripsByStatus([trip]);
    expect(result.past).toHaveLength(1);
  });

  it("빈 배열은 모두 0", () => {
    const result = groupTripsByStatus([]);
    expect(result.ongoing).toHaveLength(0);
    expect(result.upcoming).toHaveLength(0);
    expect(result.past).toHaveLength(0);
  });
});
```

- [ ] **Step 2: `tests/unit/invite-url.test.ts` 작성**

```ts
import { describe, expect, it } from "vitest";
import { buildInviteUrl, extractInviteCode } from "@/lib/group/invite-url";

describe("invite-url", () => {
  it("buildInviteUrl 은 /invite/{code} 경로를 포함한다", () => {
    const code = "123e4567-e89b-12d3-a456-426614174000";
    const url = buildInviteUrl(code, "https://example.com");
    expect(url).toBe("https://example.com/invite/123e4567-e89b-12d3-a456-426614174000");
  });

  it("extractInviteCode 는 UUID 형식이면 그대로 반환", () => {
    const code = "123e4567-e89b-12d3-a456-426614174000";
    expect(extractInviteCode(code)).toBe(code);
  });

  it("extractInviteCode 는 비 UUID 형식이면 null 반환", () => {
    expect(extractInviteCode("not-a-uuid")).toBeNull();
  });
});
```

- [ ] **Step 3: `tests/unit/trip-date-validation.test.ts` 작성**

```ts
import { describe, expect, it } from "vitest";
import { validateTripDates } from "@/lib/trip/trip-date-validation";

describe("validateTripDates", () => {
  it("start <= end 이면 통과", () => {
    expect(validateTripDates("2026-05-01", "2026-05-10")).toBeNull();
  });

  it("start > end 이면 에러 반환", () => {
    const err = validateTripDates("2026-05-10", "2026-05-01");
    expect(err).toBe("종료일은 시작일 이후로 설정해주세요");
  });

  it("90일 초과면 에러 반환", () => {
    const err = validateTripDates("2026-01-01", "2026-04-02"); // 91일
    expect(err).toBe("여행 기간은 최대 90일까지 설정 가능해요");
  });

  it("정확히 90일은 통과", () => {
    expect(validateTripDates("2026-01-01", "2026-04-01")).toBeNull(); // 90일
  });
});
```

- [ ] **Step 4: 테스트 실행 — 실패 확인**

```bash
pnpm exec vitest run tests/unit/trip-grouping.test.ts tests/unit/invite-url.test.ts tests/unit/trip-date-validation.test.ts
```
Expected: FAIL (모듈 없음)

- [ ] **Step 5: `lib/trip/trip-grouping.ts` 구현**

```ts
import type { Database } from "@/types/database";

type TripRow = Database["public"]["Tables"]["trips"]["Row"];

export type TripStatus = "ongoing" | "upcoming" | "past";

export function getTripStatus(trip: TripRow, today = new Date()): TripStatus {
  const todayStr = today.toISOString().split("T")[0];
  if (trip.end_date < todayStr) return "past";
  if (trip.start_date > todayStr) return "upcoming";
  return "ongoing";
}

export function groupTripsByStatus(trips: TripRow[], today = new Date()) {
  const ongoing: TripRow[] = [];
  const upcoming: TripRow[] = [];
  const past: TripRow[] = [];
  for (const t of trips) {
    const s = getTripStatus(t, today);
    if (s === "ongoing") ongoing.push(t);
    else if (s === "upcoming") upcoming.push(t);
    else past.push(t);
  }
  return { ongoing, upcoming, past };
}
```

- [ ] **Step 6: `lib/group/invite-url.ts` 구현**

```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildInviteUrl(code: string, origin: string): string {
  return `${origin}/invite/${code}`;
}

export function extractInviteCode(code: string): string | null {
  return UUID_RE.test(code) ? code : null;
}
```

- [ ] **Step 7: `lib/trip/trip-date-validation.ts` 구현**

```ts
export function validateTripDates(start: string, end: string): string | null {
  if (start > end) return "종료일은 시작일 이후로 설정해주세요";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const days = Math.round(ms / 86400000);
  if (days > 90) return "여행 기간은 최대 90일까지 설정 가능해요";
  return null;
}
```

- [ ] **Step 8: 테스트 통과 확인**

```bash
pnpm exec vitest run tests/unit/trip-grouping.test.ts tests/unit/invite-url.test.ts tests/unit/trip-date-validation.test.ts
```
Expected: PASS (모두)

- [ ] **Step 9: 커밋**

```bash
git add lib/trip/trip-grouping.ts lib/group/invite-url.ts lib/trip/trip-date-validation.ts \
        tests/unit/trip-grouping.test.ts tests/unit/invite-url.test.ts tests/unit/trip-date-validation.test.ts
git commit -m "feat(lib): add trip-grouping, invite-url, trip-date-validation with unit tests"
```

---

### Task 5: Integration 테스트 — RLS groups + trips

**Files:**
- Create: `tests/integration/rls-groups.test.ts`
- Create: `tests/integration/rls-trips.test.ts`

- [ ] **Step 1: `tests/integration/rls-groups.test.ts` 작성**

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const STAMP = Date.now();
const ALICE_EMAIL = `alice+${STAMP}@test.local`;
const BOB_EMAIL = `bob+${STAMP}@test.local`;
const PWD = "Test_Pwd_2026!";
let aliceId = "";
let bobId = "";

async function clientFor(email: string) {
  const c = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PWD });
  if (error) throw error;
  return { c, userId: data.user!.id };
}

beforeAll(async () => {
  const a = await admin.auth.admin.createUser({ email: ALICE_EMAIL, password: PWD, email_confirm: true });
  if (a.error) throw a.error;
  aliceId = a.data.user!.id;
  const b = await admin.auth.admin.createUser({ email: BOB_EMAIL, password: PWD, email_confirm: true });
  if (b.error) throw b.error;
  bobId = b.data.user!.id;
});

afterAll(async () => {
  // group_members, groups 는 cascade 또는 직접 삭제
  await admin.from("group_members").delete().or(`user_id.eq.${aliceId},user_id.eq.${bobId}`);
  await admin.from("groups").delete().or(`created_by.eq.${aliceId},created_by.eq.${bobId}`);
  if (aliceId) await admin.auth.admin.deleteUser(aliceId);
  if (bobId) await admin.auth.admin.deleteUser(bobId);
});

describe("RLS — groups", () => {
  it("오너는 본인 그룹을 SELECT 할 수 있다", async () => {
    const { c } = await clientFor(ALICE_EMAIL);
    const { data: created } = await c.rpc("create_invite");
    const groupId = (created as { group_id: string }).group_id;

    const { data, error } = await c.from("groups").select("id, status").eq("id", groupId).single();
    expect(error).toBeNull();
    expect(data?.status).toBe("pending");

    // 정리
    await c.rpc("cancel_invite");
  });

  it("타인은 관계없는 그룹을 SELECT 할 수 없다", async () => {
    const { c: aliceC } = await clientFor(ALICE_EMAIL);
    await aliceC.rpc("create_invite");
    const { data: aliceGroup } = await aliceC.from("groups_with_invite").select("id").single();

    const { c: bobC } = await clientFor(BOB_EMAIL);
    const { data } = await bobC.from("groups").select("id").eq("id", aliceGroup!.id);
    expect(data).toHaveLength(0);

    await aliceC.rpc("cancel_invite");
  });

  it("group_members 직접 INSERT 는 RLS 차단", async () => {
    const { c } = await clientFor(ALICE_EMAIL);
    const { data: created } = await c.rpc("create_invite");
    const groupId = (created as { group_id: string }).group_id;

    // grant 에서 insert 가 revoke 되어 있으므로 PostgREST 가 403 반환
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (c as any).from("group_members").insert({ group_id: groupId, user_id: aliceId, role: "member" });
    expect(error).not.toBeNull();

    await c.rpc("cancel_invite");
  });

  it("오너는 invite_code 를 groups_with_invite 로만 조회 가능 (groups 직접 SELECT 불가)", async () => {
    const { c } = await clientFor(ALICE_EMAIL);
    await c.rpc("create_invite");

    const { data } = await c.from("groups").select("invite_code");
    // groups 테이블에는 invite_code 컬럼 GRANT 없음 — 빈 결과 또는 undefined
    for (const row of data ?? []) {
      expect((row as Record<string, unknown>).invite_code).toBeUndefined();
    }

    // groups_with_invite 로는 조회 가능
    const { data: view } = await c.from("groups_with_invite").select("invite_code").single();
    expect(view?.invite_code).toBeTruthy();

    await c.rpc("cancel_invite");
  });
});
```

- [ ] **Step 2: `tests/integration/rls-trips.test.ts` 작성**

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const STAMP = Date.now();
const ALICE_EMAIL = `alice_trips+${STAMP}@test.local`;
const BOB_EMAIL = `bob_trips+${STAMP}@test.local`;
const PWD = "Test_Pwd_2026!";
let aliceId = "";
let bobId = "";

async function clientFor(email: string) {
  const c = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PWD });
  if (error) throw error;
  return { c, userId: data.user!.id };
}

beforeAll(async () => {
  const a = await admin.auth.admin.createUser({ email: ALICE_EMAIL, password: PWD, email_confirm: true });
  if (a.error) throw a.error;
  aliceId = a.data.user!.id;
  const b = await admin.auth.admin.createUser({ email: BOB_EMAIL, password: PWD, email_confirm: true });
  if (b.error) throw b.error;
  bobId = b.data.user!.id;
});

afterAll(async () => {
  await admin.from("trips").delete().or(`created_by.eq.${aliceId},created_by.eq.${bobId}`);
  await admin.from("group_members").delete().or(`user_id.eq.${aliceId},user_id.eq.${bobId}`);
  await admin.from("groups").delete().or(`created_by.eq.${aliceId},created_by.eq.${bobId}`);
  if (aliceId) await admin.auth.admin.deleteUser(aliceId);
  if (bobId) await admin.auth.admin.deleteUser(bobId);
});

describe("RLS — trips", () => {
  it("오너는 본인 여행을 CRUD 할 수 있다", async () => {
    const { c } = await clientFor(ALICE_EMAIL);
    const tripId: string = await c.rpc("create_trip", {
      p_title: "Test", p_destination: "Seoul",
      p_start_date: "2026-06-01", p_end_date: "2026-06-03",
      p_is_domestic: true, p_currencies: ["KRW"],
    }).then((r) => r.data as string);
    expect(tripId).toBeTruthy();

    const { data } = await c.from("trips").select("id").eq("id", tripId).single();
    expect(data?.id).toBe(tripId);

    // DELETE
    const { error } = await c.from("trips").delete().eq("id", tripId);
    expect(error).toBeNull();
  });

  it("파트너(active group member)는 공유 여행을 SELECT 할 수 있다", async () => {
    const { c: aliceC } = await clientFor(ALICE_EMAIL);
    const { c: bobC } = await clientFor(BOB_EMAIL);

    // alice 가 invite 생성, bob 이 수락
    const { data: inv } = await aliceC.rpc("create_invite");
    const invCode = (inv as { invite_code: string }).invite_code;
    await bobC.rpc("accept_invite", { p_invite_code: invCode });

    const tripId: string = await aliceC.rpc("create_trip", {
      p_title: "Shared", p_destination: "Jeju",
      p_start_date: "2026-07-01", p_end_date: "2026-07-03",
      p_is_domestic: true, p_currencies: ["KRW"],
    }).then((r) => r.data as string);

    const { data, error } = await bobC.from("trips").select("id").eq("id", tripId).single();
    expect(error).toBeNull();
    expect(data?.id).toBe(tripId);

    // 정리
    await aliceC.from("trips").delete().eq("id", tripId);
    await aliceC.rpc("dissolve_group");
  });

  it("can_access_trip — stranger 는 false", async () => {
    const { c: aliceC } = await clientFor(ALICE_EMAIL);
    const { c: bobC } = await clientFor(BOB_EMAIL);

    const tripId: string = await aliceC.rpc("create_trip", {
      p_title: "Solo", p_destination: "Busan",
      p_start_date: "2026-08-01", p_end_date: "2026-08-02",
      p_is_domestic: true, p_currencies: [],
    }).then((r) => r.data as string);

    const { data } = await bobC.from("trips").select("id").eq("id", tripId);
    expect(data).toHaveLength(0);

    await aliceC.from("trips").delete().eq("id", tripId);
  });

  it("파트너는 여행 정보를 UPDATE 할 수 없다 (created_by 만 가능)", async () => {
    const { c: aliceC } = await clientFor(ALICE_EMAIL);
    const { c: bobC } = await clientFor(BOB_EMAIL);

    const { data: inv } = await aliceC.rpc("create_invite");
    const invCode = (inv as { invite_code: string }).invite_code;
    await bobC.rpc("accept_invite", { p_invite_code: invCode });

    const tripId: string = await aliceC.rpc("create_trip", {
      p_title: "Shared2", p_destination: "Daegu",
      p_start_date: "2026-09-01", p_end_date: "2026-09-02",
      p_is_domestic: true, p_currencies: [],
    }).then((r) => r.data as string);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error, count } = await (bobC as any).from("trips").update({ title: "Hacked" }, { count: "exact" }).eq("id", tripId);
    expect(error).toBeNull();
    expect(count).toBe(0);

    await aliceC.from("trips").delete().eq("id", tripId);
    await aliceC.rpc("dissolve_group");
  });
});
```

- [ ] **Step 3: 테스트 실행**

```bash
pnpm test:integration -- rls-groups rls-trips
```
Expected: 모든 테스트 PASS

- [ ] **Step 4: 커밋**

```bash
git add tests/integration/rls-groups.test.ts tests/integration/rls-trips.test.ts
git commit -m "test(integration): add RLS tests for groups and trips"
```

---

### Task 6: Integration 테스트 — RPC 시나리오 (invite race, create-trip, resize, dissolve)

**Files:**
- Create: `tests/integration/accept-invite-race.test.ts`
- Create: `tests/integration/create-invite-idempotent.test.ts`
- Create: `tests/integration/cancel-invite.test.ts`
- Create: `tests/integration/create-trip.test.ts`
- Create: `tests/integration/resize-trip-days.test.ts`
- Create: `tests/integration/dissolve-group-cascade.test.ts`
- Create: `tests/integration/updated-at-trigger.test.ts`
- Create: `tests/integration/realtime-publication-audit.test.ts`
- Create: `tests/integration/display-name-xss.test.ts`

- [ ] **Step 1: `tests/integration/accept-invite-race.test.ts`**

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
let aliceId = ""; let bobId = ""; let carolId = "";

async function clientFor(email: string) {
  const c = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password: PWD });
  return c;
}

beforeAll(async () => {
  for (const [varRef, email] of [[() => aliceId, `alice_race+${STAMP}@test.local`], [() => bobId, `bob_race+${STAMP}@test.local`], [() => carolId, `carol_race+${STAMP}@test.local`]] as const) {
    const { data, error } = await admin.auth.admin.createUser({ email: email as string, password: PWD, email_confirm: true });
    if (error) throw error;
    if (email.includes("alice")) aliceId = data.user!.id;
    else if (email.includes("bob")) bobId = data.user!.id;
    else carolId = data.user!.id;
  }
});

afterAll(async () => {
  await admin.from("group_members").delete().or(`user_id.eq.${aliceId},user_id.eq.${bobId},user_id.eq.${carolId}`);
  await admin.from("groups").delete().or(`created_by.eq.${aliceId}`);
  for (const id of [aliceId, bobId, carolId]) if (id) await admin.auth.admin.deleteUser(id);
});

describe("accept_invite race — 20회 루프", () => {
  it("동시 수락 시 1명만 성공하고 나머지는 invite_invalid_or_consumed", async () => {
    const aliceC = await clientFor(`alice_race+${STAMP}@test.local`);
    const bobC   = await clientFor(`bob_race+${STAMP}@test.local`);
    const carolC = await clientFor(`carol_race+${STAMP}@test.local`);

    for (let i = 0; i < 20; i++) {
      // alice 가 새 invite 생성
      await admin.from("group_members").delete().or(`user_id.eq.${bobId},user_id.eq.${carolId}`);
      await admin.from("groups").delete().or(`created_by.eq.${aliceId}`);
      const { data: inv } = await aliceC.rpc("create_invite");
      const code = (inv as { invite_code: string }).invite_code;

      const [r1, r2] = await Promise.all([
        bobC.rpc("accept_invite", { p_invite_code: code }),
        carolC.rpc("accept_invite", { p_invite_code: code }),
      ]);

      const successes = [r1, r2].filter((r) => !r.error).length;
      const failures  = [r1, r2].filter((r) => r.error?.message === "invite_invalid_or_consumed").length;
      expect(successes).toBe(1);
      expect(failures).toBe(1);

      // dissolve 해서 다음 회차 준비
      await aliceC.rpc("dissolve_group");
    }
  }, 60_000);
});
```

- [ ] **Step 2: `tests/integration/create-invite-idempotent.test.ts`**

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
let aliceId = "";

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({ email: `alice_idem+${STAMP}@test.local`, password: PWD, email_confirm: true });
  if (error) throw error;
  aliceId = data.user!.id;
});
afterAll(async () => {
  await admin.from("group_members").delete().eq("user_id", aliceId);
  await admin.from("groups").delete().eq("created_by", aliceId);
  await admin.auth.admin.deleteUser(aliceId);
});

describe("create_invite 멱등성", () => {
  it("두 번 호출 시 같은 invite_code 와 reused:true 반환", async () => {
    const c = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await c.auth.signInWithPassword({ email: `alice_idem+${STAMP}@test.local`, password: PWD });

    const { data: first } = await c.rpc("create_invite");
    const { data: second } = await c.rpc("create_invite");
    const f = first as { invite_code: string; reused: boolean };
    const s = second as { invite_code: string; reused: boolean };

    expect(f.invite_code).toBe(s.invite_code);
    expect(s.reused).toBe(true);

    await c.rpc("cancel_invite");
  });
});
```

- [ ] **Step 3: `tests/integration/cancel-invite.test.ts`**

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
let aliceId = ""; let bobId = "";

beforeAll(async () => {
  const a = await admin.auth.admin.createUser({ email: `alice_cancel+${STAMP}@test.local`, password: PWD, email_confirm: true });
  if (a.error) throw a.error; aliceId = a.data.user!.id;
  const b = await admin.auth.admin.createUser({ email: `bob_cancel+${STAMP}@test.local`, password: PWD, email_confirm: true });
  if (b.error) throw b.error; bobId = b.data.user!.id;
});
afterAll(async () => {
  await admin.from("group_members").delete().or(`user_id.eq.${aliceId},user_id.eq.${bobId}`);
  await admin.from("groups").delete().or(`created_by.eq.${aliceId}`);
  for (const id of [aliceId, bobId]) await admin.auth.admin.deleteUser(id);
});

describe("cancel_invite", () => {
  it("취소 후 같은 code 재수락 → invite_invalid_or_consumed", async () => {
    const aliceC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await aliceC.auth.signInWithPassword({ email: `alice_cancel+${STAMP}@test.local`, password: PWD });
    const bobC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await bobC.auth.signInWithPassword({ email: `bob_cancel+${STAMP}@test.local`, password: PWD });

    const { data: inv } = await aliceC.rpc("create_invite");
    const code = (inv as { invite_code: string }).invite_code;
    await aliceC.rpc("cancel_invite");

    const { error } = await bobC.rpc("accept_invite", { p_invite_code: code });
    expect(error?.message).toBe("invite_invalid_or_consumed");
  });

  it("cancelled 상태 그룹은 active 로 전이 불가 (트리거 차단)", async () => {
    const aliceC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await aliceC.auth.signInWithPassword({ email: `alice_cancel+${STAMP}@test.local`, password: PWD });
    await aliceC.rpc("create_invite");
    await aliceC.rpc("cancel_invite");

    const { data: grp } = await aliceC.from("groups").select("id").eq("created_by", aliceId).eq("status", "cancelled").single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).from("groups").update({ status: "active" }).eq("id", grp!.id);
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 4: `tests/integration/create-trip.test.ts`**

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
let aliceId = ""; let bobId = "";

beforeAll(async () => {
  const a = await admin.auth.admin.createUser({ email: `alice_trip+${STAMP}@test.local`, password: PWD, email_confirm: true });
  if (a.error) throw a.error; aliceId = a.data.user!.id;
  const b = await admin.auth.admin.createUser({ email: `bob_trip+${STAMP}@test.local`, password: PWD, email_confirm: true });
  if (b.error) throw b.error; bobId = b.data.user!.id;
});
afterAll(async () => {
  await admin.from("trips").delete().or(`created_by.eq.${aliceId},created_by.eq.${bobId}`);
  await admin.from("group_members").delete().or(`user_id.eq.${aliceId},user_id.eq.${bobId}`);
  await admin.from("groups").delete().or(`created_by.eq.${aliceId}`);
  for (const id of [aliceId, bobId]) await admin.auth.admin.deleteUser(id);
});

describe("create_trip RPC", () => {
  it("활성 그룹 없으면 group_id = null 로 생성", async () => {
    const c = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await c.auth.signInWithPassword({ email: `alice_trip+${STAMP}@test.local`, password: PWD });

    const tripId: string = await c.rpc("create_trip", {
      p_title: "Solo", p_destination: "Busan", p_start_date: "2026-06-01", p_end_date: "2026-06-02",
      p_is_domestic: true, p_currencies: [],
    }).then((r) => r.data as string);

    const { data } = await c.from("trips").select("group_id").eq("id", tripId).single();
    expect(data?.group_id).toBeNull();
    await c.from("trips").delete().eq("id", tripId);
  });

  it("활성 그룹 있으면 auto-link", async () => {
    const aliceC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await aliceC.auth.signInWithPassword({ email: `alice_trip+${STAMP}@test.local`, password: PWD });
    const bobC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await bobC.auth.signInWithPassword({ email: `bob_trip+${STAMP}@test.local`, password: PWD });

    const { data: inv } = await aliceC.rpc("create_invite");
    const code = (inv as { invite_code: string }).invite_code;
    await bobC.rpc("accept_invite", { p_invite_code: code });

    const tripId: string = await aliceC.rpc("create_trip", {
      p_title: "Shared", p_destination: "Jeju", p_start_date: "2026-07-01", p_end_date: "2026-07-03",
      p_is_domestic: true, p_currencies: ["KRW"],
    }).then((r) => r.data as string);

    const { data } = await aliceC.from("trips").select("group_id").eq("id", tripId).single();
    expect(data?.group_id).not.toBeNull();

    await aliceC.from("trips").delete().eq("id", tripId);
    await aliceC.rpc("dissolve_group");
  });

  it("title 101자 → CHECK 위반 거부", async () => {
    const c = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await c.auth.signInWithPassword({ email: `alice_trip+${STAMP}@test.local`, password: PWD });
    const { error } = await c.rpc("create_trip", {
      p_title: "A".repeat(101), p_destination: "Seoul", p_start_date: "2026-06-01", p_end_date: "2026-06-02",
      p_is_domestic: true, p_currencies: [],
    });
    expect(error).not.toBeNull();
  });

  it("기간 91일 → CHECK 위반 거부", async () => {
    const c = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await c.auth.signInWithPassword({ email: `alice_trip+${STAMP}@test.local`, password: PWD });
    const { error } = await c.rpc("create_trip", {
      p_title: "Long", p_destination: "Seoul", p_start_date: "2026-01-01", p_end_date: "2026-04-02",
      p_is_domestic: true, p_currencies: [],
    });
    expect(error).not.toBeNull();
  });

  it("currencies 6개 → CHECK 위반 거부", async () => {
    const c = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await c.auth.signInWithPassword({ email: `alice_trip+${STAMP}@test.local`, password: PWD });
    const { error } = await c.rpc("create_trip", {
      p_title: "Multi", p_destination: "Seoul", p_start_date: "2026-06-01", p_end_date: "2026-06-02",
      p_is_domestic: false, p_currencies: ["KRW","JPY","USD","EUR","CNY","THB"],
    });
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 5: `tests/integration/resize-trip-days.test.ts`**

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
let aliceId = ""; let bobId = "";

async function aliceClient() {
  const c = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email: `alice_resize+${STAMP}@test.local`, password: PWD });
  return c;
}

beforeAll(async () => {
  const a = await admin.auth.admin.createUser({ email: `alice_resize+${STAMP}@test.local`, password: PWD, email_confirm: true });
  if (a.error) throw a.error; aliceId = a.data.user!.id;
  const b = await admin.auth.admin.createUser({ email: `bob_resize+${STAMP}@test.local`, password: PWD, email_confirm: true });
  if (b.error) throw b.error; bobId = b.data.user!.id;
});
afterAll(async () => {
  await admin.from("trips").delete().or(`created_by.eq.${aliceId}`);
  for (const id of [aliceId, bobId]) await admin.auth.admin.deleteUser(id);
});

async function createTestTrip(c: ReturnType<typeof createClient<Database>>, start: string, end: string) {
  return c.rpc("create_trip", { p_title: "T", p_destination: "S", p_start_date: start, p_end_date: end, p_is_domestic: true, p_currencies: [] }).then((r) => r.data as string);
}

describe("resize_trip_days", () => {
  it("확장 — trip_days 수 증가", async () => {
    const c = await aliceClient();
    const id = await createTestTrip(c, "2026-06-01", "2026-06-03"); // 3일
    await c.rpc("resize_trip_days", { p_trip_id: id, p_new_start: "2026-06-01", p_new_end: "2026-06-05" }); // 5일
    const { data } = await c.from("trip_days").select("id").eq("trip_id", id);
    expect(data).toHaveLength(5);
    await c.from("trips").delete().eq("id", id);
  });

  it("축소 — trip_days 수 감소", async () => {
    const c = await aliceClient();
    const id = await createTestTrip(c, "2026-07-01", "2026-07-05"); // 5일
    await c.rpc("resize_trip_days", { p_trip_id: id, p_new_start: "2026-07-01", p_new_end: "2026-07-02" }); // 2일
    const { data } = await c.from("trip_days").select("id").eq("trip_id", id);
    expect(data).toHaveLength(2);
    await c.from("trips").delete().eq("id", id);
  });

  it("동일 날짜 — trip_days 수 불변", async () => {
    const c = await aliceClient();
    const id = await createTestTrip(c, "2026-08-01", "2026-08-03"); // 3일
    await c.rpc("resize_trip_days", { p_trip_id: id, p_new_start: "2026-08-01", p_new_end: "2026-08-03" });
    const { data } = await c.from("trip_days").select("id").eq("trip_id", id);
    expect(data).toHaveLength(3);
    await c.from("trips").delete().eq("id", id);
  });

  it("단일 일 — 1개", async () => {
    const c = await aliceClient();
    const id = await createTestTrip(c, "2026-09-01", "2026-09-01"); // 1일
    await c.rpc("resize_trip_days", { p_trip_id: id, p_new_start: "2026-09-01", p_new_end: "2026-09-01" });
    const { data } = await c.from("trip_days").select("id").eq("trip_id", id);
    expect(data).toHaveLength(1);
    await c.from("trips").delete().eq("id", id);
  });

  it("비소유자 호출 → trip_not_found_or_forbidden", async () => {
    const aliceC = await aliceClient();
    const bobC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await bobC.auth.signInWithPassword({ email: `bob_resize+${STAMP}@test.local`, password: PWD });

    const id = await createTestTrip(aliceC, "2026-10-01", "2026-10-03");
    const { error } = await bobC.rpc("resize_trip_days", { p_trip_id: id, p_new_start: "2026-10-01", p_new_end: "2026-10-02" });
    expect(error?.message).toBe("trip_not_found_or_forbidden");
    await aliceC.from("trips").delete().eq("id", id);
  });

  it("범위 반전 (start > end) → invalid_date_range", async () => {
    const c = await aliceClient();
    const id = await createTestTrip(c, "2026-11-01", "2026-11-03");
    const { error } = await c.rpc("resize_trip_days", { p_trip_id: id, p_new_start: "2026-11-05", p_new_end: "2026-11-01" });
    expect(error?.message).toBe("invalid_date_range");
    await c.from("trips").delete().eq("id", id);
  });

  it("연속 2회 호출 idempotent", async () => {
    const c = await aliceClient();
    const id = await createTestTrip(c, "2026-12-01", "2026-12-03");
    await c.rpc("resize_trip_days", { p_trip_id: id, p_new_start: "2026-12-01", p_new_end: "2026-12-05" });
    await c.rpc("resize_trip_days", { p_trip_id: id, p_new_start: "2026-12-01", p_new_end: "2026-12-05" });
    const { data } = await c.from("trip_days").select("id").eq("trip_id", id);
    expect(data).toHaveLength(5);
    await c.from("trips").delete().eq("id", id);
  });
});
```

- [ ] **Step 6: `tests/integration/dissolve-group-cascade.test.ts`**

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
let aliceId = ""; let bobId = "";

beforeAll(async () => {
  const a = await admin.auth.admin.createUser({ email: `alice_dissolve+${STAMP}@test.local`, password: PWD, email_confirm: true });
  if (a.error) throw a.error; aliceId = a.data.user!.id;
  const b = await admin.auth.admin.createUser({ email: `bob_dissolve+${STAMP}@test.local`, password: PWD, email_confirm: true });
  if (b.error) throw b.error; bobId = b.data.user!.id;
});
afterAll(async () => {
  await admin.from("trips").delete().or(`created_by.eq.${aliceId}`);
  await admin.from("group_members").delete().or(`user_id.eq.${aliceId},user_id.eq.${bobId}`);
  await admin.from("groups").delete().or(`created_by.eq.${aliceId}`);
  for (const id of [aliceId, bobId]) await admin.auth.admin.deleteUser(id);
});

describe("dissolve_group 캐스케이드", () => {
  it("dissolve 후 trips.group_id → null, partner는 해당 trip SELECT 불가", async () => {
    const aliceC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await aliceC.auth.signInWithPassword({ email: `alice_dissolve+${STAMP}@test.local`, password: PWD });
    const bobC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await bobC.auth.signInWithPassword({ email: `bob_dissolve+${STAMP}@test.local`, password: PWD });

    const { data: inv } = await aliceC.rpc("create_invite");
    const code = (inv as { invite_code: string }).invite_code;
    await bobC.rpc("accept_invite", { p_invite_code: code });

    const tripId: string = await aliceC.rpc("create_trip", {
      p_title: "Shared", p_destination: "Jeju", p_start_date: "2026-06-01", p_end_date: "2026-06-02",
      p_is_domestic: true, p_currencies: [],
    }).then((r) => r.data as string);

    // Bob이 trip 볼 수 있는지 확인
    const { data: before } = await bobC.from("trips").select("id").eq("id", tripId).single();
    expect(before?.id).toBe(tripId);

    // dissolve
    await aliceC.rpc("dissolve_group");

    // trips.group_id → null
    const { data: trip } = await admin.from("trips").select("group_id").eq("id", tripId).single();
    expect(trip?.group_id).toBeNull();

    // bob은 더 이상 SELECT 불가
    const { data: after } = await bobC.from("trips").select("id").eq("id", tripId);
    expect(after).toHaveLength(0);

    await aliceC.from("trips").delete().eq("id", tripId);
  });

  it("dissolved → active 전이 차단 (트리거)", async () => {
    const aliceC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await aliceC.auth.signInWithPassword({ email: `alice_dissolve+${STAMP}@test.local`, password: PWD });
    const bobC = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await bobC.auth.signInWithPassword({ email: `bob_dissolve+${STAMP}@test.local`, password: PWD });

    const { data: inv } = await aliceC.rpc("create_invite");
    const code = (inv as { invite_code: string }).invite_code;
    await bobC.rpc("accept_invite", { p_invite_code: code });
    await aliceC.rpc("dissolve_group");

    const { data: grp } = await admin.from("groups").select("id").eq("created_by", aliceId).eq("status", "dissolved").single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).from("groups").update({ status: "active" }).eq("id", grp!.id);
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 7: 나머지 3개 integration 테스트 작성**

`tests/integration/updated-at-trigger.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
let aliceId = "";

beforeAll(async () => {
  const a = await admin.auth.admin.createUser({ email: `alice_updat+${STAMP}@test.local`, password: PWD, email_confirm: true });
  if (a.error) throw a.error; aliceId = a.data.user!.id;
});
afterAll(async () => {
  await admin.from("trips").delete().eq("created_by", aliceId);
  await admin.auth.admin.deleteUser(aliceId);
});

describe("trips updated_at 트리거", () => {
  it("UPDATE 시 updated_at 이 갱신된다", async () => {
    const c = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await c.auth.signInWithPassword({ email: `alice_updat+${STAMP}@test.local`, password: PWD });

    const tripId: string = await c.rpc("create_trip", {
      p_title: "T", p_destination: "S", p_start_date: "2026-06-01", p_end_date: "2026-06-02",
      p_is_domestic: true, p_currencies: [],
    }).then((r) => r.data as string);

    const { data: before } = await c.from("trips").select("updated_at").eq("id", tripId).single();
    await new Promise((r) => setTimeout(r, 1100)); // updated_at 은 초 단위이므로 1초 대기
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (c as any).from("trips").update({ title: "T2" }).eq("id", tripId);
    const { data: after } = await c.from("trips").select("updated_at").eq("id", tripId).single();

    expect(new Date(after!.updated_at).getTime()).toBeGreaterThan(new Date(before!.updated_at).getTime());
    await c.from("trips").delete().eq("id", tripId);
  });
});
```

`tests/integration/realtime-publication-audit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

describe("Realtime publication 감사", () => {
  it("supabase_realtime 에 trips/group_members/groups 포함, profiles 미포함", async () => {
    const { data, error } = await admin.rpc("query_publication_tables" as never);
    // rpc 가 없으면 raw SQL fallback
    if (error) {
      // admin 권한으로 pg_publication_tables 직접 쿼리
      const { data: rows } = await admin
        .from("pg_publication_tables" as never)
        .select("tablename")
        .eq("pubname", "supabase_realtime");
      const tables = (rows as Array<{ tablename: string }> ?? []).map((r) => r.tablename);
      expect(tables).toContain("trips");
      expect(tables).toContain("group_members");
      expect(tables).toContain("groups");
      expect(tables).not.toContain("profiles");
    } else {
      const tables = (data as Array<{ tablename: string }> ?? []).map((r) => r.tablename);
      expect(tables).toContain("trips");
      expect(tables).not.toContain("profiles");
    }
  });
});
```

`tests/integration/display-name-xss.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
let aliceId = "";

beforeAll(async () => {
  const a = await admin.auth.admin.createUser({ email: `alice_xss+${STAMP}@test.local`, password: PWD, email_confirm: true });
  if (a.error) throw a.error; aliceId = a.data.user!.id;
});
afterAll(async () => { await admin.auth.admin.deleteUser(aliceId); });

describe("display_name XSS — DB 는 literal 저장", () => {
  it("<script> 태그는 literal 그대로 저장된다", async () => {
    const c = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await c.auth.signInWithPassword({ email: `alice_xss+${STAMP}@test.local`, password: PWD });

    const xssName = '<script>alert("xss")</script>';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (c as any).from("profiles").update({ display_name: xssName }).eq("id", aliceId);

    const { data } = await c.from("profiles").select("display_name").eq("id", aliceId).single();
    // DB는 literal 저장 (렌더 에스케이프는 React 담당)
    expect(data?.display_name).toBe(xssName);
  });

  it("41자 display_name → CHECK 위반 거부", async () => {
    const c = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await c.auth.signInWithPassword({ email: `alice_xss+${STAMP}@test.local`, password: PWD });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (c as any).from("profiles").update({ display_name: "A".repeat(41) }).eq("id", aliceId);
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 8: Integration 테스트 전체 실행**

```bash
pnpm test:integration
```
Expected: 11 spec 파일 모두 PASS. accept-invite-race 20회 루프 포함.

- [ ] **Step 9: 커밋**

```bash
git add tests/integration/
git commit -m "test(integration): add full RPC/RLS/trigger integration test suite"
```

---

### Task 7: Group 훅 레이어

**Files:**
- Create: `lib/group/use-my-group.ts`
- Create: `lib/group/use-create-invite.ts`
- Create: `lib/group/use-accept-invite.ts`
- Create: `lib/group/use-cancel-invite.ts`
- Create: `lib/group/use-dissolve-group.ts`

- [ ] **Step 1: `lib/group/use-my-group.ts`**

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import type { Database } from "@/types/database";

type GroupRow = Database["public"]["Tables"]["groups"]["Row"];
type GroupMemberRow = Database["public"]["Tables"]["group_members"]["Row"];
type PublicProfile = Database["public"]["Views"]["profiles_public"]["Row"];

export type MyGroupData = {
  group: GroupRow;
  members: Array<GroupMemberRow & { profile: PublicProfile | null }>;
  inviteCode?: string; // groups_with_invite 로만 노출
} | null;

export function useMyGroup() {
  const supabase = getBrowserClient();
  return useQuery({
    queryKey: queryKeys.group.me,
    queryFn: async (): Promise<MyGroupData> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // 본인이 속한 active 또는 pending 그룹
      const { data: memberRows } = await supabase
        .from("group_members")
        .select("*, groups(*)")
        .eq("user_id", user.id)
        .in("groups.status", ["pending", "active"])
        .limit(1);

      const memberRow = memberRows?.[0];
      if (!memberRow) return null;
      const group = (memberRow as { groups: GroupRow }).groups;

      // 오너이면 invite_code 도 조회
      let inviteCode: string | undefined;
      if (group.status === "pending") {
        const { data: viewRow } = await supabase
          .from("groups_with_invite")
          .select("invite_code")
          .eq("id", group.id)
          .maybeSingle();
        inviteCode = viewRow?.invite_code ?? undefined;
      }

      // 멤버 프로필
      const { data: allMembers } = await supabase
        .from("group_members")
        .select("*, profiles_public(*)")
        .eq("group_id", group.id);

      const members = (allMembers ?? []).map((m) => ({
        ...m,
        profile: (m as { profiles_public: PublicProfile | null }).profiles_public,
      }));

      return { group, members, inviteCode };
    },
  });
}
```

- [ ] **Step 2: `lib/group/use-create-invite.ts`**

```ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export function useCreateInvite() {
  const supabase = getBrowserClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("create_invite");
      if (error) throw error;
      return data as { group_id: string; invite_code: string; reused: boolean };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.group.me });
    },
  });
}
```

- [ ] **Step 3: `lib/group/use-accept-invite.ts`**

```ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export function useAcceptInvite() {
  const supabase = getBrowserClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteCode: string) => {
      const { data, error } = await supabase.rpc("accept_invite", { p_invite_code: inviteCode });
      if (error) throw error;
      return data as { group_id: string; status: string };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.group.me });
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips.list });
    },
  });
}
```

- [ ] **Step 4: `lib/group/use-cancel-invite.ts`**

```ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export function useCancelInvite() {
  const supabase = getBrowserClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("cancel_invite");
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.group.me });
    },
  });
}
```

- [ ] **Step 5: `lib/group/use-dissolve-group.ts`**

```ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export function useDissolveGroup() {
  const supabase = getBrowserClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("dissolve_group");
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.group.me });
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips.list });
    },
  });
}
```

- [ ] **Step 6: TypeScript 컴파일 확인**

```bash
pnpm tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 7: 커밋**

```bash
git add lib/group/
git commit -m "feat(group): add group hooks (useMyGroup, useCreateInvite, useAcceptInvite, useCancelInvite, useDissolveGroup)"
```

---

### Task 8: Trip 훅 레이어

**Files:**
- Create: `lib/trip/use-trips-list.ts`
- Create: `lib/trip/use-trip-detail.ts`
- Create: `lib/trip/use-create-trip.ts`
- Create: `lib/trip/use-update-trip.ts`
- Create: `lib/trip/use-resize-trip-days.ts`
- Create: `lib/trip/use-delete-trip.ts`
- Create: `lib/trip/use-partner-share-toggle.ts`
- Create: `lib/profile/use-update-display-name.ts`

- [ ] **Step 1: `lib/trip/use-trips-list.ts`**

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import type { Database } from "@/types/database";

export type TripRow = Database["public"]["Tables"]["trips"]["Row"];

export function useTripsList() {
  const supabase = getBrowserClient();
  return useQuery({
    queryKey: queryKeys.trips.list,
    queryFn: async (): Promise<TripRow[]> => {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
```

- [ ] **Step 2: `lib/trip/use-trip-detail.ts`**

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import type { TripRow } from "@/lib/trip/use-trips-list";

export function useTripDetail(id: string) {
  const supabase = getBrowserClient();
  return useQuery({
    queryKey: queryKeys.trips.detail(id),
    queryFn: async (): Promise<TripRow | null> => {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}
```

- [ ] **Step 3: `lib/trip/use-create-trip.ts`**

```ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export type CreateTripInput = {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  isDomestic: boolean;
  currencies: string[];
};

export function useCreateTrip() {
  const supabase = getBrowserClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTripInput): Promise<string> => {
      const { data, error } = await supabase.rpc("create_trip", {
        p_title: input.title,
        p_destination: input.destination,
        p_start_date: input.startDate,
        p_end_date: input.endDate,
        p_is_domestic: input.isDomestic,
        p_currencies: input.currencies,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips.list });
    },
  });
}
```

- [ ] **Step 4: `lib/trip/use-update-trip.ts`**

```ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export type UpdateTripInput = {
  id: string;
  title?: string;
  destination?: string;
  isDomestic?: boolean;
  currencies?: string[];
};

export function useUpdateTrip() {
  const supabase = getBrowserClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...fields }: UpdateTripInput) => {
      const patch: Record<string, unknown> = {};
      if (fields.title !== undefined) patch.title = fields.title;
      if (fields.destination !== undefined) patch.destination = fields.destination;
      if (fields.isDomestic !== undefined) patch.is_domestic = fields.isDomestic;
      if (fields.currencies !== undefined) patch.currencies = fields.currencies;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("trips").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips.list });
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(id) });
    },
  });
}
```

- [ ] **Step 5: `lib/trip/use-resize-trip-days.ts`**

```ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export type ResizeTripDaysInput = {
  tripId: string;
  newStart: string;
  newEnd: string;
};

export function useResizeTripDays() {
  const supabase = getBrowserClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tripId, newStart, newEnd }: ResizeTripDaysInput) => {
      const { error } = await supabase.rpc("resize_trip_days", {
        p_trip_id: tripId,
        p_new_start: newStart,
        p_new_end: newEnd,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { tripId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips.list });
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(tripId) });
    },
  });
}
```

- [ ] **Step 6: `lib/trip/use-delete-trip.ts`**

```ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export function useDeleteTrip() {
  const supabase = getBrowserClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tripId: string) => {
      const { error } = await supabase.from("trips").delete().eq("id", tripId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips.list });
    },
  });
}
```

- [ ] **Step 7: `lib/trip/use-partner-share-toggle.ts`**

```ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export type PartnerShareToggleInput = {
  tripId: string;
  groupId: string | null; // null = share off, uuid = share on
};

export function usePartnerShareToggle() {
  const supabase = getBrowserClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tripId, groupId }: PartnerShareToggleInput) => {
      // pessimistic: 서버 확정 후 invalidate
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("trips")
        .update({ group_id: groupId })
        .eq("id", tripId);
      if (error) throw error;
    },
    onSuccess: (_data, { tripId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips.list });
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(tripId) });
    },
  });
}
```

- [ ] **Step 8: `lib/profile/use-update-display-name.ts`**

```ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export function useUpdateDisplayName() {
  const supabase = getBrowserClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (displayName: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("unauthenticated");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("profiles")
        .update({ display_name: displayName || null })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.me });
    },
  });
}
```

- [ ] **Step 9: TypeScript 컴파일 확인**

```bash
pnpm tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 10: 커밋**

```bash
git add lib/trip/ lib/profile/use-update-display-name.ts
git commit -m "feat(trip): add trip hooks and useUpdateDisplayName"
```

---

### Task 9: Mock 정리 — trips.ts, groups.ts 삭제 + factory.ts 신규

**Files:**
- Delete: `lib/mocks/trips.ts`
- Delete: `lib/mocks/groups.ts`
- Create: `lib/mocks/factory.ts`
- Modify: `lib/mocks/helpers.ts`
- Modify: `lib/mocks/index.ts`

- [ ] **Step 1: `lib/mocks/factory.ts` 작성**

```ts
if (process.env.NODE_ENV === "production") {
  throw new Error("lib/mocks/factory must not be imported in production builds");
}

import type { Database } from "@/types/database";

type TripRow = Database["public"]["Tables"]["trips"]["Row"];

export type MockFactoryInput = {
  userId: string;
  tripId: string;
};

export function makeScheduleItemsMock(_input: MockFactoryInput) {
  return [] as unknown[];
}

export function makeExpensesMock(_input: MockFactoryInput) {
  return [] as unknown[];
}

export function makeTodosMock(_input: MockFactoryInput) {
  return [] as unknown[];
}

export function makeRecordsMock(_input: MockFactoryInput) {
  return [] as unknown[];
}
```

- [ ] **Step 2: `lib/mocks/helpers.ts` 수정 — trips/groups 참조 제거**

`lib/mocks/helpers.ts`를 열어 `trips.ts`, `groups.ts` import 줄을 모두 제거하고, 해당 mock 데이터에 의존하는 함수(`groupTripsByStatus`, `getTripDaysByTripId`, `getExpensesByTripId`, `getScheduleItemsByTripId`)를 빈 배열 반환으로 교체 또는 삭제한다.

- [ ] **Step 3: `lib/mocks/index.ts` 수정 — trips/groups re-export 제거**

`lib/mocks/index.ts`에서 `trips`, `groups` 관련 export를 제거한다.

- [ ] **Step 4: `lib/mocks/trips.ts`, `lib/mocks/groups.ts` 삭제**

```bash
git rm lib/mocks/trips.ts lib/mocks/groups.ts
```

- [ ] **Step 5: 빌드 + TypeScript 확인**

```bash
pnpm tsc --noEmit
pnpm build
```
Expected: 0 errors. (trips.ts, groups.ts import 참조 에러가 있으면 해당 파일에서 제거)

- [ ] **Step 6: 커밋**

```bash
git add lib/mocks/
git commit -m "refactor(mocks): remove trips/groups mocks, add factory.ts with production guard"
```

---

### Task 10: Realtime Gateway

**Files:**
- Modify: `lib/realtime/channel.ts`
- Create: `lib/realtime/trips-channel.ts`
- Create: `lib/realtime/group-members-channel.ts`
- Create: `lib/realtime/groups-channel.ts`
- Create: `lib/realtime/use-realtime-gateway.ts`
- Create: `components/realtime/realtime-gateway.tsx`
- Modify: `app/providers.tsx`

- [ ] **Step 1: `lib/realtime/trips-channel.ts`**

```ts
import { subscribeToTable } from "@/lib/realtime/channel";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";

export function subscribeToTrips(queryClient: QueryClient) {
  return subscribeToTable({
    channel: "trips-changes",
    table: "trips",
    onChange: (payload) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips.list });
      if (payload.eventType === "UPDATE" && payload.new && "id" in payload.new) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(payload.new.id as string) });
      }
      if (process.env.NODE_ENV !== "production") {
        (window as { __realtimeEvents?: unknown[] }).__realtimeEvents ??= [];
        (window as { __realtimeEvents: unknown[] }).__realtimeEvents.push({ table: "trips", ...payload });
      }
    },
  });
}
```

- [ ] **Step 2: `lib/realtime/group-members-channel.ts`**

```ts
import { subscribeToTable } from "@/lib/realtime/channel";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";

export function subscribeToGroupMembers(queryClient: QueryClient) {
  return subscribeToTable({
    channel: "group-members-changes",
    table: "group_members",
    onChange: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.me });
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips.list });
      void queryClient.invalidateQueries({ queryKey: queryKeys.group.me });
      if (process.env.NODE_ENV !== "production") {
        (window as { __realtimeEvents?: unknown[] }).__realtimeEvents ??= [];
        (window as { __realtimeEvents: unknown[] }).__realtimeEvents.push({ table: "group_members" });
      }
    },
  });
}
```

- [ ] **Step 3: `lib/realtime/groups-channel.ts`**

```ts
import { subscribeToTable } from "@/lib/realtime/channel";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";

export type GroupsChannelOptions = {
  onDissolved?: () => void;
};

export function subscribeToGroups(queryClient: QueryClient, opts?: GroupsChannelOptions) {
  return subscribeToTable({
    channel: "groups-changes",
    table: "groups",
    onChange: (payload) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.group.me });
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips.list });
      if (
        payload.eventType === "UPDATE" &&
        payload.new &&
        "status" in payload.new &&
        payload.new.status === "dissolved"
      ) {
        opts?.onDissolved?.();
      }
      if (process.env.NODE_ENV !== "production") {
        (window as { __realtimeEvents?: unknown[] }).__realtimeEvents ??= [];
        (window as { __realtimeEvents: unknown[] }).__realtimeEvents.push({ table: "groups", ...payload });
      }
    },
  });
}
```

- [ ] **Step 4: `lib/realtime/use-realtime-gateway.ts`**

```ts
"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { subscribeToTrips } from "@/lib/realtime/trips-channel";
import { subscribeToGroupMembers } from "@/lib/realtime/group-members-channel";
import { subscribeToGroups } from "@/lib/realtime/groups-channel";
import { useUIStore } from "@/lib/store/ui-store";

export function useRealtimeGateway(userId: string | undefined) {
  const queryClient = useQueryClient();
  const supabase = getBrowserClient();
  const showToast = useUIStore((s) => s.showToast);

  useEffect(() => {
    if (!userId) return;

    const unsubTrips  = subscribeToTrips(queryClient);
    const unsubMembers = subscribeToGroupMembers(queryClient);
    const unsubGroups  = subscribeToGroups(queryClient, {
      onDissolved: () => showToast("파트너와의 공유가 종료되었어요"),
    });

    // 재연결 시 놓친 이벤트 복구
    const handleOnline = () => {
      void queryClient.invalidateQueries();
    };
    window.addEventListener("online", handleOnline);

    return () => {
      unsubTrips();
      unsubMembers();
      unsubGroups();
      window.removeEventListener("online", handleOnline);
      void supabase.removeAllChannels();
    };
  }, [userId, queryClient, supabase, showToast]);
}
```

> **참고:** `useUIStore`에 `showToast` 액션이 없으면 `lib/store/ui-store.ts`에 추가한다:
> ```ts
> showToast: (msg: string) => set({ toast: msg }),
> ```

- [ ] **Step 5: `components/realtime/realtime-gateway.tsx`**

```tsx
"use client";

import { useMyProfile } from "@/lib/profile/use-profile";
import { useRealtimeGateway } from "@/lib/realtime/use-realtime-gateway";

export function RealtimeGateway() {
  const { data: profile } = useMyProfile();
  useRealtimeGateway(profile?.id);
  return null;
}
```

- [ ] **Step 6: `app/providers.tsx` 수정 — `<RealtimeGateway />` 추가**

```tsx
"use client";

import type { ReactNode } from "react";
import { QueryProvider } from "@/lib/query/provider";
import { RealtimeGateway } from "@/components/realtime/realtime-gateway";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <RealtimeGateway />
      {children}
    </QueryProvider>
  );
}
```

- [ ] **Step 7: TypeScript 확인**

```bash
pnpm tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 8: 커밋**

```bash
git add lib/realtime/ components/realtime/ app/providers.tsx
git commit -m "feat(realtime): add RealtimeGateway with trips/group_members/groups channels"
```

---

### Task 11: `/trips` 페이지 실 DB 연결

**Files:**
- Modify: `app/trips/page.tsx`

- [ ] **Step 1: `app/trips/page.tsx` 전체 교체**

`app/trips/page.tsx`에서 `lib/mocks` import를 모두 제거하고 `useTripsList`, `groupTripsByStatus`로 교체한다:

```tsx
"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { Luggage, Plus, Plane, MapPin, Settings as SettingsIcon, ChevronRight } from "lucide-react";
import { AppBar } from "@/components/ui/app-bar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader } from "@/components/ui/section-header";
import { Fab } from "@/components/ui/fab";
import { useTripsList } from "@/lib/trip/use-trips-list";
import { groupTripsByStatus, type TripStatus } from "@/lib/trip/trip-grouping";
import type { TripRow } from "@/lib/trip/use-trips-list";
import { cn } from "@/lib/cn";

export default function TripsPage() {
  return (
    <Suspense fallback={<TripsFallback />}>
      <TripsPageInner />
    </Suspense>
  );
}

function TripsPageInner() {
  const router = useRouter();
  const { data: trips, isLoading } = useTripsList();
  const grouped = groupTripsByStatus(trips ?? []);
  const showEmpty =
    !isLoading &&
    grouped.ongoing.length === 0 &&
    grouped.upcoming.length === 0 &&
    grouped.past.length === 0;

  return (
    <div className="flex min-h-dvh flex-col pb-24" style={{ minHeight: "100dvh" }}>
      <AppBar
        title="여행"
        trailing={
          <Link href="/settings" aria-label="설정" className="text-ink-700 hover:text-error flex h-11 w-11 items-center justify-center rounded-full transition-colors">
            <SettingsIcon size={20} strokeWidth={1.75} />
          </Link>
        }
      />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-2">
        {isLoading ? (
          <TripListSkeleton />
        ) : showEmpty ? (
          <EmptyState
            className="mt-12"
            icon={<Luggage size={48} strokeWidth={1.5} />}
            title="아직 여행이 없어요"
            description="첫 여행을 만들어 파트너와 함께 계획해보세요."
            cta={
              <Link href="/trips/new">
                <Button variant="primary" size="md"><Plus size={18} strokeWidth={2} />새 여행 만들기</Button>
              </Link>
            }
          />
        ) : (
          <div className="pb-10">
            {grouped.ongoing.length > 0 && <TripGroup label="진행 중" status="ongoing" trips={grouped.ongoing} />}
            {grouped.upcoming.length > 0 && <TripGroup label="다가오는 여행" status="upcoming" trips={grouped.upcoming} />}
            {grouped.past.length > 0 && <TripGroup label="지난 여행" status="past" trips={grouped.past} />}
          </div>
        )}
      </main>
      {!showEmpty && <Fab aria-label="새 여행 만들기" onClick={() => router.push("/trips/new")} />}
    </div>
  );
}

function TripGroup({ label, status, trips }: { label: string; status: TripStatus; trips: TripRow[] }) {
  return (
    <div>
      <SectionHeader>{label}</SectionHeader>
      <ul className="flex flex-col gap-3">
        {trips.map((trip) => <li key={trip.id}><TripCard trip={trip} status={status} /></li>)}
      </ul>
    </div>
  );
}

function TripCard({ trip, status }: { trip: TripRow; status: TripStatus }) {
  return (
    <Link
      href={`/trips/${trip.id}`}
      className={cn(
        "bg-surface-100 border-border-primary flex items-stretch gap-4 overflow-hidden rounded-[12px] border p-4",
        "transition-shadow duration-200 active:scale-[0.99]",
        "hover:shadow-[0_0_16px_rgba(0,0,0,0.04)]",
      )}
    >
      <div aria-hidden className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px]",
        status === "ongoing" && "bg-accent-orange/10 text-accent-orange",
        status === "upcoming" && "bg-ti-read/40 text-ink-800",
        status === "past" && "bg-surface-400 text-ink-600",
      )}>
        {trip.is_domestic ? <MapPin size={22} strokeWidth={1.75} /> : <Plane size={22} strokeWidth={1.75} />}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-ink-900 mt-1 truncate text-[18px] font-semibold tracking-[-0.005em]">{trip.title}</h3>
        <p className="text-ink-700 mt-0.5 truncate text-[13px]">
          {trip.destination} · {formatRange(trip.start_date, trip.end_date)}
        </p>
      </div>
      <div className="text-ink-500 flex items-center"><ChevronRight size={18} /></div>
    </Link>
  );
}

function TripsFallback() {
  return (
    <div className="flex min-h-dvh flex-col" style={{ minHeight: "100dvh" }}>
      <AppBar title="여행" /><main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-2"><TripListSkeleton /></main>
    </div>
  );
}

function TripListSkeleton() {
  return (
    <div className="space-y-3 pt-2">
      <Skeleton variant="text" className="mt-6 w-[80px]" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-surface-100 border-border-primary flex items-center gap-4 rounded-[12px] border p-4">
          <Skeleton variant="rect" className="h-12 w-12 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" className="w-[70%]" />
            <Skeleton variant="text" className="w-[50%]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function formatRange(start: string, end: string): string {
  const [ys, ms, ds] = start.split("-");
  const [ye, me, de] = end.split("-");
  if (ys === ye && ms === me) return `${Number(ms)}월 ${Number(ds)}일 - ${Number(de)}일`;
  if (ys === ye) return `${Number(ms)}월 ${Number(ds)}일 - ${Number(me)}월 ${Number(de)}일`;
  return `${ys}. ${Number(ms)}. ${Number(ds)}. - ${ye}. ${Number(me)}. ${Number(de)}.`;
}
```

- [ ] **Step 2: 빌드 확인**

```bash
pnpm tsc --noEmit && pnpm build
```
Expected: 0 errors

- [ ] **Step 3: 커밋**

```bash
git add app/trips/page.tsx
git commit -m "feat(trips): wire /trips page to real DB via useTripsList"
```

---

### Task 12: `/trips/new` 실 DB 연결 + 신규 UI 컴포넌트

**Files:**
- Modify: `app/trips/new/page.tsx`
- Create: `components/trip/edit-trip-modal.tsx`
- Create: `components/trip/delete-trip-dialog.tsx`
- Create: `components/trip/date-shrink-confirm.tsx`
- Create: `components/trip/trip-unavailable.tsx`

- [ ] **Step 1: `app/trips/new/page.tsx` 수정 — useCreateTrip 배선**

`app/trips/new/page.tsx`에서 `setTimeout` mock submit을 `useCreateTrip` mutation으로 교체한다:

```tsx
// 상단 import에 추가
import { useCreateTrip } from "@/lib/trip/use-create-trip";
import { validateTripDates } from "@/lib/trip/trip-date-validation";

// 컴포넌트 내부에서:
const createTrip = useCreateTrip();
const [dateError, setDateError] = useState<string | null>(null);

// handleSubmit 교체:
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  const dateErr = validateTripDates(start, end);
  if (dateErr) { setDateError(dateErr); return; }
  setDateError(null);
  if (!valid || createTrip.isPending) return;
  try {
    const tripId = await createTrip.mutateAsync({
      title: title.trim(),
      destination: destination.trim(),
      startDate: start,
      endDate: end,
      isDomestic,
      currencies,
    });
    router.push(`/trips/${tripId}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "오류가 발생했어요";
    setShowToast(true);
    // toast 내용은 에러 메시지로 교체 (Toast 컴포넌트가 msg prop 지원 시)
    console.error(msg);
    setTimeout(() => setShowToast(false), 2000);
  }
}
```

`dateError`가 있으면 날짜 필드 아래에 인라인 에러를 렌더한다:
```tsx
{dateError && <p className="text-error text-[12px]">{dateError}</p>}
```

- [ ] **Step 2: `components/trip/date-shrink-confirm.tsx`**

```tsx
import { Button } from "@/components/ui/button";

type Props = {
  fromDay: number;
  toDay: number;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DateShrinkConfirm({ fromDay, toDay, onConfirm, onCancel }: Props) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-ink-900 text-[16px] font-semibold">날짜를 줄이시겠어요?</p>
      <p className="text-ink-700 text-[14px]">
        Day {fromDay}~{toDay}의 일정은 마지막 Day로 이동돼요
      </p>
      <div className="flex gap-3">
        <Button variant="ghost" fullWidth onClick={onCancel}>취소</Button>
        <Button variant="primary" fullWidth onClick={onConfirm}>확인</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `components/trip/delete-trip-dialog.tsx`**

```tsx
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  tripTitle: string;
  isShared: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeleteTripDialog({ open, tripTitle, isShared, onConfirm, onCancel }: Props) {
  return (
    <ConfirmDialog open={open} onClose={onCancel}>
      <div className="flex flex-col gap-4 p-4">
        <p className="text-ink-900 text-[16px] font-semibold">
          '{tripTitle}'을(를) 삭제하시겠어요?
        </p>
        <p className="text-ink-700 text-[14px]">
          일정·경비·기록이 모두 함께 사라집니다.
          {isShared && <span className="text-error block mt-1">파트너의 데이터도 함께 삭제됩니다.</span>}
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" fullWidth onClick={onCancel}>취소</Button>
          <Button variant="destructive" fullWidth onClick={onConfirm}>삭제</Button>
        </div>
      </div>
    </ConfirmDialog>
  );
}
```

- [ ] **Step 4: `components/trip/trip-unavailable.tsx`**

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function TripUnavailable() {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center"
      role="status"
      aria-live="polite"
    >
      <p className="text-ink-900 text-[18px] font-semibold">
        파트너와의 연결이 해제되어 이 여행은 더 이상 볼 수 없어요
      </p>
      <Link href="/trips">
        <Button variant="primary">내 여행 목록으로</Button>
      </Link>
    </div>
  );
}
```

- [ ] **Step 5: `components/trip/edit-trip-modal.tsx`**

```tsx
"use client";

import { useState } from "react";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { DateShrinkConfirm } from "@/components/trip/date-shrink-confirm";
import { useUpdateTrip } from "@/lib/trip/use-update-trip";
import { useResizeTripDays } from "@/lib/trip/use-resize-trip-days";
import { validateTripDates } from "@/lib/trip/trip-date-validation";
import type { TripRow } from "@/lib/trip/use-trips-list";

const CURRENCIES = ["KRW", "JPY", "USD", "EUR", "CNY", "THB"];

type Props = {
  trip: TripRow;
  onClose: () => void;
  onSaved: () => void;
};

export function EditTripModal({ trip, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(trip.title);
  const [destination, setDestination] = useState(trip.destination);
  const [start, setStart] = useState(trip.start_date);
  const [end, setEnd] = useState(trip.end_date);
  const [isDomestic, setIsDomestic] = useState(trip.is_domestic);
  const [currencies, setCurrencies] = useState<string[]>(trip.currencies);
  const [dateError, setDateError] = useState<string | null>(null);
  const [showShrinkConfirm, setShowShrinkConfirm] = useState(false);

  const updateTrip = useUpdateTrip();
  const resizeTripDays = useResizeTripDays();

  const isShrinking = end < trip.end_date || start > trip.start_date;

  async function save() {
    const dateErr = validateTripDates(start, end);
    if (dateErr) { setDateError(dateErr); return; }
    setDateError(null);

    const dateChanged = start !== trip.start_date || end !== trip.end_date;

    if (dateChanged) {
      await resizeTripDays.mutateAsync({ tripId: trip.id, newStart: start, newEnd: end });
    }

    await updateTrip.mutateAsync({
      id: trip.id,
      title,
      destination,
      isDomestic,
      currencies,
    });

    onSaved();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isShrinking) {
      setShowShrinkConfirm(true);
    } else {
      await save();
    }
  }

  if (showShrinkConfirm) {
    const originalDays = Math.round((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000) + 1;
    const newDays = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
    return (
      <DateShrinkConfirm
        fromDay={newDays + 1}
        toDay={originalDays}
        onConfirm={save}
        onCancel={() => setShowShrinkConfirm(false)}
      />
    );
  }

  const isPending = updateTrip.isPending || resizeTripDays.isPending;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-4">
      <TextField label="여행 제목" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
      <TextField label="목적지" value={destination} onChange={(e) => setDestination(e.target.value)} maxLength={100} />
      <div className="flex gap-3">
        <TextField label="시작일" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        <TextField label="종료일" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      {dateError && <p className="text-error text-[12px]">{dateError}</p>}
      <div className="flex gap-2">
        {["국내", "해외"].map((label, i) => (
          <Button key={label} type="button" variant={isDomestic === (i === 0) ? "primary" : "ghost"}
            onClick={() => setIsDomestic(i === 0)}>{label}</Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {CURRENCIES.map((c) => (
          <Button key={c} type="button" size="sm"
            variant={currencies.includes(c) ? "primary" : "ghost"}
            onClick={() => setCurrencies((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])}>
            {c}
          </Button>
        ))}
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="ghost" fullWidth onClick={onClose}>취소</Button>
        <Button type="submit" variant="primary" fullWidth disabled={isPending}>
          {isPending ? "저장 중..." : "저장"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 6: `app/trips/[id]/page.tsx` — TripUnavailable 분기 추가**

`app/trips/[id]/page.tsx`에서 `useTripDetail`을 import하고 PGRST116 에러 또는 `data === null` 시 `<TripUnavailable />`을 렌더한다:

```tsx
// 상단 import 추가
import { useTripDetail } from "@/lib/trip/use-trip-detail";
import { TripUnavailable } from "@/components/trip/trip-unavailable";

// 컴포넌트 내부에서 params.id 로 훅 호출
const { data: trip, isLoading, error } = useTripDetail(params.id);

if (isLoading) return <TripDetailSkeleton />;
if (!trip || (error && (error as { code?: string }).code === "PGRST116")) {
  return <TripUnavailable />;
}
```

- [ ] **Step 7: 빌드 확인**

```bash
pnpm tsc --noEmit && pnpm build
```
Expected: 0 errors

- [ ] **Step 8: 커밋**

```bash
git add app/trips/new/page.tsx app/trips/[id]/page.tsx \
        components/trip/edit-trip-modal.tsx components/trip/delete-trip-dialog.tsx \
        components/trip/date-shrink-confirm.tsx components/trip/trip-unavailable.tsx
git commit -m "feat(trips): wire new-trip form, trip detail with TripUnavailable, and trip edit/delete modals"
```

---

### Task 13: Settings UI — profile 페이지 + couple 페이지

**Files:**
- Create: `app/settings/profile/page.tsx`
- Create: `app/settings/couple/page.tsx`
- Create: `components/settings/profile-display-name.tsx`
- Create: `components/settings/couple-section.tsx`
- Modify: `app/settings/page.tsx`

- [ ] **Step 1: `components/settings/profile-display-name.tsx`**

```tsx
"use client";

import { useState } from "react";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { useMyProfile } from "@/lib/profile/use-profile";
import { useUpdateDisplayName } from "@/lib/profile/use-update-display-name";

export function ProfileDisplayName() {
  const { data: profile } = useMyProfile();
  const [value, setValue] = useState(profile?.display_name ?? "");
  const [toast, setToast] = useState<string | null>(null);
  const update = useUpdateDisplayName();

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(null), 1800); }

  async function handleSave() {
    await update.mutateAsync(value);
    flash(value.trim() ? "저장되었어요" : "이름을 비워두었어요");
  }

  return (
    <div className="flex flex-col gap-4">
      <TextField
        label="이름"
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, 36))}
        placeholder="표시 이름을 입력하세요"
        maxLength={36}
        hint={`${value.length}/36`}
      />
      <Button variant="primary" onClick={handleSave} disabled={update.isPending}>
        {update.isPending ? "저장 중..." : "저장"}
      </Button>
      {toast && <Toast message={toast} />}
    </div>
  );
}
```

- [ ] **Step 2: `app/settings/profile/page.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { AppBar } from "@/components/ui/app-bar";
import { ProfileDisplayName } from "@/components/settings/profile-display-name";
import { ColorPalette } from "@/components/settings/color-palette";

export default function ProfileSettingsPage() {
  const router = useRouter();
  return (
    <div className="flex min-h-dvh flex-col" style={{ minHeight: "100dvh" }}>
      <AppBar title="프로필" onBack={() => router.push("/settings")} />
      <main className="mx-auto w-full max-w-[560px] flex-1 px-4 pt-6 pb-24 flex flex-col gap-8">
        <ProfileDisplayName />
        <ColorPalette />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: `components/settings/couple-section.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useMyGroup } from "@/lib/group/use-my-group";
import { useCreateInvite } from "@/lib/group/use-create-invite";
import { useCancelInvite } from "@/lib/group/use-cancel-invite";
import { useDissolveGroup } from "@/lib/group/use-dissolve-group";
import { buildInviteUrl } from "@/lib/group/invite-url";

export function CoupleSection() {
  const { data: groupData, isLoading } = useMyGroup();
  const createInvite = useCreateInvite();
  const cancelInvite = useCancelInvite();
  const dissolveGroup = useDissolveGroup();
  const [toast, setToast] = useState<string | null>(null);
  const [dissolveOpen, setDissolveOpen] = useState(false);

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2000); }

  async function handleCreate() {
    try {
      await createInvite.mutateAsync();
    } catch (err) {
      flash(err instanceof Error ? err.message : "오류가 발생했어요");
    }
  }

  async function handleCancel() {
    await cancelInvite.mutateAsync();
  }

  async function handleDissolve() {
    setDissolveOpen(false);
    await dissolveGroup.mutateAsync();
    flash("파트너 연결이 해제되었어요");
  }

  if (isLoading) return <div className="h-20 animate-pulse rounded-xl bg-surface-200" />;

  if (!groupData) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <p className="text-ink-700">파트너와 함께 여행을 계획해보세요</p>
        <Button variant="primary" onClick={handleCreate} disabled={createInvite.isPending}>
          파트너 초대하기
        </Button>
        {toast && <Toast message={toast} />}
      </div>
    );
  }

  if (groupData.group.status === "pending") {
    const inviteUrl = groupData.inviteCode
      ? buildInviteUrl(groupData.inviteCode, window.location.origin)
      : "";
    return (
      <div className="flex flex-col gap-4">
        <p className="text-ink-700 text-[14px]">초대 링크를 생성했어요</p>
        <div className="bg-surface-200 rounded-lg p-3 font-mono text-[12px] break-all">{inviteUrl}</div>
        <Button variant="ghost" onClick={() => { void navigator.clipboard.writeText(inviteUrl); flash("복사되었어요"); }}>
          복사
        </Button>
        <p className="text-ink-600 text-[13px] text-center">파트너가 수락하면 연결됩니다</p>
        <Button variant="ghost" onClick={handleCancel} disabled={cancelInvite.isPending}>
          초대 취소
        </Button>
        {toast && <Toast message={toast} />}
      </div>
    );
  }

  if (groupData.group.status === "active") {
    const partner = groupData.members.find((m) => m.role !== "owner");
    return (
      <div className="flex flex-col gap-4">
        {partner?.profile && (
          <div className="flex items-center gap-3">
            <div className="bg-accent-orange/20 h-10 w-10 rounded-full flex items-center justify-center text-[14px] font-semibold">
              {(partner.profile.display_name ?? "?")[0]}
            </div>
            <span className="text-ink-900 font-medium">{partner.profile.display_name ?? "파트너"}</span>
          </div>
        )}
        <Button variant="destructive" onClick={() => setDissolveOpen(true)}>파트너 연결 해제</Button>
        <ConfirmDialog open={dissolveOpen} onClose={() => setDissolveOpen(false)}>
          <div className="flex flex-col gap-4 p-4">
            <p className="text-ink-900 font-semibold">파트너 연결을 해제하시겠어요?</p>
            <p className="text-ink-700 text-[14px]">
              공유 중인 여행이 파트너에게서 사라집니다. 이 작업은 되돌릴 수 없어요.
            </p>
            <div className="flex gap-3">
              <Button variant="ghost" fullWidth onClick={() => setDissolveOpen(false)}>취소</Button>
              <Button variant="destructive" fullWidth onClick={handleDissolve}>해제하기</Button>
            </div>
          </div>
        </ConfirmDialog>
        {toast && <Toast message={toast} />}
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 4: `app/settings/couple/page.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { AppBar } from "@/components/ui/app-bar";
import { CoupleSection } from "@/components/settings/couple-section";

export default function CoupleSettingsPage() {
  const router = useRouter();
  return (
    <div className="flex min-h-dvh flex-col" style={{ minHeight: "100dvh" }}>
      <AppBar title="파트너 연결" onBack={() => router.push("/settings")} />
      <main className="mx-auto w-full max-w-[560px] flex-1 px-4 pt-6 pb-24">
        <CoupleSection />
      </main>
    </div>
  );
}
```

- [ ] **Step 5: `app/settings/page.tsx` — mock groups 제거, 링크 허브 업데이트**

`app/settings/page.tsx`에서 `import { groups } from "@/lib/mocks/groups"` 줄을 삭제하고, `useMyGroup()` 훅으로 교체한다:

```tsx
// 삭제: import { groups } from "@/lib/mocks/groups";
// 추가: import { useMyGroup } from "@/lib/group/use-my-group";

// 컴포넌트 내부:
const { data: groupData } = useMyGroup();
const partnerConnected = groupData?.group.status === "active";
```

- [ ] **Step 6: 빌드 확인**

```bash
pnpm tsc --noEmit && pnpm build
```
Expected: 0 errors

- [ ] **Step 7: 커밋**

```bash
git add app/settings/ components/settings/profile-display-name.tsx components/settings/couple-section.tsx
git commit -m "feat(settings): add profile page, couple page with real group hooks"
```

---

### Task 14: `/invite/[code]` 실 DB 연결

**Files:**
- Modify: `app/invite/[code]/page.tsx`
- Create: `components/invite/invite-copy-screen.tsx`
- Modify: `components/invite/invite-accept-card.tsx`

- [ ] **Step 1: `components/invite/invite-copy-screen.tsx`**

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { useState } from "react";

type Props = { inviteUrl: string; onGoSettings: () => void };

export function InviteCopyScreen({ inviteUrl, onGoSettings }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-center gap-6 py-12 px-4 text-center">
      <p className="text-ink-900 text-[18px] font-semibold">이 링크는 당신이 만들었어요</p>
      <p className="text-ink-700 text-[14px]">파트너에게 보내주세요</p>
      <div className="bg-surface-200 rounded-lg p-3 font-mono text-[12px] break-all w-full">{inviteUrl}</div>
      <div className="flex gap-3 w-full">
        <Button variant="ghost" fullWidth onClick={() => {
          void navigator.clipboard.writeText(inviteUrl);
          setToast("복사되었어요");
          setTimeout(() => setToast(null), 1800);
        }}>링크 복사</Button>
        <Button variant="primary" fullWidth onClick={onGoSettings}>설정으로</Button>
      </div>
      {toast && <Toast message={toast} />}
    </div>
  );
}
```

- [ ] **Step 2: `app/invite/[code]/page.tsx` 전체 교체**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppBar } from "@/components/ui/app-bar";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { InviteCopyScreen } from "@/components/invite/invite-copy-screen";
import { useAcceptInvite } from "@/lib/group/use-accept-invite";
import { extractInviteCode, buildInviteUrl } from "@/lib/group/invite-url";

type InviteState =
  | { type: "loading" }
  | { type: "success" }
  | { type: "own_invite"; inviteUrl: string }
  | { type: "already_connected" }
  | { type: "invalid" }
  | { type: "error"; message: string };

export default function InvitePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const acceptInvite = useAcceptInvite();
  const [state, setState] = useState<InviteState>({ type: "loading" });
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const code = extractInviteCode(params.code);
    if (!code) { setState({ type: "invalid" }); return; }

    acceptInvite.mutateAsync(code)
      .then(() => {
        setState({ type: "success" });
        setToast("파트너와 연결되었어요");
        setTimeout(() => router.push("/trips"), 1500);
      })
      .catch((err: Error) => {
        if (err.message === "cannot_accept_own_invite") {
          setState({ type: "own_invite", inviteUrl: buildInviteUrl(code, window.location.origin) });
        } else if (err.message === "already_in_active_group") {
          setState({ type: "already_connected" });
        } else {
          setState({ type: "invalid" });
        }
      });
  // 마운트 시 1회만 실행
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-dvh flex-col" style={{ minHeight: "100dvh" }}>
      <AppBar title="초대" onBack={() => router.push("/trips")} />
      <main className="mx-auto w-full max-w-[560px] flex-1 px-4 pt-6">
        {state.type === "loading" && (
          <p className="text-ink-600 text-center mt-12">초대를 확인하는 중...</p>
        )}
        {state.type === "success" && (
          <p className="text-ink-900 text-center text-[18px] font-semibold mt-12">연결되었어요!</p>
        )}
        {state.type === "own_invite" && (
          <InviteCopyScreen
            inviteUrl={state.inviteUrl}
            onGoSettings={() => router.push("/settings/couple")}
          />
        )}
        {state.type === "already_connected" && (
          <div className="flex flex-col items-center gap-4 mt-12 text-center">
            <p className="text-ink-900 text-[16px] font-semibold">이미 파트너와 연결되어 있어요</p>
            <p className="text-ink-700 text-[14px]">기존 연결을 먼저 해제해주세요</p>
            <Button variant="primary" onClick={() => router.push("/settings/couple")}>설정 &gt; 파트너</Button>
          </div>
        )}
        {state.type === "invalid" && (
          <div className="flex flex-col items-center gap-4 mt-12 text-center">
            <p className="text-ink-900 text-[16px] font-semibold">초대 링크가 만료되었어요</p>
            <p className="text-ink-700 text-[14px]">상대방에게 새 링크를 요청해주세요</p>
            <Button variant="primary" onClick={() => router.push("/trips")}>여행 목록으로</Button>
          </div>
        )}
      </main>
      {toast && <Toast message={toast} />}
    </div>
  );
}
```

> **참고:** Next.js 16 App Router metadata API로 `<meta name="referrer" content="no-referrer">` 추가:
> ```ts
> // app/invite/[code]/layout.tsx 또는 page 상단에
> export const metadata = { referrer: "no-referrer" as const };
> ```

- [ ] **Step 3: 빌드 확인**

```bash
pnpm tsc --noEmit && pnpm build
```
Expected: 0 errors

- [ ] **Step 4: 커밋**

```bash
git add app/invite/ components/invite/
git commit -m "feat(invite): wire /invite/[code] to real accept_invite RPC with 4-branch handling"
```

---

### Task 15: Mock 탭 배너 + eslint guard

**Files:**
- Modify: `components/trip/schedule-tab.tsx` (또는 `app/trips/[id]` 탭 컴포넌트)
- Modify: `eslint.config.mjs` (또는 `.eslintrc.*`)

- [ ] **Step 1: 4개 mock 탭에 영구 배너 추가**

`components/trip/schedule-tab.tsx`, `expenses-tab.tsx`, `todos-tab.tsx`, `records-tab.tsx` 각각의 최상단에 배너를 추가한다:

```tsx
// 각 탭 컴포넌트 return 최상단에 삽입
<div className="bg-ti-read/30 border-border-primary rounded-lg border px-3 py-2 mb-4">
  <p className="text-ink-700 text-[12px]">이 탭은 다음 단계에서 실 데이터로 연결됩니다</p>
</div>
```

- [ ] **Step 2: eslint `no-restricted-imports` guard 추가**

`eslint.config.mjs`에서 `no-restricted-imports` 규칙 추가 (기존 설정 구조에 맞게 삽입):

```js
rules: {
  // 기존 rules ...
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          group: ["**/lib/mocks/factory*"],
          message: "lib/mocks/factory 는 테스트·mock탭 외 경로에서 import 금지",
        },
      ],
    },
  ],
},
```

- [ ] **Step 3: lint 확인**

```bash
pnpm lint
```
Expected: 0 errors

- [ ] **Step 4: 커밋**

```bash
git add components/trip/ eslint.config.mjs
git commit -m "feat(ui): add coming-soon banners to mock tabs, add eslint factory import guard"
```

---

### Task 16: E2E 테스트

**Files:**
- Create: `tests/e2e/invite-flow.spec.ts`
- Create: `tests/e2e/trip-crud.spec.ts`
- Create: `tests/e2e/partner-realtime.spec.ts`
- Create: `tests/e2e/dissolution.spec.ts`
- Create: `tests/e2e/share-toggle.spec.ts`

- [ ] **Step 1: `tests/e2e/invite-flow.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test.describe("초대 플로우", () => {
  test("owner 초대 생성 → partner 수락 → /trips 도달", async ({ browser }) => {
    const ownerCtx = await browser.newContext({ storageState: "tests/e2e/.auth/owner.json" });
    const partnerCtx = await browser.newContext({ storageState: "tests/e2e/.auth/partner.json" });
    const ownerPage = await ownerCtx.newPage();
    const partnerPage = await partnerCtx.newPage();

    // owner가 초대 생성
    await ownerPage.goto("/settings/couple");
    await ownerPage.getByRole("button", { name: "파트너 초대하기" }).click();
    const inviteUrl = await ownerPage.locator(".font-mono").innerText();
    expect(inviteUrl).toContain("/invite/");

    // partner가 초대 수락
    await partnerPage.goto(inviteUrl);
    await expect(partnerPage).toHaveURL("/trips", { timeout: 10_000 });

    // owner 측 Realtime 반영 — active 모드로 전환
    await ownerPage.goto("/settings/couple");
    await expect(ownerPage.getByRole("button", { name: "파트너 연결 해제" })).toBeVisible({ timeout: 8_000 });

    await ownerCtx.close();
    await partnerCtx.close();
  });
});
```

- [ ] **Step 2: `tests/e2e/trip-crud.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/owner.json" });

test.describe("Trip CRUD", () => {
  test("여행 생성 → 제목 수정 → 삭제", async ({ page }) => {
    // 생성
    await page.goto("/trips/new");
    await page.getByLabel("여행 제목").fill("E2E 테스트 여행");
    await page.getByLabel("목적지").fill("서울");
    await page.getByLabel("시작일").fill("2026-08-01");
    await page.getByLabel("종료일").fill("2026-08-03");
    await page.getByRole("button", { name: "저장" }).click();

    await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+/, { timeout: 8_000 });
    await expect(page.getByText("E2E 테스트 여행")).toBeVisible();

    // 수정
    await page.getByRole("button", { name: "여행 정보 수정" }).click();
    await page.getByLabel("여행 제목").fill("수정된 E2E 여행");
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByText("수정된 E2E 여행")).toBeVisible({ timeout: 5_000 });

    // 삭제
    await page.getByRole("button", { name: "삭제" }).click();
    await page.getByRole("button", { name: "삭제", exact: true }).last().click();
    await expect(page).toHaveURL("/trips", { timeout: 5_000 });
  });
});
```

- [ ] **Step 3: `tests/e2e/partner-realtime.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test.describe("파트너 Realtime", () => {
  test("owner 여행 생성 → partner 5초 내 자동 등장", async ({ browser }) => {
    const ownerCtx  = await browser.newContext({ storageState: "tests/e2e/.auth/owner.json" });
    const partnerCtx = await browser.newContext({ storageState: "tests/e2e/.auth/partner.json" });
    const ownerPage   = await ownerCtx.newPage();
    const partnerPage = await partnerCtx.newPage();

    await partnerPage.goto("/trips");

    // owner가 여행 생성
    await ownerPage.goto("/trips/new");
    await ownerPage.getByLabel("여행 제목").fill("Realtime 테스트");
    await ownerPage.getByLabel("목적지").fill("부산");
    await ownerPage.getByLabel("시작일").fill("2026-09-01");
    await ownerPage.getByLabel("종료일").fill("2026-09-02");
    await ownerPage.getByRole("button", { name: "저장" }).click();
    await expect(ownerPage).toHaveURL(/\/trips\/[0-9a-f-]+/, { timeout: 8_000 });

    // partner 측에 5초 내 등장 (Realtime)
    await expect(partnerPage.getByText("Realtime 테스트")).toBeVisible({ timeout: 5_000 });

    await ownerCtx.close();
    await partnerCtx.close();
  });
});
```

- [ ] **Step 4: `tests/e2e/dissolution.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test.describe("파트너 연결 해제", () => {
  test("owner dissolve → partner trip-unavailable", async ({ browser }) => {
    const ownerCtx  = await browser.newContext({ storageState: "tests/e2e/.auth/owner.json" });
    const partnerCtx = await browser.newContext({ storageState: "tests/e2e/.auth/partner.json" });
    const ownerPage   = await ownerCtx.newPage();
    const partnerPage = await partnerCtx.newPage();

    // owner: 공유 여행 ID 파악
    await ownerPage.goto("/trips");
    const tripLink = ownerPage.locator("a[href^='/trips/']").first();
    const href = await tripLink.getAttribute("href");
    const tripId = href?.split("/trips/")[1];

    // partner: 해당 trip 페이지 열기
    await partnerPage.goto(`/trips/${tripId}`);
    await expect(partnerPage.getByText("파트너와의 연결이 해제되어")).not.toBeVisible();

    // owner: 연결 해제
    await ownerPage.goto("/settings/couple");
    await ownerPage.getByRole("button", { name: "파트너 연결 해제" }).click();
    await ownerPage.getByRole("button", { name: "해제하기" }).click();

    // partner: TripUnavailable 등장
    await expect(partnerPage.getByText("파트너와의 연결이 해제되어")).toBeVisible({ timeout: 8_000 });

    await ownerCtx.close();
    await partnerCtx.close();
  });
});
```

- [ ] **Step 5: `tests/e2e/share-toggle.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test.describe("파트너 공유 토글", () => {
  test("toggle OFF → partner 접근 차단", async ({ browser }) => {
    const ownerCtx  = await browser.newContext({ storageState: "tests/e2e/.auth/owner.json" });
    const partnerCtx = await browser.newContext({ storageState: "tests/e2e/.auth/partner.json" });
    const ownerPage   = await ownerCtx.newPage();
    const partnerPage = await partnerCtx.newPage();

    // owner: 공유 여행 목록 진입
    await ownerPage.goto("/trips");
    const tripLink = ownerPage.locator("a[href^='/trips/']").first();
    const href = await tripLink.getAttribute("href");
    const tripId = href?.split("/trips/")[1];

    // partner: 현재 볼 수 있는지 확인
    await partnerPage.goto(`/trips/${tripId}`);
    await expect(partnerPage.getByText("파트너와의 연결이 해제되어")).not.toBeVisible();

    // owner: share toggle OFF
    await ownerPage.goto(`/trips/${tripId}`);
    await ownerPage.getByLabel("Manage").click();
    const toggle = ownerPage.getByRole("switch", { name: "파트너 공유" });
    await toggle.click();
    await ownerPage.getByRole("button", { name: "확인" }).click();

    // partner: TripUnavailable
    await partnerPage.reload();
    await expect(partnerPage.getByText("파트너와의 연결이 해제되어")).toBeVisible({ timeout: 5_000 });

    await ownerCtx.close();
    await partnerCtx.close();
  });
});
```

> **Note:** E2E 테스트 실행 전 `tests/e2e/.auth/owner.json`, `partner.json` storageState 파일이 필요하다. 실 Google 계정 2개로 한 번 로그인 후 `playwright.config.ts`의 `setup` 프로젝트 또는 수동으로 저장한다.

- [ ] **Step 6: E2E 실행**

```bash
pnpm exec playwright test
```
Expected: 6 spec 모두 PASS (login.spec.ts 포함)

- [ ] **Step 7: 커밋**

```bash
git add tests/e2e/
git commit -m "test(e2e): add invite-flow, trip-crud, partner-realtime, dissolution, share-toggle specs"
```

---

### Task 17: 최종 검증 + Exit

**Files:**
- Run: Verification SQL 6쿼리
- Run: `pnpm build`, `pnpm test`, `pnpm test:integration`, `pnpm exec playwright test`
- Create: `docs/qa/phase2-rls-manual-check.md`
- Tag: `phase-2-trip-core`

- [ ] **Step 1: 전체 자동 검증 실행**

```bash
pnpm tsc --noEmit
pnpm test
pnpm test:integration
pnpm exec playwright test
pnpm audit --production
pnpm lint
pnpm build
```
Expected: 모두 0 에러/실패

- [ ] **Step 2: `pnpm db:types` diff 확인**

```bash
pnpm db:types
git diff types/database.ts
```
Expected: diff 없음 (이미 최신)

- [ ] **Step 3: Verification SQL 6쿼리 실행 (Supabase Studio SQL Editor)**

```sql
-- (1) 정책 목록
select tablename, policyname from pg_policies
where schemaname='public' and tablename in ('groups','group_members','trips','trip_days')
order by tablename, policyname;

-- (2) Realtime publication (profiles 없음, 3개)
select tablename from pg_publication_tables where pubname='supabase_realtime';

-- (3) 함수 privilege
select p.proname, array_agg(distinct r.grantee) as grantees
from information_schema.routine_privileges r
join pg_proc p on p.proname = r.routine_name
where r.routine_schema='public' and p.proname in
  ('can_access_trip','accept_invite','create_invite','cancel_invite','dissolve_group','create_trip','resize_trip_days')
group by p.proname;
-- Expected: 모두 grantees = {authenticated}

-- (4) CHECK 제약
select conname from pg_constraint where conrelid='public.trips'::regclass and contype='c';
-- Expected: trips_title_length, trips_destination_length, trips_date_range, trips_duration_max, trips_currencies_count

-- (5) 트리거
select tgname, tgrelid::regclass from pg_trigger
where tgisinternal=false and tgrelid::regclass::text like 'public.%' order by 2, 1;
-- Expected: on_auth_user_created, group_members_active_uniqueness,
--           groups_status_transition, groups_dissolution_fanout, trips_set_updated_at

-- (6) RLS 활성
select relname, relrowsecurity from pg_class
where relnamespace='public'::regnamespace and relname in ('groups','group_members','trips','trip_days');
-- Expected: 모두 t
```

- [ ] **Step 4: 수동 검증 시나리오 11종 체크 (실 Google 계정 2개)**

| # | 시나리오 | 기대 | 결과 |
|---|---|---|---|
| 1 | A `/settings/couple` → 초대 링크 생성 | pending 모드 UI + 링크·복사 | |
| 2 | B 로그아웃 상태로 초대 URL 접근 | `/login` 리다이렉트 → 로그인 후 원경로 복귀 | |
| 3 | B 수락 | `/trips` 라우팅 + "파트너와 연결되었어요". A 탭 active 모드 자동 전환 | |
| 4 | A `/trips/new` | 하단에 "파트너 {B} 와 공유됩니다" 정보 행 노출 | |
| 5 | A 여행 생성 | B의 `/trips`에 5초 내 자동 등장 | |
| 6 | A 여행 날짜 확장 | 확인 없이 저장, B 반영 | |
| 7 | A 여행 날짜 축소 (Day 4→Day 2) | "Day 3~4의 일정은 마지막 Day로 이동돼요" 확인 → 저장, B 반영 | |
| 8 | A Manage 탭 partner-share OFF | inline 확인 → B의 `/trips`에서 사라짐, B 직접 접근 → trip-unavailable | |
| 9 | A `/settings/couple` → 파트너 연결 해제 | 2단 확인 → B 측 toast + trips 축소 + 공유 trip URL → trip-unavailable | |
| 10 | A 로그아웃 후 재로그인 | 세션 복원, 구독 재수립 | |
| 11 | Chrome DevTools | CSP 위반 0, Realtime WebSocket 연결, `window.__realtimeEvents` 누적 (dev) | |

- [ ] **Step 5: `docs/qa/phase2-rls-manual-check.md` 작성**

결과 표를 위의 체크리스트와 함께 저장한다 (날짜·계정·결과 포함).

- [ ] **Step 6: Git tag + push**

```bash
git tag phase-2-trip-core
git push origin phase-2-trip-core
git push origin claude/phase2-plan
```

- [ ] **Step 7: 완료 커밋**

```bash
git add docs/qa/phase2-rls-manual-check.md
git commit -m "chore(phase2): add RLS manual check doc, tag phase-2-trip-core"
```

---

## Retrospective (Phase 2 완료 후 append)

_(Phase 2 실행 완료 후 이 섹션에 추가)_

### 소요 시간

### 주요 이슈

### 배운 것

### Phase 3 인계 사항

- `resize_trip_days` body에 schedule_items 이동 로직 삽입 지점 (DELETE 전)
- `can_access_trip` 함수를 schedule_items/expenses/todos/records RLS 정책에서 재사용
- `on_group_dissolved` trigger에 `categories.group_id → null` fanout 추가
- Realtime publication에 schedule_items 등 추가
- 지도 API 선택 ADR 필요 (Google Maps 해외, Naver Maps 국내)

---

## Retrospective (2026-04-20 완료)

### 결과 요약

- **커밋:** 17개 (`858bd37` → tag `phase-2-trip-core`, main HEAD=`0c710a2`)
- **소요:** 2일 (2026-04-19~20)
- **테스트:** unit 22/22 · integration 36/36 · manual E2E 5/5 통과

### 잘된 것

- `group_members` RLS 무한 재귀를 integration 테스트에서 즉시 발견 → 0004 마이그레이션으로 해결 (ADR-008)
- `accept_invite` 동시성 20회 race test → 단일 승자 보장 확인
- Mock 전용 UI(HighlightPanel, StatusPill, preview toggle) 전면 제거 — 코드베이스 정리
- `/invite/[code]` 5-branch state machine으로 엣지케이스 망라

### 어려웠던 것

- `supabase db types` 재생성이 Phase 1 `PostgrestVersion: "12"` workaround를 덮어씀 → 재적용 필요
- `wss://` connect-src CSP 누락으로 WebSocket 전면 차단 (Phase 2 첫 Realtime 사용 시 발현)
- Google OAuth Playwright 자동화 거절 → 수동 체크리스트로 전환, Phase 3에서 service_role 기반 복귀

### Follow-up

- `useFlashToast()` 공용 훅 도입 — flash + setTimeout 5파일 중복 정리
- Phase 3에서 share-toggle OFF Realtime 전환 (`REPLICA IDENTITY FULL`) 구현
