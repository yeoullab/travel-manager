-- 0024_fix_bulk_delete_recompact.sql
-- 0023의 delete_schedule_items 버그 2건 수정:
--  (1) 재압축 실패: DELETE를 data-modifying CTE로 넣으면 같은 문장의 재압축 SELECT가
--      삭제 전 스냅샷을 보므로(Postgres 규칙) 삭제된 자리의 뒤 번호가 당겨지지 않았다.
--      → DELETE와 재압축을 별도 문장으로 분리하고, affected 파티션을 삭제 전에 캡처한다.
--  (2) 에러 우선순위: 접근 불가 아이템이 섞이면 mixed_trip_items 보다 forbidden 이 먼저
--      나야 한다(기존 계약). 관련된 모든 trip 접근성을 mixed 판정보다 먼저 확인한다.
-- 의존: 0023_candidate_items.sql

create or replace function public.delete_schedule_items(p_item_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_input_count int;
  v_expected_count int;
  v_matched_count int;
  v_trip_count int;
  v_trip_id uuid;
  v_locked_trip_id uuid;
  v_affected_days uuid[];
  v_pool_affected boolean;
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;

  v_input_count := coalesce(array_length(p_item_ids, 1), 0);
  if v_input_count = 0 then raise exception 'empty_item_ids'; end if;

  select count(*) into v_expected_count
    from (select distinct unnest(p_item_ids) as id) input_ids;
  if v_expected_count <> v_input_count then
    raise exception 'duplicate_item_ids';
  end if;

  -- trip_id 직접 집계 (풀 후보 포함)
  select count(*), count(distinct si.trip_id), (array_agg(distinct si.trip_id))[1]
    into v_matched_count, v_trip_count, v_trip_id
    from public.schedule_items si
    where si.id in (select distinct unnest(p_item_ids));

  if v_matched_count <> v_expected_count then
    raise exception 'missing_schedule_items';
  end if;

  -- 접근성 우선: 관련된 모든 trip 중 하나라도 접근 불가면 forbidden (mixed 보다 먼저).
  if exists (
    select 1 from (
      select distinct si.trip_id
      from public.schedule_items si
      where si.id in (select distinct unnest(p_item_ids))
    ) t
    where not public.can_access_trip(t.trip_id)
  ) then
    raise exception 'forbidden';
  end if;

  if v_trip_count <> 1 or v_trip_id is null then
    raise exception 'mixed_trip_items';
  end if;

  -- 여행 단위 직렬화 (파티션 재번호 경합 방지)
  v_locked_trip_id := v_trip_id;
  perform 1 from public.trips where id = v_locked_trip_id for update;

  -- 잠금 대기 중 대상이 이동/삭제됐을 수 있으므로 mutation 직전에 다시 검증한다.
  select count(*), count(distinct si.trip_id), (array_agg(distinct si.trip_id))[1]
    into v_matched_count, v_trip_count, v_trip_id
    from public.schedule_items si
    where si.id in (select distinct unnest(p_item_ids));
  if v_matched_count <> v_expected_count then
    raise exception 'missing_schedule_items';
  end if;
  if v_trip_count <> 1 or v_trip_id is null then
    raise exception 'mixed_trip_items';
  end if;
  if v_trip_id != v_locked_trip_id then
    raise exception 'schedule_items_changed';
  end if;

  -- 삭제 전 affected 파티션 캡처 (day 목록 + 풀 여부)
  select array_agg(distinct trip_day_id) filter (where trip_day_id is not null),
         bool_or(trip_day_id is null)
    into v_affected_days, v_pool_affected
    from public.schedule_items
    where id in (select distinct unnest(p_item_ids));

  -- 별도 문장으로 삭제 (CTE 스냅샷 문제 회피)
  delete from public.schedule_items
    where id in (select distinct unnest(p_item_ids));

  -- day 파티션 재압축: affected day 의 본·후보 파티션 각각 1..N 로 압축.
  -- 삭제가 없었던 파티션은 이미 1..N 이므로 no-op (무해).
  if v_affected_days is not null then
    update public.schedule_items si
       set sort_order = ranked.rn, updated_at = now()
    from (
      select s.id,
             row_number() over (
               partition by s.trip_day_id, s.is_candidate
               order by s.sort_order, s.created_at, s.id
             )::int as rn
      from public.schedule_items s
      where s.trip_day_id = any(v_affected_days)
    ) ranked
    where si.id = ranked.id;
  end if;

  -- 풀 파티션 재압축
  if v_pool_affected then
    update public.schedule_items si
       set sort_order = ranked.rn, updated_at = now()
    from (
      select s.id,
             row_number() over (
               order by s.sort_order, s.created_at, s.id
             )::int as rn
      from public.schedule_items s
      where s.trip_id = v_trip_id and s.trip_day_id is null
    ) ranked
    where si.id = ranked.id;
  end if;
end $$;

-- ── ROLLBACK ───────────────────────────────────────────────────────────
-- 0023 의 delete_schedule_items 정의로 복원 필요 (재압축 CTE 버전).
