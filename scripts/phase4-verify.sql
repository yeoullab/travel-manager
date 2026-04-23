-- Phase 4 Exit Gate — Verification SQL
-- 실행: supabase db execute --file scripts/phase4-verify.sql
--      또는 Supabase Dashboard > SQL Editor 에 붙여넣기

-- (1) expenses / todos / records / guest_shares RLS 활성 여부
-- Expected: 4 rows, relrowsecurity = t 전부
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('expenses','todos','records','guest_shares')
ORDER BY relname;

-- (2) 테이블별 CHECK 제약 수
-- Expected: expenses ≥ 6, todos ≥ 2, records ≥ 2, guest_shares ≥ 0
SELECT cl.relname, COUNT(*) AS check_count
FROM pg_constraint c
JOIN pg_class cl ON cl.oid = c.conrelid
WHERE cl.relname IN ('expenses','todos','records','guest_shares')
  AND c.contype = 'c'
GROUP BY cl.relname
ORDER BY cl.relname;

-- (3) Realtime publication 에 신규 3 테이블 포함 여부
-- Expected: 3 rows (expenses, todos, records)
SELECT tablename
FROM public.query_publication_tables()
WHERE tablename IN ('expenses','todos','records')
ORDER BY tablename;

-- (4) get_guest_trip_data(uuid) 에 anon EXECUTE grant 부여 확인
-- Expected: 1 row (proname=get_guest_trip_data, rolname=anon)
SELECT p.proname, r.rolname
FROM pg_proc p
JOIN pg_roles r ON has_function_privilege(r.oid, p.oid, 'execute')
WHERE p.proname = 'get_guest_trip_data'
  AND r.rolname = 'anon';

-- (5) expenses.schedule_item_id FK 가 ON DELETE SET NULL 인지 확인
-- Expected: confdeltype = 'n'  (n = SET NULL)
SELECT conname, confdeltype
FROM pg_constraint
WHERE conname = 'expenses_schedule_item_id_fkey';

-- (6) guest_shares 의 1 trip = 1 active partial unique index 존재 확인
-- Expected: 1 row (indrelid = guest_shares, is_partial = true, predicate contains 'is_active')
SELECT i.relname                     AS index_name,
       pg_get_indexdef(ix.indexrelid) AS definition
FROM pg_index ix
JOIN pg_class i  ON i.oid  = ix.indexrelid
JOIN pg_class t  ON t.oid  = ix.indrelid
WHERE t.relname = 'guest_shares'
  AND ix.indisunique
  AND ix.indpred IS NOT NULL
ORDER BY i.relname;
