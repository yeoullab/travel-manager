---
type: design-spec
phase: 2
project: travel-manager
date: 2026-04-19
status: draft → reviewed
author: AI + human collaborative design
review: 6관점 critique (Section 2) + 2관점 critique (Section 4)
---

# Phase 2 — Trip Core Design Spec

> **Phase 2 Goal:** Phase 1(인증·프로필) 위에 **여행 CRUD + 커플 그룹 연결 + trips 리스트 Realtime**을 얹어, "파트너와 함께 여행 목록을 공유하는" 기반 체감을 실 데이터로 완성한다.
>
> **Design scope:** 이 문서는 **Phase 2 설계 스펙**(데이터 모델·RPC·플로우·라우트)이다. Task-by-Task 구현 계획은 별도 문서 `docs/plans/2026-04-19-phase2-trip-core.md` 에서 `writing-plans` 스킬로 생성된다.
>
> **전제:** `docs/superpowers/specs/2026-04-16-travel-manager-design.md` (전체 스펙) + `docs/plans/2026-04-17-phase1-auth.md` (Phase 1 플랜 형식) + Phase 1 완료 상태 (tag `phase-1-foundation-auth`).

---

## 1. Overview & Scope

### 1.1 Goal

Phase 1 에서 완성된 Google 로그인·프로필을 기반으로:

1. 커플 그룹(`groups` + `group_members`) 연결 플로우 전체 — 초대 생성·수락·취소·해제
2. 여행 CRUD — 생성(auto-link to active group)·편집·날짜 확장/축소·파트너 공유 토글·삭제
3. `trips`·`group_members`·`groups` 3 채널 Realtime 구독으로 파트너 간 trips 목록 실시간 동기
4. Phase 0 mockup 의 주요 화면(일정·경비·Todo·기록 탭 + `/share/[token]` 은 Phase 3/6 유지)을 실 데이터로 전환

### 1.2 In Scope

| 카테고리 | 항목 |
|---|---|
| DB 마이그레이션 | `groups`, `group_members`, `trips`, `trip_days` + RLS + 인덱스 + CHECK |
| Helper function | `can_access_trip(uuid)` (SECURITY DEFINER, RLS 재귀 회피) |
| RPC | `create_invite`, `accept_invite`, `cancel_invite`, `dissolve_group`, `create_trip`, `resize_trip_days` |
| Trigger | `check_active_group_uniqueness` (BEFORE INSERT group_members), `enforce_group_status_transition` (BEFORE UPDATE groups), `on_group_dissolved` (AFTER UPDATE groups), `trips_set_updated_at` (BEFORE UPDATE trips) |
| Realtime | `supabase_realtime` publication 명시 관리 (trips/group_members/groups 포함, profiles 제외). `RealtimeGateway` 컴포넌트로 전역 구독 |
| 라우트 실연결 | `/trips`, `/trips/new`, `/trips/[id]` shell+Manage, `/settings/profile`, `/settings/couple`, `/invite/[code]` |
| UI 신규/편집 | `edit-trip-modal`, `delete-trip-dialog`, `date-shrink-confirm`, `trip-unavailable`, `couple-section`, `profile-display-name`, `invite-accept-card`, `invite-copy-screen`, `realtime-gateway` |
| Mock 정리 | `lib/mocks/trips.ts`·`groups.ts` **제거**. 나머지 mock 은 `lib/mocks/factory.ts` 신규 팩토리로 실 trip_id 매핑 |
| 테스트 | RLS integration 7종, E2E 6종 (2 browser context 포함), race 루프 20회, Verification SQL 6 쿼리 |

### 1.3 Out of Scope (Phase 3+ 에서 다룸)

| 항목 | 이후 Phase |
|---|---|
| `schedule_items`, 지도(Google/Naver) API, 드래그앤드롭 | Phase 3 |
| `expenses`, 카테고리 CRUD, 통화별 합계 | Phase 4 (categories 는 Phase 3과 함께도 가능) |
| `todos`, `records` | Phase 5 |
| `guest_shares`, `/share/[token]` SSR | Phase 6 |
| PWA, Workbox 쉘 프리캐시 | Phase 8 |
| Realtime 전면 확장 (schedule·expenses·todos), 충돌 병합 | Phase 7 |

### 1.4 Phase 2 Exit Criteria (요약)

**자동 검증(CI):** unit + integration + E2E + build + audit + lint + Verification SQL 전수 통과.
**수동 검증(실 Google 계정 2개):** 11 시나리오 (§5.5.B) 전수 통과.
**산출물:** 이 설계 문서 + 구현 계획 + RLS 수동 체크 기록 + Git tag `phase-2-trip-core` + retrospective.

상세는 §5.5.

---

## 2. Data Model

### 2.1 Migration 파일 구성

Phase 1 의 `0001_profiles.sql` 뒤에 **2개 마이그레이션** 으로 논리 분할:

| 파일 | 내용 |
|---|---|
| `supabase/migrations/0002_groups.sql` | `groups` + `group_members` 테이블 + RLS + 인덱스 + 트리거 + RPC (`create_invite`, `accept_invite`, `cancel_invite`, `dissolve_group`) |
| `supabase/migrations/0003_trips.sql` | `trips` + `trip_days` + RLS + 인덱스 + CHECK + 트리거 + Helper (`can_access_trip`) + RPC (`create_trip`, `resize_trip_days`) + Realtime publication 관리 |

**롤백:** 각 파일 끝에 `0001_profiles.sql` 패턴과 동일한 `-- ROLLBACK:` 주석 블록 (DROP 순서: policies → triggers → functions → tables).

### 2.2 `groups`

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK default gen_random_uuid() |
| invite_code | uuid | UNIQUE NOT NULL default gen_random_uuid() |
| status | text | NOT NULL CHECK (status in ('pending','active','cancelled','dissolved')) |
| max_members | int | NOT NULL default 2 |
| created_by | uuid | FK profiles(id) NOT NULL |
| created_at | timestamptz | NOT NULL default now() |

**상태값 4개** — `pending` / `active` / `cancelled` / `dissolved`.
- `pending`: owner 가 invite 를 생성하고 partner 가 아직 수락 안 함.
- `active`: partner 가 수락하여 2인이 연결된 상태.
- `cancelled`: owner 가 pending 상태에서 취소 (`cancel_invite` RPC).
- `dissolved`: active 상태에서 owner 가 해제 (`dissolve_group` RPC).

`cancelled` 와 `dissolved` 는 별개 상태 — `dissolve` 는 공유 trips 의 fanout(group_id→NULL)을 발화시키지만 `cancel` 은 아직 active 된 적이 없어 fanout 불필요. 상태 구분으로 감사성 확보.

**인덱스:**
```sql
create index idx_groups_invite on groups(invite_code) where status = 'pending';
```

### 2.3 `group_members`

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK default gen_random_uuid() |
| group_id | uuid | FK groups(id) ON DELETE CASCADE NOT NULL |
| user_id | uuid | FK profiles(id) NOT NULL |
| role | text | NOT NULL CHECK (role in ('owner','member')) |
| joined_at | timestamptz | NOT NULL default now() |

