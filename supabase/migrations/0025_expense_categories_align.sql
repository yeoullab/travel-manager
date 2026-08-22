-- 0025_expense_categories_align.sql
-- 경비 카테고리를 일정 카테고리(0008 seed + 0023 cafe = 7종)와 동일한 값으로 정렬.
-- 변경: 'activity' → 'sightseeing' 로 코드 통일, 'cafe' 추가.
-- 의존: 0010_expenses.sql (expenses 테이블, expenses_category_valid CHECK 제약)

-- ── 1. 기존 CHECK 제약 제거 (신규 값 이관·추가를 위해) ──────────────────
alter table public.expenses
  drop constraint expenses_category_valid;

-- ── 2. 기존 데이터 이관: activity(관광) → sightseeing(관광) ──────────────
update public.expenses
  set category_code = 'sightseeing'
  where category_code = 'activity';

-- ── 3. 일정과 동일한 7종으로 CHECK 제약 재생성 ─────────────────────────
alter table public.expenses
  add constraint expenses_category_valid check (
    category_code in ('transport','sightseeing','food','cafe','lodging','shopping','other')
  );

-- ── ROLLBACK ───────────────────────────────────────────────────────────
-- alter table public.expenses drop constraint expenses_category_valid;
-- update public.expenses set category_code = 'activity' where category_code = 'sightseeing';
-- update public.expenses set category_code = 'other'    where category_code = 'cafe';
-- alter table public.expenses
--   add constraint expenses_category_valid check (
--     category_code in ('food','transport','lodging','shopping','activity','other')
--   );
