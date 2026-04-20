-- supabase/seed/test.sql
-- 테스트 전용 RPC — service_role 만 실행 가능. production migration 에 포함하지 않음.
-- 로컬/CI 에서 `pnpm db:seed:test` (= psql ... -f supabase/seed/test.sql) 로 적용.

create or replace function public.test_truncate_cascade()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.users 는 보존 (ensureTestUser 가 관리)
  -- schedule_items / trip_days / trips 는 UUID PK (sequence 없음) → restart identity 불필요
  -- group_members / groups 도 UUID PK. cascade 만 필요.
  truncate table
    public.schedule_items,
    public.trip_days,
    public.trips,
    public.group_members,
    public.groups
  cascade;

  -- profiles 는 auth.users 와 FK — truncate 안 함 (auth trigger 로 관리)
end $$;

revoke all on function public.test_truncate_cascade() from public;
revoke all on function public.test_truncate_cascade() from authenticated;
grant execute on function public.test_truncate_cascade() to service_role;