**유일성:**
```sql
unique (group_id, user_id);
create index idx_group_members_user on group_members(user_id);
create index idx_group_members_group on group_members(group_id);
```

**유저당 active 그룹 1개 제약** — partial unique index 는 서브쿼리 WHERE 를 허용하지 않으므로 **트리거** 로 대체:

```sql
create or replace function public.check_active_group_uniqueness()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from group_members gm
    join groups g on g.id = gm.group_id
    where gm.user_id = new.user_id
      and g.status = 'active'
      and (tg_op = 'INSERT' or gm.id != new.id)
  ) then
    raise exception 'user_already_in_active_group';
  end if;
  return new;
end $$;

create trigger group_members_active_uniqueness
  before insert on group_members
  for each row execute function public.check_active_group_uniqueness();
```

트리거는 INSERT 만 검사(group_members 는 UPDATE 로 user_id 변경되지 않음 — 정책으로도 role 불변).

### 2.4 `trips`

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK default gen_random_uuid() |
| group_id | uuid | FK groups(id) ON DELETE SET NULL nullable |
| created_by | uuid | FK profiles(id) NOT NULL |
| title | text | NOT NULL |
| destination | text | NOT NULL |
| start_date | date | NOT NULL |
| end_date | date | NOT NULL |
| is_domestic | boolean | NOT NULL default true |
| currencies | text[] | NOT NULL default '{}' |
| created_at | timestamptz | NOT NULL default now() |
| updated_at | timestamptz | NOT NULL default now() |

**CHECK 제약 (Patch K — 보안 리뷰 반영, DoS·입력 크기):**
```sql
alter table public.trips
  add constraint trips_title_length check (char_length(title) between 1 and 100),
  add constraint trips_destination_length check (char_length(destination) between 1 and 100),
  add constraint trips_date_range check (end_date >= start_date),
  add constraint trips_duration_max check (end_date - start_date <= 90),
  add constraint trips_currencies_count check (array_length(currencies, 1) is null or array_length(currencies, 1) <= 5);
```

**인덱스:**
```sql
create index idx_trips_created_by on trips(created_by);
create index idx_trips_group on trips(group_id);
```

**updated_at 자동 갱신 트리거:**
```sql
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger trips_set_updated_at
  before update on trips
  for each row execute function public.set_updated_at();
```

### 2.5 `trip_days`

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK default gen_random_uuid() |
| trip_id | uuid | FK trips(id) ON DELETE CASCADE NOT NULL |
| day_number | int | NOT NULL |
| date | date | NOT NULL |

```sql
unique (trip_id, day_number);
create index idx_trip_days_trip on trip_days(trip_id);
```

Phase 2 에선 schedule_items 가 없으므로 trip_days 는 순수 날짜 컨테이너.

### 2.6 Patch L — `profiles.display_name` CHECK

Phase 1 에서 놓친 길이 제약을 이 Phase 에 보강:

```sql
alter table public.profiles
  add constraint profiles_display_name_length
    check (display_name is null or char_length(display_name) <= 40);
```

(마이그레이션 0002_groups.sql 상단에 위치.)

### 2.7 Helper function — `can_access_trip`

스펙 §4 RLS 의 "trip 접근 가능자" 조건을 재사용 가능하게 함수화. **SECURITY DEFINER** 로 RLS 재귀 회피:

```sql
create or replace function public.can_access_trip(p_trip_id uuid)
returns boolean
language plpgsql
security definer   -- RLS 재귀 방지. auth.uid() 는 DEFINER 하에서도 호출자 세션 반환.
stable
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_created_by uuid;
  v_group_id uuid;
begin
  if v_uid is null then return false; end if;
  select created_by, group_id into v_created_by, v_group_id
    from trips where id = p_trip_id;
  if v_created_by is null then return false; end if;
  if v_created_by = v_uid then return true; end if;
  if v_group_id is null then return false; end if;
  return exists (
    select 1 from group_members gm
    join groups g on g.id = gm.group_id
    where gm.user_id = v_uid and gm.group_id = v_group_id and g.status = 'active'
  );
end;
$$;

revoke all on function public.can_access_trip(uuid) from public;
grant execute on function public.can_access_trip(uuid) to authenticated;
```

Phase 3+ 에서 `schedule_items`, `expenses`, `todos`, `records` 정책이 이 헬퍼를 재사용.

### 2.8 RLS policies

| 테이블 | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| groups | 본인이 속한 그룹 (group_members 조인) 또는 본인 생성 | `auth.uid() = created_by` | `created_by = auth.uid() AND status != 'dissolved' AND status != 'cancelled'` | ❌ (상태 전이로만 삭제 표현) |
| group_members | 본인이 속한 그룹의 멤버 | **`WITH CHECK (false)`** — accept_invite RPC 경유만 | 본인 row 만, role 불변 | owner 제외한 멤버만 (self-leave OR group owner kick) |
| trips | `can_access_trip(id)` | `auth.uid() = created_by` | `can_access_trip(id) AND created_by = auth.uid()` | `auth.uid() = created_by` |
| trip_days | `can_access_trip(trip_id)` | `can_access_trip(trip_id)` | `can_access_trip(trip_id)` | `can_access_trip(trip_id)` |

**컬럼 GRANT (Phase 1 패턴 확장):**
- `groups.invite_code` 는 민감 → 테이블 레벨 `SELECT` 에서 컬럼 제외. 생성자 전용 view 로 노출:
  ```sql
  create view public.groups_with_invite
  with (security_invoker = true) as
    select id, invite_code, status, created_at from groups
    where created_by = auth.uid();
  grant select on public.groups_with_invite to authenticated;
  ```
- `group_members` 에서 INSERT 는 GRANT 에서 제거:
  ```sql
  revoke insert on public.group_members from authenticated;
  -- SELECT/UPDATE/DELETE 만 유지, 정책으로 제어
  ```

**group_members INSERT 차단 정책 (Patch D):**
```sql
create policy "group_members_no_direct_insert"
  on public.group_members for insert to authenticated
  with check (false);
-- SECURITY DEFINER RPC (accept_invite) 는 RLS 우회하므로 여전히 동작
```

**group_members DELETE 정책 (Patch F — owner 자기삭제 방지):**
```sql
create policy "group_members_self_or_owner_delete"
  on public.group_members for delete to authenticated
  using (
    (user_id = auth.uid() and role != 'owner')
    or
    exists (
      select 1 from group_members me
      where me.group_id = group_members.group_id
        and me.user_id = auth.uid()
        and me.role = 'owner'
    )
  );
```

owner 는 `dissolve_group` RPC 경로로만 탈퇴.

### 2.9 RPC functions

#### `create_invite()` — Patch G

