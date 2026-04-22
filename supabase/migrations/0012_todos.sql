-- 0012_todos.sql
-- Phase 4: todos 테이블 + RLS + 인덱스 + Realtime
-- 의존: 0003_trips.sql (trips, can_access_trip)

create table public.todos (
  id            uuid        primary key default gen_random_uuid(),
  trip_id       uuid        not null references public.trips(id) on delete cascade,
  title         text        not null,
  memo          text,
  is_completed  boolean     not null default false,
  assigned_to   uuid        references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.todos
  add constraint todos_title_length check (char_length(title) between 1 and 100),
  add constraint todos_memo_length  check (memo is null or char_length(memo) <= 1000);

create index idx_todos_trip           on public.todos(trip_id);
create index idx_todos_trip_completed on public.todos(trip_id, is_completed);

create trigger todos_set_updated_at
  before update on public.todos
  for each row execute function public.set_updated_at();

alter table public.todos enable row level security;

create policy "todos_select"
  on public.todos for select to authenticated
  using (public.can_access_trip(trip_id));

create policy "todos_insert"
  on public.todos for insert to authenticated
  with check (public.can_access_trip(trip_id));

create policy "todos_update"
  on public.todos for update to authenticated
  using (public.can_access_trip(trip_id))
  with check (public.can_access_trip(trip_id));

create policy "todos_delete"
  on public.todos for delete to authenticated
  using (public.can_access_trip(trip_id));

alter publication supabase_realtime add table public.todos;

-- ROLLBACK
-- alter publication supabase_realtime drop table public.todos;
-- drop table if exists public.todos;
