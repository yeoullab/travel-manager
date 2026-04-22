-- 0016_guest_shares.sql
-- Phase 4: guest_shares 테이블 + RLS + get_guest_trip_data RPC (anon GRANT)
-- 의존: 0003_trips.sql, 0005_schedule_items.sql, 0010_expenses.sql, 0012_todos.sql, 0014_records.sql

-- ── guest_shares 테이블 ────────────────────────────────────────────────
create table public.guest_shares (
  id             uuid        primary key default gen_random_uuid(),
  trip_id        uuid        not null references public.trips(id) on delete cascade,
  token          uuid        not null unique default gen_random_uuid(),
  show_schedule  boolean     not null default true,
  show_expenses  boolean     not null default false,
  show_todos     boolean     not null default false,
  show_records   boolean     not null default false,
  is_active      boolean     not null default true,
  expires_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 1 trip = 1 active share 제약 (Phase 4 단순화; 복수 활성 share 는 V2)
create unique index idx_guest_shares_active_unique
  on public.guest_shares(trip_id) where is_active;

create index idx_guest_shares_token on public.guest_shares(token);
create index idx_guest_shares_trip  on public.guest_shares(trip_id);

create trigger guest_shares_set_updated_at
  before update on public.guest_shares
  for each row execute function public.set_updated_at();

alter table public.guest_shares enable row level security;

-- SELECT: trip 접근 가능자 (owner / member)
create policy "guest_shares_select"
  on public.guest_shares for select to authenticated
  using (public.can_access_trip(trip_id));

-- INSERT/UPDATE/DELETE: **owner 만** (`trips.created_by = auth.uid()`)
create policy "guest_shares_insert"
  on public.guest_shares for insert to authenticated
  with check (
    exists (select 1 from public.trips where id = trip_id and created_by = auth.uid())
  );

create policy "guest_shares_update"
  on public.guest_shares for update to authenticated
  using (
    exists (select 1 from public.trips where id = trip_id and created_by = auth.uid())
  )
  with check (
    exists (select 1 from public.trips where id = trip_id and created_by = auth.uid())
  );

create policy "guest_shares_delete"
  on public.guest_shares for delete to authenticated
  using (
    exists (select 1 from public.trips where id = trip_id and created_by = auth.uid())
  );

-- ── get_guest_trip_data (anon GRANT, 보안 체크리스트 원본 §6.8 준수) ────
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
  -- 1. 토큰 검증 (에러 메시지 없이 null - 토큰 존재 여부 leak 방지)
  select * into v_share from public.guest_shares
    where token = p_token
      and is_active = true
      and (expires_at is null or expires_at > now());
  if v_share.id is null then return null; end if;

  -- 2. trip
  select * into v_trip from public.trips where id = v_share.trip_id;
  if v_trip.id is null then return null; end if;

  -- 3. show_* 기반 섹션 조합 (전부 camelCase 키 — 클라이언트 TS 매핑 일관성)
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

  -- 4. 최종 JSON (PII 제외: paid_by / assigned_to / email / uuid 전부 생략)
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

-- ROLLBACK
-- drop function if exists public.get_guest_trip_data(uuid);
-- drop table if exists public.guest_shares;