```sql
create or replace function public.create_invite()
returns json language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_group_id uuid; v_code uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;

  -- 이미 active group owner 이면 차단
  if exists (
    select 1 from group_members gm join groups g on g.id = gm.group_id
    where gm.user_id = v_uid and g.status = 'active'
  ) then raise exception 'already_in_active_group'; end if;

  -- pending 이 이미 있으면 같은 invite_code 재사용 (멱등)
  select id, invite_code into v_group_id, v_code
    from groups where created_by = v_uid and status = 'pending' limit 1;
  if v_group_id is not null then
    return json_build_object('group_id', v_group_id, 'invite_code', v_code, 'reused', true);
  end if;

  insert into groups(created_by, status) values (v_uid, 'pending')
    returning id, invite_code into v_group_id, v_code;
  insert into group_members(group_id, user_id, role) values (v_group_id, v_uid, 'owner');
  return json_build_object('group_id', v_group_id, 'invite_code', v_code, 'reused', false);
end $$;
revoke all on function public.create_invite() from public;
grant execute on function public.create_invite() to authenticated;
```

#### `accept_invite(p_invite_code uuid)` — Patch B

```sql
create or replace function public.accept_invite(p_invite_code uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;

  -- 본인 초대 링크 차단
  if exists (select 1 from groups where invite_code = p_invite_code and created_by = v_uid) then
    raise exception 'cannot_accept_own_invite';
  end if;

  -- 이미 active group 소속 차단
  if exists (
    select 1 from group_members gm join groups g on g.id = gm.group_id
    where gm.user_id = v_uid and g.status = 'active'
  ) then raise exception 'already_in_active_group'; end if;

  -- atomic: pending → active (RETURNING 으로 race 방어)
  update groups set status = 'active'
    where invite_code = p_invite_code and status = 'pending'
    returning id into v_group_id;
  if v_group_id is null then raise exception 'invite_invalid_or_consumed'; end if;

  insert into group_members(group_id, user_id, role)
    values (v_group_id, v_uid, 'member');

  return json_build_object('group_id', v_group_id, 'status', 'active');
end $$;
revoke all on function public.accept_invite(uuid) from public;
grant execute on function public.accept_invite(uuid) to authenticated;
```

#### `cancel_invite()` — Patch J

```sql
create or replace function public.cancel_invite()
returns void language plpgsql security invoker set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  update groups set status = 'cancelled'
    where status = 'pending' and created_by = v_uid;
  if not found then raise exception 'no_pending_invite'; end if;
end $$;
revoke all on function public.cancel_invite() from public;
grant execute on function public.cancel_invite() to authenticated;
```

#### `dissolve_group()` — Patch H

```sql
create or replace function public.dissolve_group()
returns void language plpgsql security invoker set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  update groups set status = 'dissolved'
    where status = 'active' and created_by = v_uid;
  if not found then raise exception 'no_active_group'; end if;
end $$;
revoke all on function public.dissolve_group() from public;
grant execute on function public.dissolve_group() to authenticated;
```

#### `create_trip(...)` — Patch I

```sql
create or replace function public.create_trip(
  p_title text, p_destination text,
  p_start_date date, p_end_date date,
  p_is_domestic boolean, p_currencies text[]
) returns uuid language plpgsql security invoker set search_path = public as $$
declare v_uid uuid := auth.uid(); v_group_id uuid; v_trip_id uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  -- 날짜 유효성 + 기간 90일 캡은 trips 테이블 CHECK 가 enforce (DoS 방어)
  -- 입력 길이는 CHECK 가 enforce, 여기선 early-exit 만

  -- 활성 그룹이 있으면 자동 연결 (스펙 §6.3)
  select gm.group_id into v_group_id
    from group_members gm join groups g on g.id = gm.group_id
    where gm.user_id = v_uid and g.status = 'active' limit 1;

  insert into trips(created_by, group_id, title, destination, start_date, end_date, is_domestic, currencies)
    values (v_uid, v_group_id, p_title, p_destination, p_start_date, p_end_date, p_is_domestic, p_currencies)
    returning id into v_trip_id;

  insert into trip_days(trip_id, day_number, date)
  select v_trip_id, row_number() over (order by d)::int, d::date
  from generate_series(p_start_date, p_end_date, '1 day'::interval) d;

  return v_trip_id;
end $$;
revoke all on function public.create_trip(text,text,date,date,boolean,text[]) from public;
grant execute on function public.create_trip(text,text,date,date,boolean,text[]) to authenticated;
```

#### `resize_trip_days(...)` — Patch C

```sql
create or replace function public.resize_trip_days(
  p_trip_id uuid, p_new_start date, p_new_end date
) returns void language plpgsql security invoker set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  if p_new_start > p_new_end then raise exception 'invalid_date_range'; end if;

  -- 생성자만 날짜 편집 (스펙 §6.3 "여행 정보 수정 모달")
  select created_by into v_owner from trips where id = p_trip_id;
  if v_owner is null or v_owner != v_uid then
    raise exception 'trip_not_found_or_forbidden';
  end if;

  update trips set start_date = p_new_start, end_date = p_new_end
    where id = p_trip_id;  -- updated_at 은 trigger 가 자동

  -- Phase 2: 일정 없음 → DELETE-all + bulk INSERT 로 renumber race 제거
  delete from trip_days where trip_id = p_trip_id;
  insert into trip_days(trip_id, day_number, date)
  select
    p_trip_id,
    row_number() over (order by d)::int,
    d::date
  from generate_series(p_new_start, p_new_end, '1 day'::interval) d;

  -- Phase 3 확장 지점: DELETE 전에 schedule_items 를 last-kept day 로 재배치하는 로직을 여기에 삽입.
  --   변경 시 시그니처·호출부 불변. body 만 ALTER.
end $$;
revoke all on function public.resize_trip_days(uuid, date, date) from public;
grant execute on function public.resize_trip_days(uuid, date, date) to authenticated;
```

### 2.10 Triggers

#### `enforce_group_status_transition` — Patch E 확장

```sql
create or replace function public.enforce_group_status_transition()
returns trigger language plpgsql security invoker as $$
begin
  -- 상태 전이 규칙:
  -- pending → active ✓
  -- pending → cancelled ✓
  -- active → dissolved ✓
  -- 그 외 ✗
  if old.status = 'pending' and new.status not in ('pending', 'active', 'cancelled') then
    raise exception 'group_invalid_transition_from_pending';
  end if;
  if old.status = 'active' and new.status not in ('active', 'dissolved') then
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
  before update on groups
  for each row execute function public.enforce_group_status_transition();
```

#### `on_group_dissolved` — Patch E

```sql
create or replace function public.on_group_dissolved()
returns trigger language plpgsql security invoker as $$
begin
  -- active → dissolved 전이일 때만 trips fanout
  -- (cancelled 는 active 된 적이 없어 연결된 trips 가 없으므로 fanout 불필요)
  if new.status = 'dissolved' and old.status = 'active' then
    update trips set group_id = null where group_id = new.id;
    -- Phase 3 에서 categories.group_id → null 도 여기에 추가 예정
  end if;
  return new;
end $$;

create trigger groups_dissolution_fanout
  after update on groups
  for each row execute function public.on_group_dissolved();
```

### 2.11 Realtime publication 관리 — Patch M

마이그레이션 `0003_trips.sql` 끝에 명시적으로 publication 구성:

