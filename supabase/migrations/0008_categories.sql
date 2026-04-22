-- 0008_categories.sql
-- Phase 3 갭 복구: categories 시스템 테이블 + schedule_items.category_code FK
-- 의존: 0005_schedule_items.sql

-- ── categories 테이블 ──────────────────────────────────────────────
create table public.categories (
  code        text        primary key,
  name        text        not null,
  color_token text        not null,  -- Tailwind class (참고용; UI 최종은 schedule-item.tsx categoryColor)
  sort_order  int         not null,
  created_at  timestamptz not null default now()
);

alter table public.categories
  add constraint categories_code_length check (char_length(code) between 1 and 32),
  add constraint categories_name_length check (char_length(name) between 1 and 32),
  add constraint categories_code_chars  check (code ~ '^[a-z_]+$');

-- ── seed: 6종 (components/ui/schedule-item.tsx ScheduleCategory 1:1 매핑) ──
insert into public.categories (code, name, color_token, sort_order) values
  ('transport',   '교통', 'bg-ti-read',      1),
  ('sightseeing', '관광', 'bg-ti-grep',      2),
  ('food',        '식당', 'bg-ti-thinking',  3),
  ('lodging',     '숙소', 'bg-ti-edit',      4),
  ('shopping',    '쇼핑', 'bg-accent-gold',  5),
  ('other',       '기타', 'bg-ink-400',      6);

-- ── RLS: 읽기 전용 시스템 테이블 ──
alter table public.categories enable row level security;
create policy "categories_select_all"
  on public.categories for select to authenticated
  using (true);
-- INSERT/UPDATE/DELETE 정책 없음 → RLS 로 자동 차단

-- ── schedule_items.category_code 컬럼 추가 ──
alter table public.schedule_items
  add column category_code text not null default 'other'
    references public.categories(code) on update cascade on delete restrict;

-- 기존 row 는 default 'other' 로 자동 채워짐

create index idx_schedule_items_category on public.schedule_items(category_code);

-- ── ROLLBACK ─────────────────────────────────────────────────────────
-- drop index if exists idx_schedule_items_category;
-- alter table public.schedule_items drop column category_code;
-- drop policy if exists "categories_select_all" on public.categories;
-- drop table if exists public.categories;
