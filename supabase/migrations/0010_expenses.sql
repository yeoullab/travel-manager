-- 0010_expenses.sql
-- Phase 4: expenses 테이블 + RLS + 인덱스 + Realtime publication
-- 의존: 0003_trips.sql (trips, can_access_trip), 0005_schedule_items.sql (schedule_items FK 대상)

-- ── expenses 테이블 ───────────────────────────────────────────────────
create table public.expenses (
  id                uuid           primary key default gen_random_uuid(),
  trip_id           uuid           not null references public.trips(id) on delete cascade,
  expense_date      date           not null,
  title             text           not null,
  amount            numeric(12,2)  not null,
  currency          text           not null default 'KRW',
  category_code     text           not null default 'other',
  paid_by           uuid           references public.profiles(id) on delete set null,
  schedule_item_id  uuid           references public.schedule_items(id) on delete set null,
  memo              text,
  created_at        timestamptz    not null default now(),
  updated_at        timestamptz    not null default now()
);

-- ── CHECK 제약 ─────────────────────────────────────────────────────────
alter table public.expenses
  add constraint expenses_title_length      check (char_length(title) between 1 and 100),
  add constraint expenses_currency_code     check (char_length(currency) = 3 and currency ~ '^[A-Z]+$'),
  add constraint expenses_amount_nonneg     check (amount >= 0),
  add constraint expenses_amount_max        check (amount <= 9999999999.99),
  add constraint expenses_memo_length       check (memo is null or char_length(memo) <= 1000),
  add constraint expenses_category_valid    check (
    category_code in ('food','transport','lodging','shopping','activity','other')
  );

-- ── 인덱스 ─────────────────────────────────────────────────────────────
create index idx_expenses_trip       on public.expenses(trip_id);
create index idx_expenses_trip_date  on public.expenses(trip_id, expense_date);
create index idx_expenses_schedule   on public.expenses(schedule_item_id)
  where schedule_item_id is not null;
create index idx_expenses_category   on public.expenses(trip_id, category_code);

-- ── 트리거: updated_at (set_updated_at 은 0003_trips.sql 에서 정의됨) ──
create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────
alter table public.expenses enable row level security;

create policy "expenses_select"
  on public.expenses for select to authenticated
  using (public.can_access_trip(trip_id));

create policy "expenses_insert"
  on public.expenses for insert to authenticated
  with check (public.can_access_trip(trip_id));

create policy "expenses_update"
  on public.expenses for update to authenticated
  using (public.can_access_trip(trip_id))
  with check (public.can_access_trip(trip_id));

create policy "expenses_delete"
  on public.expenses for delete to authenticated
  using (public.can_access_trip(trip_id));

-- ── Realtime publication 확장 (0005 선례: unguarded alter) ─────────────
alter publication supabase_realtime add table public.expenses;

-- ── ROLLBACK ───────────────────────────────────────────────────────────
-- alter publication supabase_realtime drop table public.expenses;
-- drop table if exists public.expenses;