```sql
-- profiles 는 의도적으로 publication 에서 제외 (email 컬럼 WebSocket 누출 방지)
-- Supabase 기본 publication 이 ALL TABLES 이면 먼저 제거
alter publication supabase_realtime drop table if exists public.profiles;

-- Phase 2 구독 대상
alter publication supabase_realtime add table public.trips;
alter publication supabase_realtime add table public.group_members;
alter publication supabase_realtime add table public.groups;

-- trip_days 는 UI 가 직접 구독하지 않음 (resize_trip_days RPC 후 앱 invalidate 로 충분)
-- Phase 3+ 에서 schedule_items/expenses/todos/records 추가 시 이 블록 확장
```

**이유:** Supabase Realtime 은 column-level GRANT 를 우회해 전체 row 를 WebSocket 으로 송출한다. `profiles` 가 publication 에 있으면 `email` 도 전송된다. 명시적 관리로 컬럼 누출 차단.

### 2.12 Security Tradeoffs (문서화)

이 설계에 의도적으로 남긴 트레이드오프:

1. **`already_in_active_group` 에러 문자열의 멤버십 상태 leak**
   - 시나리오: 공격자가 피해자의 세션 + 유효한 pending invite_code 를 동시 소유한 경우, `accept_invite` 응답으로 피해자가 다른 그룹에 속해 있는지 판별 가능.
   - 실질 위험: 공격자가 피해자 세션을 이미 소유했다면 훨씬 더 많은 정보에 직접 접근 가능 — 이 leak 은 marginal.
   - UX 가치: 이 에러에 회복 경로(설정으로 이동 CTA) 제공이 사용자에게 크게 기여. 일반화된 에러로 대체하면 dead-end.
   - 판정: **수용**. 관측 가능성 레이어(로그·텔레메트리)에서 해당 에러는 "expected auth outcome" 으로 수집.

2. **`invite_code` URL path 노출**
   - 시나리오: `/invite/{uuid}` 는 브라우저 히스토리·OS 공유 시트·클립보드에 원문 UUID 노출.
   - 완화: `<meta name="referrer" content="no-referrer">` 로 제3자 Referer 전달 차단. 수락 후 `status` 전이로 자연 무효화.
   - 판정: **수용**. UUID v4 122-bit entropy + status gate 로 실질 brute-force 불가.

3. **`trip_not_found_or_forbidden` 에러의 404/403 미구분**
   - 시나리오: 비소유자가 `resize_trip_days` 호출 시 존재 여부 정보 leak 차단 위해 단일 에러 코드.
   - UI: "여행을 찾을 수 없어요" 단일 카피.
   - 판정: **의도된 정책**. 서버 로깅에서만 원인 구분.

---

## 3. Flows & Realtime

### 3.1 Group 상태 기계

```
                   [create_invite]                      [accept_invite]
           ∅ ────────────────────────▶  pending  ─────────────────────────▶  active
                                          │   │                                │
                                          │   │ [cancel_invite]                │ [dissolve_group]
                                          │   ▼                                ▼
                                          │ cancelled ✕                     dissolved ✕
                                          │                                    │
                                          │                                    ├─ trigger: trips.group_id → NULL
                                          │                                    └─ Realtime 이벤트 → partner "공유 종료" 배너
                                          │
                                          └─ Phase 2 엔 자동 만료 없음 (V2 후보)
```

`enforce_group_status_transition` 이 트리거 레벨에서 역방향·불법 전이 차단.

### 3.2 Realtime 구독 계약

Phase 1 `lib/realtime/channel.ts` scaffold 를 활성화. **테이블별 Postgres Changes 구독 3개** — RLS 가 row 가시성을 자동 필터:

| 채널 | Event | Realtime filter | TanStack Query invalidate | UI 부작용 |
|---|---|---|---|---|
| `trips` | INSERT | RLS (내 접근 가능 trip 만) | `['trips','list']` | — |
| `trips` | UPDATE | 〃 | `['trips','list']` + `['trips','detail',id]` | 현재 보는 detail 에 fresh 데이터 |
| `trips` | DELETE | 〃 | 〃 | — |
| `group_members` | INSERT | 〃 (self row) | `['profile','me']` + `['trips','list']` | 초대 수락 직후 반영 |
| `group_members` | DELETE | 〃 (self row) | `['profile','me']` + `['trips','list']` | — |
| `groups` | UPDATE | `status=eq.dissolved` | `['profile','me']` + `['trips','list']` | **Toast** "파트너와의 공유가 종료되었어요" |

### 3.3 구독 lifecycle

- **Mount:** `<Providers>` 내 `<RealtimeGateway />` 가 `useProfile().data?.id` 존재 시 3 채널 구독.
- **Unmount / 세션 전환:** `useEffect` 의존성에 `session.user.id` 키. 로그아웃·재로그인 시 `supabase.removeAllChannels()` + 재구독. **onAuthStateChange 리스너** 로 session 변동 감지.
- **재연결 복구:** Supabase SDK 기본 exponential backoff. 재연결 콜백에서 `queryClient.invalidateQueries(['trips','list'])` 명시 1회 — 연결 공백 중 놓친 이벤트 강제 복구.
- **Dev/test 전용 훅:** `NODE_ENV !== 'production'` 이면 `window.__realtimeEvents = []` 노출하고 수신 시 push. Playwright 결정적 대기용.

### 3.4 초대 플로우

```
[Owner] /settings/couple
    │ "파트너 초대 링크 생성" tap
    ▼
create_invite RPC
    │ 성공 → /settings/couple pending 모드:
    │   링크 표시 + [복사] [QR] + "파트너가 수락하면 연결됩니다" + [초대 취소]
    │ 실패 (already_in_active_group) → Toast + active 모드로 UI 전환
    ▼  (링크 out-of-band 공유)

[Partner] /invite/{uuid}
    │ middleware 인증 가드 — 로그아웃이면 /login 후 원경로 복귀
    │ <meta name="referrer" content="no-referrer"> 로 Referer leak 차단
    ▼
accept_invite RPC 분기:
    ├─ SUCCESS → /trips 라우팅 + Toast "파트너와 연결되었어요"
    │              Realtime 이벤트로 Owner 탭도 active 모드 자동 전환
    ├─ cannot_accept_own_invite → 모드 전환 (에러 아닌 안내):
    │    "이 링크는 당신이 만들었어요. 파트너에게 보내주세요"
    │    [링크 복사] [설정으로] 버튼
    ├─ already_in_active_group → "이미 파트너와 연결되어 있어요. 기존 연결을 먼저 해제해주세요"
    │    [설정 > 파트너] 딥링크 /settings/couple
    └─ invite_invalid_or_consumed → "초대 링크가 만료되었어요. 상대방에게 새 링크를 요청해주세요"
         [여행 목록으로] /trips
```

[Owner] pending 모드 `[초대 취소]` tap → `cancel_invite` RPC → pending 모드에서 no-group 모드로 UI 전환.

### 3.5 Trip 생성 플로우

