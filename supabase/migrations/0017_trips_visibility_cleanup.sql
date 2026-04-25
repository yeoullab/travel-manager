-- 0017_trips_visibility_cleanup.sql
-- share-toggle Realtime broadcast/postgres_changes 시도가 모두 CHANNEL_ERROR 로 실패해
-- (이전 0017 broadcast / 0019 trip_visibility_events / 0020 reload — 모두 폐기)
-- client-side 5초 polling 으로 전환했다 (lib/trip/use-trip-detail.ts, use-trips-list.ts).
-- ADR-011 참조.
--
-- 이 마이그레이션은 이전 시도의 잔존 객체를 청소한다. 원격 DB 에 0017/0018/0019/0020 이
-- 이미 적용된 환경에서 실행돼야 한다 (history 는 0017_trips_visibility_broadcast 가
-- reverted 처리되거나 새로 0017 로 덮어씌워질 수 있으므로 idempotent 처리).

-- 이전 broadcast 시도: realtime.messages SELECT policy
drop policy if exists "trips_visibility_loss_select" on realtime.messages;

-- 이전 broadcast 트리거 + 함수 (notify_trip_visibility_loss)
drop trigger if exists trg_trips_visibility_loss on public.trips;
drop function if exists public.notify_trip_visibility_loss();

-- 이전 INSERT 패턴: trip_visibility_events 테이블 + 정책
do $$
begin
  if exists (select 1 from pg_publication_tables
             where pubname = 'supabase_realtime' and tablename = 'trip_visibility_events') then
    alter publication supabase_realtime drop table public.trip_visibility_events;
  end if;
end $$;
drop policy if exists "trip_visibility_events_select_group_member" on public.trip_visibility_events;
drop table if exists public.trip_visibility_events;
