-- 0005_schedule_items.sql
-- Phase 3: schedule_items 테이블 + RLS + 인덱스 + CHECK + 트리거 + Realtime publication
-- 의존: 0003_trips.sql (trip_days), 0002_groups.sql (can_access_trip)

-- ── schedule_items 테이블 ──────────────────────────────────────────────
create table public.schedule_items (
  id                uuid        primary key default gen_random_uuid(),
  trip_day_id       uuid        not null references public.trip_days(id) on delete cascade,
  title             text        not null,
  sort_order        int         not null,
  time_of_day       time without time zone,
  place_name        text,
  place_address     text,
  place_lat         double precision,
  place_lng         double precision,
  place_provider    text,
  place_external_id text,
  memo              text,
  url               text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── CHECK 제약 (Patch C/D/E/F) ─────────────────────────────────────────
alter table public.schedule_items
  add constraint schedule_items_title_length
    check (char_length(title) between 1 and 100),
  add constraint schedule_items_place_name_length
    check (place_name is null or char_length(place_name) <= 100),
  add constraint schedule_items_place_address_length
    check (place_address is null or char_length(place_address) <= 200),
  add constraint schedule_items_memo_length
    check (memo is null or char_length(memo) <= 1000),
  add constraint schedule_items_url_length
    check (url is null or char_length(url) <= 2048),
  add constraint schedule_items_place_external_id_length
    check (place_external_id is null or char_length(place_external_id) <= 200),
  add constraint schedule_items_lat_range
    check (place_lat is null or (place_lat between -90 and 90)),
  add constraint schedule_items_lng_range
    check (place_lng is null or (place_lng between -180 and 180)),
  add constraint schedule_items_place_provider_check
    check (place_provider is null or place_provider in ('naver','google')),
  add constraint schedule_items_place_atomic check (
    (place_name is null and place_address is null
      and place_lat is null and place_lng is null
      and place_provider is null and place_external_id is null)
    or
    (place_name is not null and place_lat is not null and place_lng is not null
      and place_provider is not null)
  );

-- ── 인덱스 (Patch I) ───────────────────────────────────────────────────
create index idx_schedule_items_day       on public.schedule_items(trip_day_id);
create index idx_schedule_items_day_order on public.schedule_items(trip_day_id, sort_order);

-- ── 트리거: updated_at (set_updated_at 은 0003_trips.sql 에서 정의됨) ──
create trigger schedule_items_set_updated_at
  before update on public.schedule_items
  for each row execute function public.set_updated_at();

-- ── RLS (Patch J — can_access_trip 재사용) ────────────────────────────
alter table public.schedule_items enable row level security;

create policy "schedule_items_select"
  on public.schedule_items for select to authenticated
  using (public.can_access_trip(
    (select trip_id from public.trip_days where id = trip_day_id)
  ));

create policy "schedule_items_insert"
  on public.schedule_items for insert to authenticated
  with check (public.can_access_trip(
    (select trip_id from public.trip_days where id = trip_day_id)
  ));

create policy "schedule_items_update"
  on public.schedule_items for update to authenticated
  using (public.can_access_trip(
    (select trip_id from public.trip_days where id = trip_day_id)
  ))
  with check (public.can_access_trip(
    (select trip_id from public.trip_days where id = trip_day_id)
  ));

create policy "schedule_items_delete"
  on public.schedule_items for delete to authenticated
  using (public.can_access_trip(
    (select trip_id from public.trip_days where id = trip_day_id)
  ));

-- ── Realtime publication 확장 ──────────────────────────────────────────
alter publication supabase_realtime add table public.schedule_items;

-- ── ROLLBACK ────────────────────────────────────────────────────────────
-- alter publication supabase_realtime drop table public.schedule_items;
-- drop table if exists public.schedule_items;