```
[Owner] /trips/new
    │ 폼 입력: title, destination, start_date, end_date, is_domestic, currencies
    │ 활성 그룹 존재 시 폼 하단에 read-only 정보 행 (UX 리뷰 반영):
    │   "파트너 {partner_display_name} 와 공유됩니다" + avatar
    │   (V1 은 토글 없음 — group 미연결 시 자동 미표시)
    ▼ Submit
create_trip RPC
    ├─ 성공 → /trips/{new_id} 라우팅 + Realtime 이벤트로 파트너에게 전파
    └─ 실패 (CHECK 제약 위반) → 인라인 에러 (title 길이, 기간 90일, currencies 5개 등)
```

### 3.6 Trip 날짜 변경 플로우

Spec §6.3 "여행 정보 수정 모달" 패턴 유지:

```
[Owner] /trips/{id} → Manage 탭 → "여행 정보 수정"
    ▼ Modal: 전체 필드 편집
    │ 유저 입력: 날짜 변경
    ▼ Submit
    ├─ 축소 감지 → 확인 다이얼로그 (forward-compatible 카피):
    │   "Day N~M 의 일정은 마지막 Day 로 이동돼요"
    │   (Phase 2 는 일정 0건이라 이동 효과 없지만 카피 자체는 Phase 3에도 그대로 유효.
    │    Phase 3 에서 "일정 K개" 등 동적 수치 바인딩만 추가)
    ├─ 확장 또는 동일: 확인 생략
    ▼
resize_trip_days RPC + update trips (title/destination/is_domestic/currencies)
    ├─ invalid_date_range → 인라인 "종료일은 시작일 이후로 설정해주세요"
    ├─ trip_not_found_or_forbidden → Toast "여행을 찾을 수 없어요"
    └─ 성공 → invalidate ['trips','detail',id] + Toast "저장됨"
```

**Optimistic update 정책:**
- 확장: optimistic 가능 (롤백 비용 낮음).
- 축소: **pessimistic** (서버 확정 후 invalidate).

### 3.7 파트너 공유 토글

```
[Owner, Manage 탭] <PartnerShareToggle />
    ├─ Owner: interactive
    ├─ Partner: disabled + tooltip "여행 생성자만 변경할 수 있어요"
    
    ▼ Owner tap
    ├─ OFF → ON (group_id = null → my_active_group_id):
    │   inline 확인 없음
    ├─ ON → OFF (group_id = my_group_id → null):
    │   inline 확인: "파트너가 이 여행을 더 이상 볼 수 없게 됩니다"
    │   [취소] [확인]
    ▼
update trips set group_id = ... (pessimistic — 서버 확정까지 disabled + spinner)
    Realtime → partner /trips 에서 해당 trip 사라짐
```

그룹 미연결 시 토글 자체 렌더 안 함.

### 3.8 해체 플로우 + Partner 복구 경로

```
[Owner] /settings/couple → "파트너 연결 해제" (빨강)
    ▼ 확인 다이얼로그 (2단):
  "파트너 연결을 해제하면 공유 중인 여행 N개가 파트너에게서 사라집니다.
   이 작업은 되돌릴 수 없어요."
  [취소] [해제하기]
    ▼
dissolve_group RPC
    → trigger groups_dissolution_fanout: trips.group_id → null
    ▼
[Partner, Realtime 수신] groups UPDATE status=dissolved
    ├─ 현재 /trips: toast "파트너와의 공유가 종료되었어요" + list refetch (해당 trips 사라짐)
    ├─ 현재 /trips/{id} (방금 사라진 trip):
    │   refetch → PGRST116 → <TripUnavailable />:
    │     "파트너와의 연결이 해제되어 이 여행은 더 이상 볼 수 없어요"
    │     [내 여행 목록으로] /trips
    │   role="status" aria-live="polite" 로 SR 공지
    └─ 기타 라우트: 다음 /trips 방문 시 자연 동기화
```

### 3.9 에러 → UI 카피 매핑 (Phase 2 최종)

| RPC error code | UI 카피 | CTA |
|---|---|---|
| `unauthenticated` | (middleware 차단. 도달 시 /login redirect) | — |
| `invite_invalid_or_consumed` | "초대 링크가 만료되었어요. 상대방에게 새 링크를 요청해주세요" | [여행 목록으로] |
| `cannot_accept_own_invite` | "이 링크는 당신이 만들었어요. 파트너에게 보내주세요" | [링크 복사] [설정으로] |
| `already_in_active_group` (accept 시) | "이미 파트너와 연결되어 있어요. 기존 연결을 먼저 해제해주세요" | [설정 > 파트너] |
| `already_in_active_group` (create_invite 시) | 동일. CTA [기존 연결 해제] 직통 | |
| `no_pending_invite` | (UI 에 취소 버튼이 pending 모드에서만 보이므로 도달 희박. 도달 시 silent + refetch) | — |
| `no_active_group` | (해제 버튼은 active 모드에서만. 도달 시 silent + refetch) | — |
| `invalid_date_range` | "종료일은 시작일 이후로 설정해주세요" | — |
| `trip_not_found_or_forbidden` | "여행을 찾을 수 없어요" | [내 여행 목록으로] |
| `trips_duration_max` (CHECK 위반) | "여행 기간은 최대 90일까지 설정 가능해요" | — |
| `trips_title_length` / `trips_destination_length` | 각 필드 인라인 "100자 이내로 입력해주세요" | — |
| `trips_currencies_count` | "통화는 최대 5개까지 선택 가능해요" | — |
| `user_already_in_active_group` (trigger) | (RPC 가 먼저 잡음. 도달 시 `already_in_active_group` 과 동일 매핑) | — |
| `group_*_transition` (trigger) | (내부 invariant — UI 도달 안함) | — |

---

## 4. Routes · Files · UI Inventory

### 4.1 라우트 스코프

| Route | Phase 2 상태 | 파일 |
|---|---|---|
| `/` | 유지 (Phase 1) | `app/page.tsx` |
| `/login` | 유지 | `app/login/page.tsx` |
| `/trips` | 🟢 실 DB 연결 | `app/trips/page.tsx` |
| `/trips/new` | 🟢 실 DB 연결 (create_trip RPC) | `app/trips/new/page.tsx` |
| `/trips/[id]` | 🟢 shell + Manage 탭 실 DB | `app/trips/[id]/page.tsx` |
| `/trips/[id]` 4 탭 (schedule/expenses/todos/records) | ⚠️ mock UI + 배너 "이 탭은 다음 단계에서 연결됩니다" | `components/trip/*-tab.tsx` |
| `/settings` | 유지 (허브 업데이트) | `app/settings/page.tsx` |
| `/settings/profile` | 🟢 신규 (display_name 저장) | `app/settings/profile/page.tsx` |
| `/settings/couple` | 🟢 신규 (초대 생성·취소·해제) | `app/settings/couple/page.tsx` |
| `/invite/[code]` | 🟢 실 DB 연결 (accept_invite + 4 분기) | `app/invite/[code]/page.tsx` |
| `/share/[token]` | Phase 6 | — |

