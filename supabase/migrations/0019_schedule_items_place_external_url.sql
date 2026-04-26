-- 0019_schedule_items_place_external_url.sql
-- §6.13 V1: 검색 결과 선택 시 Naver Place / Google Maps Place URL 을 저장.
-- 사용자 입력 url (블로그 등) 컬럼과 분리 — place_external_url 은 검색 결과 출처 URL.
-- 의존: 0005_schedule_items.sql

alter table public.schedule_items
  add column place_external_url text;

-- 스킴 검증: https?:// 로 시작하는 URL 만 허용. nmap:// 등 deeplink 차단.
alter table public.schedule_items
  add constraint schedule_items_place_external_url_scheme
  check (place_external_url is null or place_external_url ~ '^https?://');

-- ROLLBACK
-- alter table public.schedule_items drop constraint schedule_items_place_external_url_scheme;
-- alter table public.schedule_items drop column place_external_url;
