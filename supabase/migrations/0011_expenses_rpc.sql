-- 0011_expenses_rpc.sql
-- Phase 4: expenses CRUD RPC (create/update/delete)
-- 의존: 0010_expenses.sql

-- ── create_expense ─────────────────────────────────────────────────────
create or replace function public.create_expense(
  p_trip_id          uuid,
  p_expense_date     date,
  p_title            text,
  p_amount           numeric,
  p_currency         text default 'KRW',
  p_category_code    text default 'other',
  p_paid_by          uuid default null,
  p_schedule_item_id uuid default null,
  p_memo             text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_is_domestic  boolean;
  v_currencies   text[];
  v_sched_trip   uuid;
  v_new_id       uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  if not public.can_access_trip(p_trip_id) then raise exception 'forbidden'; end if;

  -- 통화 정합성: 국내면 KRW 고정, 해외면 trips.currencies 에 포함되어야 (KRW 항상 허용)
  select is_domestic, currencies into v_is_domestic, v_currencies
    from public.trips where id = p_trip_id;
  if v_is_domestic then
    if p_currency != 'KRW' then raise exception 'currency_not_allowed'; end if;
  else
    if p_currency != 'KRW' and not (p_currency = any(v_currencies)) then
      raise exception 'currency_not_allowed';
    end if;
  end if;

  -- schedule_item_id ↔ trip_id 일치 검증
  if p_schedule_item_id is not null then
    select td.trip_id into v_sched_trip
      from public.schedule_items si
      join public.trip_days td on td.id = si.trip_day_id
      where si.id = p_schedule_item_id;
    if v_sched_trip is null then raise exception 'schedule_item_not_found'; end if;
    if v_sched_trip != p_trip_id then raise exception 'schedule_trip_mismatch'; end if;
  end if;

  -- paid_by 는 trip 접근 가능자여야 (설정 시)
  if p_paid_by is not null then
    if not (
      exists (select 1 from public.trips where id = p_trip_id and created_by = p_paid_by)
      or exists (
        select 1 from public.group_members gm
        join public.trips t on t.group_id = gm.group_id
        where t.id = p_trip_id and gm.user_id = p_paid_by
      )
    ) then raise exception 'paid_by_not_trip_member'; end if;
  end if;

  insert into public.expenses(
    trip_id, expense_date, title, amount, currency,
    category_code, paid_by, schedule_item_id, memo
  ) values (
    p_trip_id, p_expense_date, p_title, p_amount, p_currency,
    p_category_code, p_paid_by, p_schedule_item_id, p_memo
  ) returning id into v_new_id;

  return v_new_id;
end $$;

revoke all on function public.create_expense(
  uuid, date, text, numeric, text, text, uuid, uuid, text
) from public;
grant execute on function public.create_expense(
  uuid, date, text, numeric, text, text, uuid, uuid, text
) to authenticated;

-- ── update_expense ─────────────────────────────────────────────────────
create or replace function public.update_expense(
  p_expense_id       uuid,
  p_expense_date     date,
  p_title            text,
  p_amount           numeric,
  p_currency         text,
  p_category_code    text,
  p_paid_by          uuid default null,
  p_schedule_item_id uuid default null,
  p_memo             text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_trip_id     uuid;
  v_is_domestic boolean;
  v_currencies  text[];
  v_sched_trip  uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;

  select trip_id into v_trip_id from public.expenses where id = p_expense_id;
  if v_trip_id is null then raise exception 'expense_not_found'; end if;
  if not public.can_access_trip(v_trip_id) then raise exception 'forbidden'; end if;

  select is_domestic, currencies into v_is_domestic, v_currencies
    from public.trips where id = v_trip_id;
  if v_is_domestic then
    if p_currency != 'KRW' then raise exception 'currency_not_allowed'; end if;
  else
    if p_currency != 'KRW' and not (p_currency = any(v_currencies)) then
      raise exception 'currency_not_allowed';
    end if;
  end if;

  if p_schedule_item_id is not null then
    select td.trip_id into v_sched_trip
      from public.schedule_items si
      join public.trip_days td on td.id = si.trip_day_id
      where si.id = p_schedule_item_id;
    if v_sched_trip is null then raise exception 'schedule_item_not_found'; end if;
    if v_sched_trip != v_trip_id then raise exception 'schedule_trip_mismatch'; end if;
  end if;

  if p_paid_by is not null then
    if not (
      exists (select 1 from public.trips where id = v_trip_id and created_by = p_paid_by)
      or exists (
        select 1 from public.group_members gm
        join public.trips t on t.group_id = gm.group_id
        where t.id = v_trip_id and gm.user_id = p_paid_by
      )
    ) then raise exception 'paid_by_not_trip_member'; end if;
  end if;

  update public.expenses
    set expense_date = p_expense_date,
        title = p_title,
        amount = p_amount,
        currency = p_currency,
        category_code = p_category_code,
        paid_by = p_paid_by,
        schedule_item_id = p_schedule_item_id,
        memo = p_memo
    where id = p_expense_id;
end $$;

revoke all on function public.update_expense(
  uuid, date, text, numeric, text, text, uuid, uuid, text
) from public;
grant execute on function public.update_expense(
  uuid, date, text, numeric, text, text, uuid, uuid, text
) to authenticated;

-- ── delete_expense ─────────────────────────────────────────────────────
create or replace function public.delete_expense(p_expense_id uuid)
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
  select trip_id into v_trip_id from public.expenses where id = p_expense_id;
  if v_trip_id is null then raise exception 'expense_not_found'; end if;
  if not public.can_access_trip(v_trip_id) then raise exception 'forbidden'; end if;
  delete from public.expenses where id = p_expense_id;
end $$;

revoke all on function public.delete_expense(uuid) from public;
grant execute on function public.delete_expense(uuid) to authenticated;

-- ── ROLLBACK ───────────────────────────────────────────────────────────
-- drop function if exists public.delete_expense(uuid);
-- drop function if exists public.update_expense(uuid, date, text, numeric, text, text, uuid, uuid, text);
-- drop function if exists public.create_expense(uuid, date, text, numeric, text, text, uuid, uuid, text);
