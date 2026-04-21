-- Phase 3 Exit Gate — Verification SQL (Spec §10.3)
-- 실행: supabase db execute --file scripts/phase3-verify.sql
--      또는 Supabase Dashboard > SQL Editor 에 붙여넣기

-- (1) schedule_items RLS 정책 목록
-- Expected: schedule_items_delete, schedule_items_insert, schedule_items_select, schedule_items_update
SELECT policyname
FROM pg_policies
WHERE tablename = 'schedule_items'
ORDER BY policyname;

-- (2) schedule_items CHECK 제약
-- Expected: lat_range, lng_range, memo_len, place_address_len, place_atomic,
--           place_external_id_len, place_name_len, place_provider, title_len, url_len
SELECT conname
FROM pg_constraint
WHERE conrelid = 'public.schedule_items'::regclass
  AND contype = 'c'
ORDER BY conname;

-- (3) Realtime publication 테이블 목록
-- Expected: group_members, groups, schedule_items, trips  (profiles 없음)
SELECT * FROM public.query_publication_tables() ORDER BY tablename;

-- (4) trips REPLICA IDENTITY FULL 여부
-- Expected: 'f'  (f = FULL)
SELECT relreplident
FROM pg_class
WHERE oid = 'public.trips'::regclass;

-- (5) RPC privilege — authenticated / service_role 분리
-- Expected:
--   create_schedule_item, update_schedule_item, delete_schedule_item,
--   reorder_schedule_items_in_day, move_schedule_item_across_days → {authenticated}
--   test_truncate_cascade, replica_identity_of → {service_role}
SELECT
  p.proname,
  array_agg(DISTINCT r.grantee ORDER BY r.grantee) AS grantees
FROM information_schema.routine_privileges r
JOIN pg_proc p ON p.proname = r.routine_name
WHERE r.routine_schema = 'public'
  AND p.proname IN (
    'create_schedule_item',
    'update_schedule_item',
    'delete_schedule_item',
    'reorder_schedule_items_in_day',
    'move_schedule_item_across_days',
    'test_truncate_cascade',
    'replica_identity_of'
  )
GROUP BY p.proname
ORDER BY p.proname;
