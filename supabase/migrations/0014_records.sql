-- 0014_records.sql
-- Phase 4: records 테이블 + RLS + 인덱스 + Realtime
-- 의존: 0003_trips.sql (trips, can_access_trip)

create table public.records (
  id          uuid        primary key default gen_random_uuid(),
  trip_id     uuid        not null references public.trips(id) on delete cascade,
  title       text        not null,
  content     text        not null,
  date        date        not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.records
  add constraint records_title_length   check (char_length(title) between 1 and 100),
  add constraint records_content_length check (char_length(content) between 1 and 20000);

create index idx_records_trip      on public.records(trip_id);
create index idx_records_trip_date on public.records(trip_id, date);

create trigger records_set_updated_at
  before update on public.records
  for each row execute function public.set_updated_at();

alter table public.records enable row level security;

create policy "records_select"
  on public.records for select to authenticated
  using (public.can_access_trip(trip_id));

create policy "records_insert"
  on public.records for insert to authenticated
  with check (public.can_access_trip(trip_id));

create policy "records_update"
  on public.records for update to authenticated
  using (public.can_access_trip(trip_id))
  with check (public.can_access_trip(trip_id));

create policy "records_delete"
  on public.records for delete to authenticated
  using (public.can_access_trip(trip_id));

alter publication supabase_realtime add table public.records;

-- ROLLBACK
-- alter publication supabase_realtime drop table public.records;
-- drop table if exists public.records;