**TripUnavailable:** 별도 라우트가 아니라 `/trips/[id]/page.tsx` 내 PGRST116 감지 시 `<TripUnavailable />` conditional render.

### 4.2 파일 구조 (Phase 1 delta)

```
supabase/migrations/
├── 0001_profiles.sql       # 기존
├── 0002_groups.sql         # 신규
└── 0003_trips.sql          # 신규

lib/
├── env.ts, auth/, profile/, query/, store/, supabase/    # 기존 (Phase 1)
├── profile/use-update-display-name.ts                    # 신규
├── group/                                                 # 신규 도메인
│   ├── use-my-group.ts
│   ├── use-create-invite.ts
│   ├── use-accept-invite.ts
│   ├── use-cancel-invite.ts
│   ├── use-dissolve-group.ts
│   └── invite-url.ts
├── trip/                                                  # 신규 도메인
│   ├── use-trips-list.ts
│   ├── use-trip-detail.ts
│   ├── use-create-trip.ts
│   ├── use-update-trip.ts
│   ├── use-resize-trip-days.ts
│   ├── use-delete-trip.ts
│   ├── use-partner-share-toggle.ts
│   └── trip-grouping.ts
├── realtime/
│   ├── channel.ts                   # 기존 scaffold (확장)
│   ├── trips-channel.ts             # 신규
│   ├── group-members-channel.ts     # 신규
│   ├── groups-channel.ts            # 신규
│   └── use-realtime-gateway.ts      # 구독 lifecycle
├── mocks/
│   ├── trips.ts, groups.ts          # 삭제
│   ├── profiles.ts                  # Phase 1 에서 이미 삭제
│   ├── schedule-items.ts, expenses.ts, todos.ts, records.ts, guest-shares.ts  # 유지 (factory 재배선)
│   ├── factory.ts                   # 신규 (NODE_ENV guard)
│   ├── helpers.ts, index.ts         # 축소
└── query/keys.ts                     # 기존 + trip/group 키 추가

types/database.ts                    # pnpm db:types 재생성

middleware.ts                        # 기존 (변경 없음)

app/
├── providers.tsx                    # 기존 + <RealtimeGateway />
├── trips/page.tsx                   # 기존 (useTripsList 배선)
├── trips/new/page.tsx               # 기존 (useCreateTrip 배선)
├── trips/[id]/page.tsx              # 기존 (useTripDetail + TripUnavailable 분기)
├── settings/page.tsx                # 기존 (링크 허브)
├── settings/profile/page.tsx        # 신규
├── settings/couple/page.tsx         # 신규
└── invite/[code]/page.tsx           # 기존 mockup (accept_invite 배선 + 4 분기)

components/
├── trip/
│   ├── trip-card.tsx, trip-list.tsx        # 기존 (실 데이터)
│   ├── create-trip-form.tsx                # 기존 (배선)
│   ├── edit-trip-modal.tsx                 # 신규 (§6.3 모달 패턴)
│   ├── partner-share-toggle.tsx            # 기존 (pessimistic 배선)
│   ├── delete-trip-dialog.tsx              # 신규
│   ├── date-shrink-confirm.tsx             # 신규
│   ├── trip-unavailable.tsx                # 신규
│   ├── manage-tab.tsx                      # 기존 (조립)
│   └── {schedule,expenses,todos,records}-tab.tsx  # 기존 mock + "다음 단계" 배너
├── settings/
│   ├── color-palette.tsx                   # 기존
│   ├── profile-display-name.tsx            # 신규 (명시 [저장])
│   └── couple-section.tsx                  # 신규 (3 모드: no-group / pending / active)
├── invite/
│   ├── invite-accept-card.tsx              # 기존 mockup (4 분기)
│   └── invite-copy-screen.tsx              # 신규 (own-invite 모드)
├── realtime/
│   └── realtime-gateway.tsx                # 신규 ("use client")
└── ui/                                      # 기존 primitives 유지

tests/
├── unit/                            # 기존 + trip-grouping, invite-url, trip-date-validation
├── integration/                     # 기존 + rls-groups, rls-trips, accept-invite-race,
│                                     #        create-invite-idempotent, cancel-invite,
│                                     #        create-trip, resize-trip-days,
│                                     #        dissolve-group-cascade, updated-at-trigger,
│                                     #        realtime-publication-audit, display-name-xss
└── e2e/                             # 기존 + invite-flow, trip-crud,
                                      #         partner-realtime, dissolution, share-toggle
```

### 4.3 UI 컴포넌트 카피 (Phase 2 신규 — Korean)

| Component | 상태 | 카피 |
|---|---|---|
| `couple-section` (no-group) | 초기 | "파트너와 함께 여행을 계획해보세요" · [파트너 초대하기] |
| 〃 (pending) | 대기 | "초대 링크를 생성했어요" · 링크 표시 · [복사] [QR] · "파트너가 수락하면 연결됩니다" · [초대 취소] |
| 〃 (active) | 연결됨 | 파트너 프로필 카드 (avatar·display_name·색) · [파트너 연결 해제] (빨강) |
| `delete-trip-dialog` (solo) | 확인 | "'{title}'을(를) 삭제하시겠어요?" · "일정·경비·기록이 모두 함께 사라집니다." · [취소] [삭제] |
| 〃 (공유 중) | 확인 (경고 강화) | "파트너의 데이터도 함께 삭제됩니다" 추가 |
| `date-shrink-confirm` | 축소 | "Day {n1}~{n2} 의 일정은 마지막 Day 로 이동돼요" (forward-compatible) |
| `trip-unavailable` | Partner 진입 | "파트너와의 연결이 해제되어 이 여행은 더 이상 볼 수 없어요" · [내 여행 목록으로] |
| `partner-share-toggle` ON→OFF | inline | "파트너가 이 여행을 더 이상 볼 수 없게 됩니다" · [취소] [확인] |
| 〃 Partner view | disabled | tooltip "여행 생성자만 변경할 수 있어요" |
| `invite-accept-card` SUCCESS | toast | "파트너와 연결되었어요" |
| `invite-copy-screen` | 안내 | "이 링크는 당신이 만들었어요. 파트너에게 보내주세요" · [링크 복사] [설정으로] |
| `create-trip-form` (active group 있을 때) | read-only 행 | "파트너 {display_name} 와 공유됩니다" + avatar |
| `profile-display-name` 저장 | toast | "저장되었어요" (empty 저장 시 "이름을 비워두었어요") |

**용어 통일:** "파트너 연결 해제" (action) / "파트너와의 연결이 해제되었어요" (post-state). "해체"·"종료" 사용 금지.

### 4.4 Mock → Real 전환 정책

Phase 1 UUID mismatch 교훈 반영:

| 파일 | 처리 |
|---|---|
| `lib/mocks/trips.ts`, `groups.ts` | **삭제** |
| `lib/mocks/profiles.ts` | 이미 Phase 1 에서 삭제 |
| `lib/mocks/schedule-items.ts`, `expenses.ts`, `todos.ts`, `records.ts`, `guest-shares.ts` | 유지 |
| `lib/mocks/factory.ts` | **신규** — 로그인 유저의 `useProfile().data.id` + 실 trip (첫 번째 생성된 것) id 를 입력으로 받아 순수 in-memory mock 객체 반환. **Supabase 클라이언트 호출 금지** |
| `lib/mocks/helpers.ts`, `index.ts` | 축소 — 제거된 mock 제외 |

