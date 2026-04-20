-- 0007_replica_identity.sql
-- Phase 3: trips REPLICA IDENTITY FULL — partner 측 share-toggle OFF 자동 전환 지원
-- Spec §9 ADR 옵션 A. 이유: 기본 DEFAULT 는 payload.old 에 PK 만 포함하여
-- wasVisible && !isVisibleNow 판정 불가.

alter table public.trips replica identity full;

-- schedule_items: Phase 3 Task 19 에서 drag UPDATE 의 old.trip_day_id 접근 필요시 FULL 로 전환 재검토.
-- 현재는 DEFAULT 유지 — cross-day move 시 cross-day source day refetch 는
-- INSERT/DELETE 이벤트가 아닌 "id + new.trip_day_id" 조합으로 충분.

-- ROLLBACK
-- alter table public.trips replica identity default;