**factory 보안 가드 (Patch N):**
```ts
if (process.env.NODE_ENV === "production") {
  throw new Error("lib/mocks/factory must not be imported in production builds");
}
```

**eslint 가드:** `no-restricted-imports` 로 `lib/mocks/factory` 를 테스트·컴포넌트(탭) 외 경로에서 import 시 에러.

**UX:** 4 mock 탭 상단에 영구 배너 "이 탭은 다음 단계에서 실 데이터로 연결됩니다".

### 4.5 Route guards & middleware

Phase 1 middleware 그대로 유지 (세션 refresh + 보호 라우트). `/invite/[code]` 도 이미 보호 라우트로 커버.

**`/invite/[code]` 추가 사항:** `export const metadata: Metadata = { referrer: 'no-referrer' }` in `app/invite/[code]/page.tsx` (Next.js 16 App Router metadata API).

---

## 5. Pre-flight · Tests · Risks · Exit

### 5.1 Pre-flight

Phase 1 완료 상태 전제. **신규 최소:**

| 항목 | 상태 | 비고 |
|---|---|---|
| Supabase CLI · link · 인증 | ✅ Phase 1 | — |
| Google OAuth Client · `.env.local` | ✅ Phase 1 | — |
| Supabase Dashboard Realtime publication 확인 | ⚠️ 신규 | 마이그레이션 적용 후 Database → Publications → `supabase_realtime` 열어서 `trips/group_members/groups` 3개만 체크, `profiles` 해제 상태인지 육안 확인 |
| Studio 테스트 유저 (alice/bob) | ✅ Phase 1 재사용 | integration fixture 고정 |

### 5.2 Mock vs Real-DB Scope (Phase 2 종료 시점)

| 항목 | 상태 |
|---|---|
| `auth.users`, `public.profiles` | ✅ 실 DB (Phase 1) |
| `public.groups`, `group_members` | ✅ 실 DB (Phase 2 신규) |
| `public.trips`, `trip_days` | ✅ 실 DB (Phase 2 신규) |
| `schedule_items`, `expenses`, `todos`, `records`, `guest_shares`, `categories` | ⚠️ mock (factory 재배선, Phase 3+ 에서 실 DB) |
| `/trips`, `/trips/new`, `/trips/[id]` shell+Manage, `/settings/*`, `/invite/[code]` | ✅ 실 DB |
| `/trips/[id]` 4 탭 | ⚠️ mock UI + 영구 배너 |
| Realtime trips/group_members/groups | ✅ 활성 |

### 5.3 Test Strategy

#### Unit (vitest, jsdom)

신규:
- `tests/unit/trip-grouping.test.ts` — 진행중/다가오는/지난 경계값 (KST 타임존)
- `tests/unit/invite-url.test.ts` — 링크 빌드·파싱·UUID 검증
- `tests/unit/trip-date-validation.test.ts` — 90일 캡·범위 반전 클라이언트 검증

**Coverage threshold:** `lib/trip/`, `lib/group/`, `lib/realtime/` ≥ 80% (lines/functions/branches/statements). 기존 `lib/profile/`, `lib/auth/` 100% 유지.

#### Integration (`vitest.integration.config.ts`, node, 실 Supabase)

alice/bob fixture, 각 테스트 전 `truncate cascade + seed` 헬퍼로 리셋:

| Spec 파일 | 시나리오 |
|---|---|
| `rls-groups.spec.ts` | owner SELECT own / 타 유저 SELECT 차단 / **direct `group_members.insert()` 403 (WITH CHECK false)** / owner self-DELETE 차단 / `invite_code` 컬럼 GRANT 없음 |
| `rls-trips.spec.ts` | owner CRUD own / member SELECT shared / stranger SELECT 차단 / `can_access_trip(uuid)` **SQL fn 직접 truth table** (owner/partner/stranger/dissolved-group/no-group 5 유형) / non-owner UPDATE 차단 |
| `accept-invite-race.spec.ts` | `Promise.all([bob.rpc, carol.rpc])` **20회 루프** — 매회 1 success + 1 `invite_invalid_or_consumed` |
| `create-invite-idempotent.spec.ts` | 두 번 호출 시 같은 invite_code 재사용 (`reused: true`) |
| `cancel-invite.spec.ts` | cancelled 전이 후 같은 code 재수락 → invalid, cancelled→active 전이 차단 |
| `create-trip.spec.ts` | active group auto-link / title 101자 거부 / currencies 6개 거부 / 기간 91일 거부 / 활성 그룹 없을 때 group_id NULL |
| `resize-trip-days.spec.ts` | 확장 / 축소 / 동일 / 단일일 / 비소유자 / 범위 반전 / 연속 호출 idempotent 7 케이스 |
| `dissolve-group-cascade.spec.ts` | dissolve → trips.group_id 전부 NULL / partner SELECT 차단 / dissolved→active 전이 차단 |
| `updated-at-trigger.spec.ts` | trips UPDATE 시 `updated_at` 갱신 |
| `realtime-publication-audit.spec.ts` | `select tablename from pg_publication_tables where pubname='supabase_realtime'` — profiles 없음, trips/group_members/groups 있음 |
| `display-name-xss.spec.ts` | `<script>` 등 특수문자 저장 OK + 렌더 결과 literal 스냅샷 |

#### E2E (Playwright, 2 browser context)

```
tests/e2e/
├── login.spec.ts            # 기존
├── invite-flow.spec.ts      # owner create → partner accept → /trips 도달
├── trip-crud.spec.ts        # create → edit (title/date) → delete
├── partner-realtime.spec.ts # 2 context: owner 생성 → partner 5초 내 보임
├── dissolution.spec.ts      # 2 context: owner dissolve → partner trip-unavailable + /trips 축소
└── share-toggle.spec.ts     # 2 context: toggle OFF 시 partner 접근 403
```

**Realtime 결정적 검증:** `window.__realtimeEvents` 훅 (`NODE_ENV !== 'production'`). Playwright 에서 `page.waitForFunction(() => (window as any).__realtimeEvents.some(...))` 로 flaky 대기 제거.

#### Verification SQL

Phase 1 Studio 쿼리 패턴 확장 (`docs/qa/phase2-rls-manual-check.md` 템플릿):

```sql
-- (1) 정책 목록
select tablename, policyname from pg_policies
where schemaname='public' and tablename in ('groups','group_members','trips','trip_days')
order by tablename, policyname;

-- (2) Realtime publication
select tablename from pg_publication_tables where pubname='supabase_realtime';
-- Expected: groups, group_members, trips (profiles 없음)

-- (3) 함수 privilege
select p.proname, array_agg(distinct r.grantee) as grantees
from information_schema.routine_privileges r
join pg_proc p on p.proname = r.routine_name
where r.routine_schema='public' and p.proname in 
  ('can_access_trip','accept_invite','create_invite','cancel_invite','dissolve_group','create_trip','resize_trip_days')
group by p.proname;
-- Expected: 모두 grantees = {authenticated} (public 없음)

-- (4) CHECK 제약
select conname from pg_constraint where conrelid='public.trips'::regclass and contype='c';
-- Expected: trips_title_length, trips_destination_length, trips_date_range, trips_duration_max, trips_currencies_count

-- (5) 트리거
select tgname, tgrelid::regclass from pg_trigger
where tgisinternal=false and tgrelid::regclass::text like 'public.%' order by 2, 1;
-- Expected (Phase 2 종료): on_auth_user_created, group_members_active_uniqueness,
--           groups_status_transition, groups_dissolution_fanout, trips_set_updated_at

-- (6) RLS 활성 여부
select relname, relrowsecurity from pg_class
where relnamespace='public'::regnamespace and relname in ('groups','group_members','trips','trip_days');
-- Expected: 모두 relrowsecurity = t
```

### 5.4 Risks

| ID | Sev | 리스크 | 대응 |
|---|---|---|---|
| R1 | High | Realtime 이벤트 유실·지연 (무료 tier 200 concurrent 제한) | 재연결 시 `['trips','list']` invalidate 복구. E2E 5초 soft 타임아웃 |
| R2 | High | `accept_invite` race 가 20회 루프에서 flaky | `update ... returning` 앞에 `select ... for update of groups` 추가 |
| R3 | Med | `resize_trip_days` 가 Phase 3 schedule_items 이동 로직 삽입 시 atomicity 훼손 | Phase 2 7 케이스 baseline → Phase 3 diff 회귀 감지 |
| R4 | Med | Mock factory 가 production 번들에 실수 포함 | `NODE_ENV==='production'` throw + eslint guard + `next build` 실패 |
| R5 | Med | `display_name` 40자 제약이 IME·emoji·joiner 로 실제 시각 문자수 변동 | 서버 40, UI 36 + live count. 경계값 테스트 |
| R6 | Med | supabase-js 업그레이드가 `PostgrestVersion` 바꿈 → `update() never` 재발 | Phase 1 workaround 유지 + `pnpm db:types` 후 typecheck CI gate |
| R7 | Low | 90일 여행 기간 캡이 실사용 부족 피드백 | CHECK 단일 마이그레이션 조정 |
| R8 | Low | 3채널 구독이 모바일 배터리 영향 | Phase 8 PWA 에서 visibilitychange 대응 |

### 5.5 Phase 2 Exit Criteria

#### A. 자동 검증 (CI gate)

1. `pnpm build` — TypeScript 0 에러
2. `pnpm test` unit — pass, coverage threshold 통과
3. `pnpm test:integration` — 모든 spec pass. accept-invite-race 20회 deterministic
4. `pnpm exec playwright test` — 6 E2E pass, flaky 허용 0
5. `pnpm audit --production` — high/critical 0
6. `pnpm lint` — 0 error, `no-restricted-imports` 규칙 발동 없음
7. Verification SQL 6 쿼리 예상 결과 매칭
8. `types/database.ts` 최신 (`pnpm db:types` diff 없음)

#### B. 수동 검증 (실 Google 계정 2개)

| # | 시나리오 | 기대 |
|---|---|---|
| 1 | A `/settings/couple` → 초대 링크 생성 | pending 모드 UI + 링크·QR·복사 |
| 2 | B 로그아웃 상태로 초대 URL 접근 | `/login` 리다이렉트 → 로그인 후 원경로 복귀 |
| 3 | B 수락 | `/trips` 로 라우팅 + Toast "파트너와 연결되었어요". A 탭에서 active 모드로 자동 전환 (Realtime) |
| 4 | A `/trips/new` | 하단에 "파트너 {B} 와 공유됩니다" 정보 행 노출 |
| 5 | A 여행 생성 | B 의 `/trips` 에 5초 내 자동 등장 (새로고침 없음) |
| 6 | A 여행 날짜 확장 | 확인 없이 저장, B 반영 |
| 7 | A 여행 날짜 축소 (Day 4→Day 2) | "Day 3~4 의 일정은 마지막 Day 로 이동돼요" 확인 → 저장, B 반영 |
| 8 | A Manage 탭 partner-share OFF | inline 확인 → B 의 `/trips` 목록에서 사라짐, B 가 직접 `/trips/{id}` 접근 → `trip-unavailable` |
| 9 | A `/settings/couple` → 파트너 연결 해제 | 2단 확인 빨강 → B 측 toast + `/trips` 축소 + 공유되던 trip URL → `trip-unavailable` |
| 10 | A 로그아웃 후 재로그인 | 세션 복원, 구독 재수립, 놓친 이벤트 invalidate 복구 |
| 11 | Chrome DevTools | CSP 위반 0, Realtime WebSocket 연결, `window.__realtimeEvents` 이벤트 누적 (dev) |

#### C. 문서 산출물

- [x] `docs/specs/2026-04-19-phase2-trip-core-design.md` — 이 설계 문서
- [ ] `docs/plans/2026-04-19-phase2-trip-core.md` — 구현 계획 (`writing-plans` 스킬)
- [ ] `docs/qa/phase2-rls-manual-check.md` — RLS 수동 검증 결과 템플릿
- [ ] Git tag `phase-2-trip-core` (push 포함)
- [ ] Phase 2 retrospective — `docs/plans/2026-04-19-phase2-trip-core.md` 끝에 append

---

## 6. Phase 3 Handoff

Phase 2 설계가 Phase 3 에 남기는 확장 지점:

| 영역 | Phase 3 작업 |
|---|---|
| `resize_trip_days` | body 에 schedule_items 이동 로직 삽입 (DELETE 전에 last-kept day 로 재배치). 시그니처·호출부 불변. |
| `can_access_trip` | `schedule_items`/`expenses`/`todos`/`records` RLS 에서 재사용 — 수정 불필요 |
| `date-shrink-confirm` UI | 카피는 이미 forward-compatible. 동적 수치("일정 K개") 바인딩만 추가 |
| `on_group_dissolved` | `categories.group_id → null` fanout 추가 |
| Realtime publication | `ALTER PUBLICATION supabase_realtime ADD TABLE schedule_items, expenses, todos, records;` |
| Mock factory | 실 테이블 연결된 탭에서 import 제거 |
| 지도 API | ADR 필요 (Google Maps 해외, Naver Maps 국내). Phase 2 범위 밖 |
| 카테고리 | `categories` 테이블 + 기본 카테고리 시드 + 그룹 형성 시 개인 category fanout |

---

## 참고 문서

- 전체 스펙: `docs/superpowers/specs/2026-04-16-travel-manager-design.md`
- Phase 1 구현 계획: `docs/plans/2026-04-17-phase1-auth.md`
- Phase 0 목업 리뷰: `docs/mockup/mockup-review.md`
- DESIGN.md: 프로젝트 루트
- ADR: `~/.MY_AI_WIKI/projects/travel-manager/decisions/` (위키)
