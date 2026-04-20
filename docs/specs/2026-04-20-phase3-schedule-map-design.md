---
type: design-spec
phase: 3
project: travel-manager
date: 2026-04-20
status: draft → complete (sections 1~10 of 10)
author: AI + human collaborative design
supersedes: ""
---

# Phase 3 — Schedule & Map Design Spec

> **Phase 3 Goal:** Phase 2(trips + groups + Realtime) 위에 **schedule_items + trip_days 활용 일정 탭 + 지도(Naver/Google 이중 provider) + 드래그앤드롭 + E2E 자동화 복귀** 를 얹어, "일정을 계획·편집하며 파트너와 실시간 공유하는" 핵심 UX 를 완성한다.
>
> **Design scope:** 이 문서는 Phase 3 설계 스펙(데이터 모델·RPC·드래그 모델·지도 인터페이스·테스트)이다. Task-by-Task 구현 계획은 별도 문서 `docs/plans/2026-04-20-phase3-schedule-map.md` 에서 `writing-plans` 스킬로 생성된다.
>
> **전제:** `docs/specs/2026-04-20-travel-manager-design-updated.md` (현행화 전체 스펙) + `docs/specs/2026-04-19-phase2-trip-core-design.md` (Phase 2 결정) + Phase 2 완료 상태 (tag `phase-2-trip-core`, main HEAD `0c710a2`). ADR-009(Dual Provider) 수락됨.
>
> **진행 상태:** 이 파일은 **§1~§10 작성 완료**. 목차:
> - §1 Overview & Scope
> - §2 Data Model — `schedule_items` 스키마/RLS/인덱스
> - §3 Drag & Drop Model + RPC
> - §4 `resize_trip_days` 확장
> - §5 Maps Provider Interface + 환경/CSP
> - §6 Place Search Flow
> - §7 일정 ↔ 경비 연동 준비 훅
> - §8 E2E Automation Return Infrastructure
> - §9 Partner Share-Toggle OFF Realtime ADR
> - §10 Tests · Risks · Exit Criteria

---

## 1. Overview & Scope

### 1.1 Goal

Phase 2 의 trips·Realtime 기반 위에:

1. `schedule_items` 테이블 + 일정 CRUD
2. 일정 탭 UI — Day Tab (수평 스크롤) + 지도(접기/펼치기) + 일정 리스트
3. Naver/Google **dual-provider** 지도 통합 (ADR-009) — `trip.is_domestic` 기반 자동 분기 + lazy load
4. 장소 검색 (Naver Search Local / Google Places) → 좌표 저장 → 번호 마커
5. 드래그앤드롭 — 같은 날 순서 변경 + 다른 날로 이동, optimistic + last-write-wins
6. `resize_trip_days` RPC 확장 — 축소 시 삭제 대상 day 의 items 를 last-kept day 로 재배치
7. Playwright E2E 자동화 복귀 — `auth.admin.createUser` + `signInWithPassword` helper + storageState 프로그램적 생성으로 Google OAuth 우회
8. Partner 측 share-toggle OFF 자동 Realtime 전환 (trips UPDATE `group_id: X→null` 을 RLS 상 DELETE 로 취급)

### 1.2 In Scope

| 카테고리 | 항목 |
|---|---|
| DB 마이그레이션 | `0005_schedule_items.sql` (테이블 + RLS + 인덱스 + CHECK + 트리거 + place integrity) · `0006_schedule_rpc.sql` (reorder/move RPC + resize_trip_days 재정의) |
| 환경변수 | `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID`, `NAVER_MAP_CLIENT_SECRET`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_SERVER_KEY`. `lib/env.ts` 확장, `.env.example` 갱신 |
| CSP | `next.config.ts` — `script-src`/`connect-src`/`img-src` 에 Naver/Google 도메인 허용 |
| Maps 인터페이스 | `lib/maps/provider.ts` 공통 인터페이스 + `naver-provider.ts` + `google-provider.ts` + lazy loader |
| 라우트 실연결 | `/trips/[id]` 일정 탭 전면 실 DB (mock 탭 banner 제거) |
| UI 신규 | `schedule-tab`(실), `day-tab-bar`, `map-panel`, `schedule-list`, `schedule-item-card`, `schedule-item-modal`, `place-search-sheet`, `day-move-sheet`, `schedule-unlink-confirm` |
| RPC | `create_schedule_item`, `update_schedule_item`, `reorder_schedule_items_in_day`, `move_schedule_item_across_days`, `delete_schedule_item`, `resize_trip_days` (재정의) |
| Realtime | publication 에 `schedule_items` 추가. `<RealtimeGateway />` 채널 확장. 파트너 측 공유 중단 시 UPDATE→DELETE 해석 (§9) |
| 테스트 | Unit 5종 (sort_order 계산, 좌표 범위, url 스킴, place provider 매칭, drag 결과 합성), Integration 8종 (RLS, reorder, move, resize 8 케이스, realtime publication audit, place provider CHECK, url 검증, share-toggle realtime), E2E 4종 (schedule CRUD, drag same-day, drag cross-day, share-toggle partner view) |

### 1.3 Out of Scope (Phase 4+)

| 항목 | 이후 Phase |
|---|---|
| `expenses` 테이블 + 일정↔경비 연동 실 배선 | Phase 4 (단, `schedule_item_id` FK 용 placeholder 는 Phase 4 마이그레이션에서 처리, 이번엔 스키마 변경 없음) |
| `categories` 테이블 + `schedule_items.category_id` FK | Phase 4 |
| `todos`, `records` 실 배선 | Phase 5 |
| `guest_shares` | Phase 6 |
| PWA Workbox 쉘 프리캐시 | Phase 8 |
| 환율 변환 | V2+ |
| 미디어 첨부 (사진) | V2+ |

**Phase 4 와의 경계:** 이 spec §7 은 일정↔경비 연동을 위한 **UI 자리·데이터 계약** 만 준비. 실 expenses 테이블·훅 배선은 Phase 4.

### 1.4 Phase 3 Exit Criteria (요약)

**자동 검증(CI):** tsc 0 / lint 0 / unit · integration · E2E 전수 통과 / build ✓ / audit clean / Verification SQL 통과.
**수동 검증(실 Google 계정 2개):** schedule CRUD + drag + map marker + partner realtime 5 시나리오.
**산출물:** 이 spec + Implementation Plan + retrospective + tag `phase-3-schedule-map`.

상세는 §10.

---

## 2. Data Model — `schedule_items`

### 2.1 테이블 정의

```sql
create table public.schedule_items (
  id uuid primary key default gen_random_uuid(),
  trip_day_id uuid not null references public.trip_days(id) on delete cascade,
  title text not null,
  sort_order int not null,
  time_of_day time without time zone,
  place_name text,
  place_address text,
  place_lat double precision,
  place_lng double precision,
  place_provider text,
  place_external_id text,
  memo text,
  url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

**Patch A — 컬럼 명명 / 예약어 회피:**
- 최초 스펙의 `order int NOT NULL` 은 SQL 예약어 — 쿼리마다 `"order"` quote 필요 → **`sort_order`** 로 변경. RPC·쿼리·타입 전반에서 일관.
- 최초 스펙의 `time time nullable` 은 `time` 예약어. **`time_of_day`** 로 변경. `time without time zone` 으로 명시 (TZ 없는 시각 전용).

**Patch B — category_id 생략 (Phase 4 합류):**
- 최초 스펙은 `category_id uuid FK categories nullable`. Phase 3 엔 `categories` 테이블 자체가 없으므로 **이번 마이그레이션에선 컬럼 생략**. Phase 4 에서 categories 테이블 + schedule_items ADD COLUMN + FK 를 한 마이그레이션에서 처리.
- 이유: dead column 금지 (CLAUDE.md coding-style). 설계 문서엔 "Phase 4 에서 추가될 컬럼" 주석으로 명시.

**Patch C — place_provider 는 앱 계약값, CHECK 로 고정:**
```sql
alter table public.schedule_items
  add constraint schedule_items_place_provider_check
    check (place_provider is null or place_provider in ('naver', 'google'));
```
- ADR-009 반영. Phase 3 에선 2 값만 허용. Mapbox 등 추가 시 이 CHECK 만 재정의.

### 2.2 CHECK 제약 (입력 크기 · 좌표 범위 · 장소 무결성)

**Patch D — 입력 크기 캡 (DoS 방어):**
```sql
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
    check (place_external_id is null or char_length(place_external_id) <= 200);
```

**Patch E — 좌표 범위:**
```sql
alter table public.schedule_items
  add constraint schedule_items_lat_range
    check (place_lat is null or (place_lat between -90 and 90)),
  add constraint schedule_items_lng_range
    check (place_lng is null or (place_lng between -180 and 180));
```

**Patch F — 장소 원자성 (all-or-nothing):**
```sql
alter table public.schedule_items
  add constraint schedule_items_place_atomic check (
    (place_name is null and place_address is null
     and place_lat is null and place_lng is null
     and place_provider is null and place_external_id is null)
    or
    (place_name is not null and place_lat is not null and place_lng is not null
     and place_provider is not null)
    -- address 와 external_id 는 optional (API 응답에 따라 누락 가능)
  );
```
- 이유: "장소가 있음" 상태는 지도 핀을 찍을 수 있다는 의미. lat/lng/provider 없이 place_name 만 있는 반쪽 상태는 UI 오작동 유발.
- 반쪽 허용 시나리오(예: "이름만 기록, 나중에 좌표 연결")는 메모 필드에 적으라는 UX 정책.

**Patch G — URL 스킴 검증은 앱 레이어:**
- 최초 스펙 `url CHECK (https?://)` 제약은 PostgreSQL regex 로 가능하지만 **앱에서 zod 스키마로 처리**. 이유: 에러 메시지 제어 + Phase 4 에서 internal link 등 scheme 확장 유연성. DB CHECK 는 길이만.

**Patch H — place_provider ↔ trip.is_domestic 정합성은 앱 레이어:**
- "국내 여행에 Google 마커 저장" 같은 mismatch 는 CHECK 로 막을 수 있지만 schedule_items 에선 `trip.is_domestic` 에 직접 접근 불가(테이블 간 CHECK 불가). **RPC `create_schedule_item` / `update_schedule_item` 에서 가드**.
- RPC 에서 `trip.is_domestic` 조회 후 `place_provider` 와 일치하는지 검사 → 불일치 시 `place_provider_mismatch` 예외.

### 2.3 인덱스

```sql
create index idx_schedule_items_day on public.schedule_items(trip_day_id);
create index idx_schedule_items_day_order on public.schedule_items(trip_day_id, sort_order);
create index idx_schedule_items_trip on public.schedule_items(
  (select trip_id from public.trip_days td where td.id = trip_day_id)
); -- ❌ 표현식 인덱스로는 불가. 대체:
```

**Patch I — trip 레벨 조회 최적화는 조인 (표현식 인덱스 회피):**
`idx_schedule_items_trip` 같은 서브쿼리 인덱스는 불가능. 대체 전략:
- 앱 쿼리는 `schedule_items sj join trip_days td on td.id = sj.trip_day_id where td.trip_id = ?` 로. `trip_days(trip_id)` 인덱스(Phase 2) 이용.
- 일정 탭 1회 fetch 는 trip_day_id IN (day_list) 로 배치 조회 — `idx_schedule_items_day` 로 충분.

**최종 인덱스:**
```sql
create index idx_schedule_items_day on public.schedule_items(trip_day_id);
create index idx_schedule_items_day_order on public.schedule_items(trip_day_id, sort_order);
```

### 2.4 트리거 — updated_at

```sql
create trigger schedule_items_set_updated_at
  before update on public.schedule_items
  for each row execute function public.set_updated_at();
-- set_updated_at() 은 Phase 2 (0003_trips.sql) 에 이미 정의됨 — 재사용
```

### 2.5 RLS

**Patch J — Phase 2 `can_access_trip` 재사용 (설계 의도 실현):**
```sql
alter table public.schedule_items enable row level security;

create policy "schedule_items_select"
  on public.schedule_items for select to authenticated
  using (
    public.can_access_trip((select trip_id from public.trip_days where id = trip_day_id))
  );

create policy "schedule_items_insert"
  on public.schedule_items for insert to authenticated
  with check (
    public.can_access_trip((select trip_id from public.trip_days where id = trip_day_id))
  );

create policy "schedule_items_update"
  on public.schedule_items for update to authenticated
  using (
    public.can_access_trip((select trip_id from public.trip_days where id = trip_day_id))
  )
  with check (
    public.can_access_trip((select trip_id from public.trip_days where id = trip_day_id))
  );

create policy "schedule_items_delete"
  on public.schedule_items for delete to authenticated
  using (
    public.can_access_trip((select trip_id from public.trip_days where id = trip_day_id))
  );
```

**Patch K — INSERT/UPDATE 시 trip_day_id 변조 차단:**
- `schedule_items_update` 의 `with check` 는 새 trip_day_id 에 대한 access 도 검증 → 다른 trip 으로 옮기기 시도 자동 차단.
- 앱 레벨 `move_schedule_item_across_days` RPC 는 같은 trip 내 다른 day 로만 이동하도록 RPC 내부에서 검증 (§3.3).

**Patch L — place_provider 와 trip.is_domestic 의 RLS 검증 부재:**
- `place_provider='naver' AND trip.is_domestic=false` 같은 논리적 mismatch 는 RLS 레벨에서 막지 않음. RPC 경로에서만 검증. 이유: direct UPDATE path 는 UI 에서 열지 않으므로(모든 CRUD 가 RPC 경유) 실질 누수 없음. direct path 가 필요해지면 Patch H 확장으로 이전.

### 2.6 Realtime Publication 확장

`0005_schedule_items.sql` 끝에:
```sql
alter publication supabase_realtime add table public.schedule_items;
```

**구독 키:**
- `schedule_items` INSERT/UPDATE/DELETE — `trip_day_id` 가 내 접근 가능 day 인 경우만 (RLS 필터). 앱에서 `['schedule', trip_id]` 쿼리 invalidate.

**UPDATE 이벤트 필터링은 클라이언트에서:** trip_day_id 변경(cross-day move) 은 source/target day 모두 invalidate 필요. realtime payload 에 `old` + `new` 포함되므로 (REPLICA IDENTITY FULL 불필요, 기본 REPLICA IDENTITY DEFAULT 로도 PK 기반 cross-day 추적 가능).

---

## 3. Drag & Drop Model + RPC

### 3.1 UI 레벨 드래그 규칙

Phase 0 mockup 및 원 스펙 §6.4 계승:
- **long press (400ms) → 드래그 시작** — 짧은 tap 은 상세 편집 모달 진입
- **drag 없이 long press 유지만 → 시각 피드백(lift shadow) 후 해제 시 무동작**
- **⋮ 메뉴** 는 별도 트리거 (우측 아이콘) — 드래그와 분리
- 드래그 라이브러리: `@dnd-kit/core` + `@dnd-kit/sortable` (React 19 / Next.js 16 호환 확인 필요 — Phase 3 Task 0 pre-flight)

**시각 피드백:**
- 드래그 중: `transform: rotate(-1deg)` + `box-shadow: lift`
- drop target hover: 접힌 영역 강조
- cross-day 드래그: Day Tab 위에 드롭 시 해당 day 로 자동 전환

### 3.2 클라이언트 ↔ 서버 계약

**설계 원칙:** 드래그 종료 시 **최종 상태 전체** 를 서버에 전송. 중간 단계 전송 불필요. Optimistic update 는 TanStack Query cache 에서 즉시 반영.

**2 RPC 분리:**
1. `reorder_schedule_items_in_day(p_trip_day_id uuid, p_item_ids uuid[])` — 같은 날 내 재배치
2. `move_schedule_item_across_days(p_item_id uuid, p_target_day_id uuid, p_target_position int)` — 다른 날로 이동

**분리 이유:**
- same-day 는 payload 가 작음 (item_ids 배열만) + 자주 발생
- cross-day 는 source/target 모두 재번호 필요 → 서버가 source day 를 자동 계산하는 게 단순
- 통합 RPC 는 payload 복잡도 증가 + dispatch 로직 서버에 이중화

### 3.3 RPC — `reorder_schedule_items_in_day`

```sql
create or replace function public.reorder_schedule_items_in_day(
  p_trip_day_id uuid,
  p_item_ids uuid[]
) returns void
language plpgsql
security definer  -- can_access_trip 은 definer 보장 (Phase 2 Patch fix)
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_trip_id uuid;
  v_expected_count int;
  v_provided_count int;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;

  -- 1) day 존재 + trip 접근 가능 검증
  select trip_id into v_trip_id from trip_days where id = p_trip_day_id;
  if v_trip_id is null then raise exception 'trip_day_not_found'; end if;
  if not public.can_access_trip(v_trip_id) then
    raise exception 'forbidden';
  end if;

  -- 2) p_item_ids 가 해당 day 의 모든 item 과 정확히 일치하는지 검증
  select count(*) into v_expected_count from schedule_items where trip_day_id = p_trip_day_id;
  v_provided_count := coalesce(array_length(p_item_ids, 1), 0);
  if v_expected_count != v_provided_count then
    raise exception 'item_set_mismatch';
  end if;

  -- 3) 제공된 item 들이 모두 해당 day 에 속하는지 + 중복 없는지
  if exists (
    select 1 from unnest(p_item_ids) as arr(id)
    where not exists (
      select 1 from schedule_items si
      where si.id = arr.id and si.trip_day_id = p_trip_day_id
    )
  ) then raise exception 'item_not_in_day'; end if;
  if (select count(distinct x) from unnest(p_item_ids) x) != v_provided_count then
    raise exception 'duplicate_item_ids';
  end if;

  -- 4) sort_order 재할당 (1-based, 배열 인덱스 순서대로)
  update schedule_items si
    set sort_order = arr.ord,
        updated_at = now()
  from (
    select unnest(p_item_ids) as id,
           generate_series(1, v_provided_count) as ord
  ) arr
  where si.id = arr.id;
end $$;

revoke all on function public.reorder_schedule_items_in_day(uuid, uuid[]) from public;
grant execute on function public.reorder_schedule_items_in_day(uuid, uuid[]) to authenticated;
```

**Patch M — 집합 일치 검증 (set mismatch 방어):**
- 클라이언트가 서버 최신 상태와 stale 상태의 불일치로 일부 item 을 누락한 채 재배치 요청 → 서버가 `item_set_mismatch` 로 거절. 클라이언트는 refetch + 재시도.
- race 사례: A가 item 삭제 직후 B가 drag 종료. B의 payload 는 삭제된 item 포함 → 거절 → B refetch.

### 3.4 RPC — `move_schedule_item_across_days`

```sql
create or replace function public.move_schedule_item_across_days(
  p_item_id uuid,
  p_target_day_id uuid,
  p_target_position int   -- 1-based, 1..(target_day_count+1)
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_source_day_id uuid;
  v_source_trip_id uuid;
  v_target_trip_id uuid;
  v_target_count int;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;

  -- 1) item 소속 파악
  select trip_day_id into v_source_day_id from schedule_items where id = p_item_id;
  if v_source_day_id is null then raise exception 'schedule_item_not_found'; end if;

  -- 2) source/target 이 같은 trip 인지 + 접근 가능한지
  select trip_id into v_source_trip_id from trip_days where id = v_source_day_id;
  select trip_id into v_target_trip_id from trip_days where id = p_target_day_id;
  if v_target_trip_id is null then raise exception 'target_day_not_found'; end if;
  if v_source_trip_id != v_target_trip_id then
    raise exception 'cannot_move_across_trips';
  end if;
  if not public.can_access_trip(v_source_trip_id) then
    raise exception 'forbidden';
  end if;

  -- 3) target position 범위 검증
  select count(*) into v_target_count from schedule_items where trip_day_id = p_target_day_id;
  if p_target_position < 1 or p_target_position > v_target_count + 1 then
    raise exception 'invalid_target_position';
  end if;

  -- 4) same-day 호출 방어 (use reorder_schedule_items_in_day instead)
  if v_source_day_id = p_target_day_id then
    raise exception 'use_reorder_for_same_day';
  end if;

  -- 5) item 의 trip_day_id 변경 + target 에서 임시 sort_order = 0 (나중에 재번호)
  update schedule_items
    set trip_day_id = p_target_day_id,
        sort_order = 0,
        updated_at = now()
    where id = p_item_id;

  -- 6) source day 재번호 (gap 제거)
  update schedule_items si
    set sort_order = rn.ord,
        updated_at = now()
  from (
    select id, row_number() over (order by sort_order) as ord
    from schedule_items
    where trip_day_id = v_source_day_id
  ) rn
  where si.id = rn.id;

  -- 7) target day 재번호 (삽입 위치 반영)
  --    기존 items: (sort_order < p_target_position → ord = rank_before)
  --                (sort_order >= p_target_position → ord = rank_before + 1)
  --    신규 item: ord = p_target_position
  update schedule_items si
    set sort_order = case
        when si.id = p_item_id then p_target_position
        when rn.ord < p_target_position then rn.ord
        else rn.ord + 1
      end,
      updated_at = now()
  from (
    select id,
           row_number() over (order by case when id = p_item_id then 999999 else sort_order end) as ord
    from schedule_items
    where trip_day_id = p_target_day_id
  ) rn
  where si.id = rn.id;
end $$;

revoke all on function public.move_schedule_item_across_days(uuid, uuid, int) from public;
grant execute on function public.move_schedule_item_across_days(uuid, uuid, int) to authenticated;
```

**Patch N — cross-trip 이동 금지:**
- 스펙상 일정 이동은 **같은 여행 내** 에서만 가능. 다른 여행으로 이동은 UI 에 없으며 악의 호출도 RPC 에서 `cannot_move_across_trips` 로 차단.
- 앞으로 "여행 복제" 기능 등이 추가되면 별도 RPC 로.

**Patch O — 같은 날 호출은 reorder 로 강제:**
- `source_day_id == target_day_id` 면 `use_reorder_for_same_day` 예외. 이유: 재번호 로직이 단순해지고 클라이언트가 용도별 RPC 를 명확히 선택하게 강제.

**Patch P — Realtime 이벤트 순서:**
- step 5 (item UPDATE) → step 6 (source renumber, multi UPDATE) → step 7 (target renumber, multi UPDATE) 이 단일 트랜잭션.
- Supabase Realtime 은 트랜잭션 커밋 시점에 이벤트 fanout → 파트너 UI 는 일관된 스냅샷 수신.
- 단일 이벤트 순서가 보장되지 않으므로 클라이언트는 "trip_day_id 변경된 UPDATE 수신 시 source + target day 모두 refetch" 정책.

### 3.5 클라이언트 optimistic 전략

**Same-day reorder:**
```typescript
// TanStack Query mutation onMutate
onMutate: async ({ dayId, orderedIds }) => {
  await queryClient.cancelQueries({ queryKey: ['schedule', tripId] });
  const previous = queryClient.getQueryData(['schedule', tripId]);
  queryClient.setQueryData(['schedule', tripId], (old) =>
    applyLocalReorder(old, dayId, orderedIds)
  );
  return { previous };
},
onError: (err, vars, ctx) => {
  queryClient.setQueryData(['schedule', tripId], ctx?.previous);
  showToast('순서 변경에 실패했어요', 'error');
},
onSettled: () => queryClient.invalidateQueries({ queryKey: ['schedule', tripId] }),
```

**Cross-day move:**
- 같은 패턴. `applyLocalMove(old, itemId, targetDayId, targetPos)` 로 source/target 동시 수정.
- Realtime 이벤트 수신 시 onSettled 의 invalidate 와 중복 refetch 가능 — TanStack Query 의 staleTime 으로 debounce.

**Patch Q — 드래그 중 Realtime 입력 격리:**
- 드래그 진행 중(`isDragging` 상태)에는 수신된 realtime 이벤트의 invalidate 를 **유예**. 드래그 종료 후 큐를 flush.
- 이유: 드래그 중 list 가 재정렬되면 사용자 시각 피드백 혼란. 짧은 순간이므로 stale 위험 미미.
- 구현: `useUiStore` 에 `isDraggingSchedule` 플래그. `RealtimeGateway` 의 schedule 채널 핸들러가 플래그 true 면 invalidate 건너뛰고 `pendingInvalidate.current = true` 세팅. 드래그 종료 시 flush.

### 3.6 접근성 (keyboard drag)

- `@dnd-kit` 의 `KeyboardSensor` 사용 → 스페이스로 grab, 방향키로 이동, Enter 로 drop
- 스크린리더 안내: drag 시작 시 `aria-describedby` 로 "Day 2, 3번째 항목을 선택했습니다" 같은 공지
- Phase 3 에선 기본 구현만, 폴리시는 Phase 8 접근성 패스에서

---

## 4. `resize_trip_days` 확장

### 4.1 Phase 2 동작 복기

0003_trips.sql 정의 (0004 에서 SECURITY DEFINER 로 변경):
- trip 날짜 범위 업데이트
- `trip_days` 전체 DELETE + 새 범위로 bulk INSERT
- schedule_items 없으므로 안전

Phase 3 부터는 DELETE+INSERT 로는 items 소실 → **새 전략**.

### 4.2 전략 — day 유지하며 date 업데이트

**설계 원칙:** trip_days row 는 **day_number 기준으로 안정적으로 유지**. date 만 업데이트. 확장 시 day_number > old_end_number 만 신규 INSERT. 축소 시 삭제 대상 day 의 items 를 last-kept day 로 이동 후 day 삭제.

**좋은 이유:**
- schedule_items 의 FK 는 trip_day_id — day_number 가 같아도 id 가 다르면 재매핑 필요. **id 를 유지**하면 외래키 유효.
- Realtime 관점에서도 UPDATE 이벤트만 발생하여 파트너 UI 의 diff 가 작음.

### 4.3 RPC 본문

```sql
create or replace function public.resize_trip_days(
  p_trip_id   uuid,
  p_new_start date,
  p_new_end   date
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_new_day_count int;
  v_old_day_count int;
  v_last_kept_day_id uuid;
  v_max_sort int;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  if p_new_start > p_new_end then raise exception 'invalid_date_range'; end if;

  -- 1) 생성자 검증
  select created_by into v_owner from trips where id = p_trip_id;
  if v_owner is null or v_owner != v_uid then
    raise exception 'trip_not_found_or_forbidden';
  end if;

  -- 2) trip 날짜 업데이트 (updated_at 은 trigger 처리)
  update trips set start_date = p_new_start, end_date = p_new_end where id = p_trip_id;

  -- 3) 새/기존 day 수 계산
  v_new_day_count := (p_new_end - p_new_start) + 1;
  select count(*) into v_old_day_count from trip_days where trip_id = p_trip_id;

  -- 4) 기존 day 들의 date 업데이트 (day_number 순서대로 p_new_start+n-1)
  --    min(v_old_day_count, v_new_day_count) 만큼 유지됨
  update trip_days td
    set date = p_new_start + (day_number - 1)
  where td.trip_id = p_trip_id
    and day_number <= least(v_old_day_count, v_new_day_count);

  if v_new_day_count > v_old_day_count then
    -- 5a) 확장: 신규 day 추가 (day_number = old_count+1 ... new_count)
    insert into trip_days(trip_id, day_number, date)
    select p_trip_id,
           v_old_day_count + gs,
           p_new_start + (v_old_day_count + gs - 1)
    from generate_series(1, v_new_day_count - v_old_day_count) as gs;

  elsif v_new_day_count < v_old_day_count then
    -- 5b) 축소: 삭제 대상 day 의 items 를 last-kept day (day_number = v_new_day_count) 로 이동
    select id into v_last_kept_day_id
      from trip_days
      where trip_id = p_trip_id and day_number = v_new_day_count;

    select coalesce(max(sort_order), 0) into v_max_sort
      from schedule_items where trip_day_id = v_last_kept_day_id;

    -- items 이동: sort_order 는 (v_max_sort + 기존 sort_order + day_offset * 10000) 로
    --            day 순서 → sort_order 순서를 보존 (day 2 의 items 가 day 3 items 보다 앞)
    update schedule_items si
      set trip_day_id = v_last_kept_day_id,
          sort_order = v_max_sort
            + (td.day_number - v_new_day_count) * 10000
            + si.sort_order,
          updated_at = now()
      from trip_days td
      where td.id = si.trip_day_id
        and td.trip_id = p_trip_id
        and td.day_number > v_new_day_count;

    -- 재번호 (offset 방식의 gap 제거)
    update schedule_items si
      set sort_order = rn.ord,
          updated_at = now()
    from (
      select id, row_number() over (order by sort_order) as ord
      from schedule_items
      where trip_day_id = v_last_kept_day_id
    ) rn
    where si.id = rn.id;

    -- 초과 day 삭제 (CASCADE 로 남은 items 가 있으면 소실되므로 반드시 위 UPDATE 이후)
    delete from trip_days
      where trip_id = p_trip_id and day_number > v_new_day_count;
  end if;
end $$;

revoke all on function public.resize_trip_days(uuid, date, date) from public;
grant execute on function public.resize_trip_days(uuid, date, date) to authenticated;
```

**Patch R — day 보존으로 FK 안정성:**
- 이전(Phase 2) 의 DELETE+INSERT 는 schedule_items 가 생기는 Phase 3 에선 CASCADE 로 items 가 소실. 이번 재정의는 **id 보존** 으로 해결.

**Patch S — items sort_order 합병 안정성:**
- 축소 시 여러 day 의 items 가 last-kept day 로 합쳐짐.
  - 예: Day 2 items [A, B], Day 3 items [C, D] → last-kept=Day 1 로 모두 이동
  - 원 day 순서 + 원 sort_order 순서를 보존하려면 `(day_number - new_count) * 10000 + sort_order` 같은 compound key 사용 후 재번호
  - `10000` 은 day 당 item 수 최대치 안전마진. day 당 item 수 < 10000 이면 안전 (실제론 100 미만 예상)
- 재번호로 sort_order 가 1~N 의 gap-free 로 정리.

**Patch T — 축소 확인 UI 의 카피는 이미 forward-compatible:**
- Phase 2 `<DateShrinkConfirm />` 카피 "Day {n1}~{n2} 의 일정은 마지막 Day 로 이동돼요" 는 그대로 유효.
- Phase 3 에선 동적 수치("일정 K개가 이동됩니다") 바인딩 추가. 클라이언트가 사전 count 쿼리 후 표시.

**Patch U — 확장 케이스는 items 이동 없음:**
- Phase 3 확장 로직은 **축소에만 적용**. 확장은 기존 day 의 items 무영향.

### 4.4 Integration 테스트 매트릭스 (Phase 3 확장)

Phase 2 baseline 7 케이스 + 3 신규:

| # | 시나리오 | 기대 |
|---|---|---|
| 1 | 확장 (Day 3 → Day 5, items 0) | day 수 3→5, start_date/end_date 반영 |
| 2 | 축소 (Day 5 → Day 3, items 0) | day 수 5→3, start_date/end_date 반영 |
| 3 | 동일 (Day 3 → Day 3) | no-op (date 변경 없음) |
| 4 | 단일일 (Day 3 → Day 1) | day 수 3→1, start=end |
| 5 | 비소유자 | `trip_not_found_or_forbidden` |
| 6 | 범위 반전 (start > end) | `invalid_date_range` |
| 7 | 연속 호출 idempotent (같은 범위 2회) | 두 번째 호출 no-op |
| **8** | **축소 + items 이동** (Day 3 에 items 3개, Day 4 에 items 2개 → new_end_day=2) | Day 2 에 items 5개 (원 Day 2 의 items 이어 Day 3 items, 그 뒤 Day 4 items, sort_order 1~5 로 재번호) |
| **9** | **start_date 이동으로 day_number 쉬프트** (2026-05-01~05 → 2026-05-03~07) | 모든 day_number 유지, date 만 +2일 쉬프트, items FK 무변화 |
| **10** | **축소 후 확장 연쇄** (5→2→4) | 첫 축소에서 합쳐진 items 는 Day 2 에 남음, 확장 시 Day 3/4 는 빈 채로 추가 |

### 4.5 Realtime 파급

- `trips` UPDATE (start/end_date) 1회
- `trip_days` UPDATE 1~N회 (date 변경)
- `trip_days` INSERT/DELETE 0~M회
- `schedule_items` UPDATE 0~K회 (축소 시 이동 대상)

모두 단일 트랜잭션 커밋에 포함 → 파트너 클라이언트는 일관된 상태 수신. 클라이언트는 `['trips','detail',id]` + `['schedule',tripId]` 둘 다 invalidate.

---

## 5. Maps Provider Interface + 환경변수 + CSP

### 5.1 설계 원칙

ADR-009 의 **dual-provider (Naver 국내 / Google 해외)** 결정을 실제 코드에 매핑한다. 핵심 원칙:

1. **트립 레벨 고정** — `trip.is_domestic` 으로 provider 가 한 번 결정되면 그 trip 의 모든 schedule_items 는 같은 provider. 혼용 금지 (Patch H of §2).
2. **Lazy load** — 지도는 일정 탭 진입 시에만 SDK 주입. `/trips`, `/settings/*`, 다른 탭에 영향 없음.
3. **인터페이스 추상화** — 탭 UI 는 `MapsProvider` 인터페이스만 의존. Naver/Google 구현체는 lib/maps/providers/ 내 별도 파일.
4. **검색은 서버 경유** — 장소 검색 API 는 secret key 노출 위험 + rate limit 통제를 위해 항상 `/api/maps/search` 서버 라우트 경유. Maps JS SDK 만 클라이언트 직접 로드.

### 5.2 TypeScript 인터페이스

**`lib/maps/types.ts`:**

```typescript
export type MapsProviderName = 'naver' | 'google';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface PlaceResult {
  externalId: string;   // provider 고유 ID (Naver: mapx/mapy 조합 또는 link, Google: place_id)
  name: string;
  address: string;
  lat: number;
  lng: number;
  provider: MapsProviderName;
}

export interface MarkerSpec {
  lat: number;
  lng: number;
  label: string;        // "1", "2", ...
  onClick?: () => void;
}

export interface MapOptions {
  center: LatLng;
  zoom: number;
}

export interface MapHandle {
  setCenter(center: LatLng): void;
  fitBounds(points: LatLng[]): void;
  addMarkers(markers: MarkerSpec[]): void;
  clearMarkers(): void;
  destroy(): void;
}

export interface MapsProvider {
  readonly name: MapsProviderName;
  loadSdk(): Promise<void>;
  createMap(container: HTMLElement, options: MapOptions): MapHandle;
}
```

**`lib/maps/provider.ts`:**

```typescript
import type { MapsProvider, MapsProviderName } from './types';

// Provider 싱글톤 — SDK script 는 페이지당 1회만 로드
const cache = new Map<MapsProviderName, MapsProvider>();

export async function getMapsProvider(name: MapsProviderName): Promise<MapsProvider> {
  const cached = cache.get(name);
  if (cached) {
    await cached.loadSdk(); // loadSdk() 는 내부에서 promise caching
    return cached;
  }
  const mod = name === 'naver'
    ? await import('./providers/naver-provider')
    : await import('./providers/google-provider');
  const provider = mod.default;
  cache.set(name, provider);
  await provider.loadSdk();
  return provider;
}

export function providerForTrip(isDomestic: boolean): MapsProviderName {
  return isDomestic ? 'naver' : 'google';
}
```

**Patch V — 동적 import 로 번들 분리:**
- `await import('./providers/naver-provider')` 는 Next.js Turbopack 이 별도 chunk 로 분리. 해외 trip 은 Naver 번들 로드 안 함.
- Maps SDK 자체 script 태그는 `loadSdk()` 내부에서 `document.createElement('script')` 로 주입. Promise caching 으로 동시 호출 시 중복 로드 방지.

### 5.3 Naver 구현체 — `lib/maps/providers/naver-provider.ts`

```typescript
import type { MapsProvider, MapHandle, MapOptions, MarkerSpec, LatLng } from '../types';

declare global {
  interface Window {
    naver?: {
      maps: {
        Map: new (el: HTMLElement, opts: unknown) => NaverMapInstance;
        LatLng: new (lat: number, lng: number) => unknown;
        LatLngBounds: new () => NaverBounds;
        Marker: new (opts: unknown) => NaverMarker;
        Event: { addListener(target: unknown, type: string, fn: () => void): void };
      };
    };
  }
}

interface NaverMapInstance {
  setCenter(latlng: unknown): void;
  fitBounds(bounds: unknown): void;
  destroy?: () => void;
}
interface NaverBounds {
  extend(latlng: unknown): void;
}
interface NaverMarker {
  setMap(m: NaverMapInstance | null): void;
}

let loadPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.naver?.maps) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
    if (!clientId) { reject(new Error('missing NEXT_PUBLIC_NAVER_MAP_CLIENT_ID')); return; }
    const script = document.createElement('script');
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${clientId}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { loadPromise = null; reject(new Error('naver sdk load failed')); };
    document.head.appendChild(script);
  });
  return loadPromise;
}

function createMap(container: HTMLElement, options: MapOptions): MapHandle {
  if (!window.naver?.maps) throw new Error('naver sdk not loaded');
  const ns = window.naver.maps;
  const map = new ns.Map(container, {
    center: new ns.LatLng(options.center.lat, options.center.lng),
    zoom: options.zoom,
  });
  let markers: NaverMarker[] = [];

  return {
    setCenter(c: LatLng) { map.setCenter(new ns.LatLng(c.lat, c.lng)); },
    fitBounds(points: LatLng[]) {
      if (points.length === 0) return;
      const bounds = new ns.LatLngBounds();
      points.forEach(p => bounds.extend(new ns.LatLng(p.lat, p.lng)));
      map.fitBounds(bounds);
    },
    addMarkers(specs: MarkerSpec[]) {
      specs.forEach(spec => {
        const marker = new ns.Marker({
          position: new ns.LatLng(spec.lat, spec.lng),
          map,
          icon: { content: renderMarkerHtml(spec.label) },
        });
        if (spec.onClick) ns.Event.addListener(marker, 'click', spec.onClick);
        markers.push(marker);
      });
    },
    clearMarkers() {
      markers.forEach(m => m.setMap(null));
      markers = [];
    },
    destroy() {
      markers.forEach(m => m.setMap(null));
      markers = [];
      map.destroy?.();
    },
  };
}

function renderMarkerHtml(label: string): string {
  // Tailwind 클래스 의존성 회피 — inline style 로 dark orange 번호 마커
  return `<div style="background:#F54E00;color:#fff;width:28px;height:28px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;font-weight:600;font-size:13px;
    box-shadow:0 2px 4px rgba(0,0,0,.25);border:2px solid #fff">${label}</div>`;
}

const provider: MapsProvider = { name: 'naver', loadSdk, createMap };
export default provider;
```

### 5.4 Google 구현체 — `lib/maps/providers/google-provider.ts`

```typescript
import type { MapsProvider, MapHandle, MapOptions, MarkerSpec, LatLng } from '../types';

declare global {
  interface Window {
    google?: {
      maps: {
        Map: new (el: HTMLElement, opts: unknown) => GoogleMapInstance;
        LatLng: new (lat: number, lng: number) => unknown;
        LatLngBounds: new () => GoogleBounds;
        marker: {
          AdvancedMarkerElement: new (opts: unknown) => GoogleMarker;
          PinElement: new (opts: unknown) => { element: HTMLElement };
        };
      };
    };
  }
}

interface GoogleMapInstance {
  setCenter(latlng: unknown): void;
  fitBounds(bounds: unknown): void;
}
interface GoogleBounds { extend(latlng: unknown): void; }
interface GoogleMarker { map: GoogleMapInstance | null; }

let loadPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) { reject(new Error('missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY')); return; }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker&v=weekly&loading=async`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { loadPromise = null; reject(new Error('google sdk load failed')); };
    document.head.appendChild(script);
  });
  return loadPromise;
}

// createMap / renderMarkerHtml 은 Naver 와 동일 구조. AdvancedMarkerElement 사용.
// 구현 상세는 Implementation Plan 에서.

const provider: MapsProvider = { name: 'google', loadSdk, createMap: createMapImpl };
export default provider;
```

**Patch W — Google AdvancedMarkerElement 선택 이유:**
- 기존 `google.maps.Marker` 는 2024-02-21 deprecated. `AdvancedMarkerElement` 가 정식. `libraries=marker` 파라미터 필수.
- `v=weekly` 는 최신 안정 채널. 프로덕션에서 lockdown 이슈 발생하면 `v=quarterly` 로 전환 가능.

### 5.5 환경변수

**추가 환경변수 5개** (ADR-009 의 4개 + 보정):

| 키 | Scope | 용도 |
|---|---|---|
| `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` | public | NCP Maps JS SDK — 도메인 제한으로 안전 |
| `NAVER_SEARCH_CLIENT_ID` | server | developers.naver.com 지역검색 API — secret |
| `NAVER_SEARCH_CLIENT_SECRET` | server | 지역검색 Client Secret |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | public | Google Maps JS — HTTP referrer 제한으로 안전 |
| `GOOGLE_MAPS_SERVER_KEY` | server | Google Places API (Text Search) — IP 제한 |

**Patch X — 네이버 Maps 와 Search 는 별도 console:**
- NCP Maps (Maps JS SDK, Geocoding): `console.ncloud.com` → AI-NAVER-API > Maps
- 지역검색: `developers.naver.com` → 오픈 API — 별도 애플리케이션 등록
- 두 서비스의 Client ID 는 **서로 다른 값**. 혼동 방지를 위해 변수명에 Map/Search 명시.

**Patch Y — Google server key 분리:**
- JS SDK 키는 HTTP referrer 로 제한 (프런트 노출 가능)
- Places API 서버 키는 IP 제한 (Vercel Functions egress IP — Vercel Dashboard 의 Fixed IPs 또는 allow-all 정책). 이유: referrer 없는 server call 에서도 작동해야 함.

**`lib/env.ts` 확장:**

```typescript
// 클라이언트 스키마 확장
const clientEnvSchema = z.object({
  // ... 기존 Phase 1~2
  NEXT_PUBLIC_NAVER_MAP_CLIENT_ID: z.string().min(1),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(1),
});

// 서버 스키마 확장
const serverEnvSchema = clientEnvSchema.extend({
  // ... 기존 Phase 1~2
  NAVER_SEARCH_CLIENT_ID: z.string().min(1),
  NAVER_SEARCH_CLIENT_SECRET: z.string().min(1),
  GOOGLE_MAPS_SERVER_KEY: z.string().min(1),
});
```

**`.env.example` 갱신:** 5 키 추가 + 가이드 주석.

### 5.6 CSP 갱신 — `next.config.ts`

Phase 1·2 CSP 를 지도용으로 확장:

```typescript
const csp = [
  "default-src 'self'",
  // script: 기존 + Naver Maps + Google Maps JS
  "script-src 'self' " + (isDev ? "'unsafe-eval' " : "") +
    "https://accounts.google.com " +
    "https://oapi.map.naver.com " +              // Naver Maps SDK
    "https://maps.googleapis.com " +              // Google Maps JS loader
    "'nonce-${nonce}'",
  // connect: 기존 + 지도 API + 검색 server route (자신)
  "connect-src 'self' " +
    `https://${supabaseHost} wss://${supabaseHost} ` +
    "https://accounts.google.com " +
    "https://naveropenapi.apigw.ntruss.com " +   // NCP Geocoding/Reverse 등
    "https://maps.googleapis.com",
  // image: 기존 + 지도 타일/정적 이미지
  "img-src 'self' data: blob: " +
    "https://*.naver.net " +                      // Naver 타일
    "https://*.pstatic.net " +                    // Naver 정적
    "https://maps.googleapis.com " +              // Google Static Maps
    "https://maps.gstatic.com " +                 // Google 아이콘
    "https://*.googleusercontent.com",            // Google Places photos
  // style: Google Maps 가 inline style 사용 → 'unsafe-inline' (Google 공식 권장)
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "frame-src https://accounts.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];
```

**Patch Z — `style-src 'unsafe-inline'` 의 tradeoff:**
- Google Maps SDK 가 내부적으로 inline style 을 대량 주입 → nonce 또는 hash 로 제어 불가능
- Google 공식 문서 권장: `style-src 'unsafe-inline'`
- 보안 영향: 현재 프로젝트는 사용자 HTML 입력 없음(텍스트만) → XSS → inline style 공격 벡터 극히 제한적
- Phase 8 에서 `'unsafe-inline'` 제거 시도 가능한지 재검토 후보 (Google Maps SDK 가 nonce 지원할 경우)

**Patch AA — dev 환경 `ws://localhost:*` 유지:**
- 기존 Phase 1~2 의 `connect-src` 에 `ws://localhost:*` (HMR) 이미 있음. 재검토 불필요.

### 5.7 일정 탭 지도 패널 — `components/schedule/map-panel.tsx`

```typescript
"use client";
import { useEffect, useRef, useState } from 'react';
import { getMapsProvider, providerForTrip } from '@/lib/maps/provider';
import type { MapHandle } from '@/lib/maps/types';

interface Props {
  isDomestic: boolean;
  items: Array<{ id: string; place_lat: number; place_lng: number; label: string }>;
  onMarkerClick?: (itemId: string) => void;
}

export function MapPanel({ isDomestic, items, onMarkerClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<MapHandle | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const provider = await getMapsProvider(providerForTrip(isDomestic));
      if (cancelled || !containerRef.current) return;
      const firstPoint = items[0] ?? { place_lat: 37.5665, place_lng: 126.9780 }; // 서울 fallback
      handleRef.current = provider.createMap(containerRef.current, {
        center: { lat: firstPoint.place_lat, lng: firstPoint.place_lng },
        zoom: 13,
      });
      setReady(true);
    })();
    return () => {
      cancelled = true;
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, [isDomestic]);

  useEffect(() => {
    if (!ready || !handleRef.current) return;
    handleRef.current.clearMarkers();
    if (items.length === 0) return;
    handleRef.current.addMarkers(items.map(it => ({
      lat: it.place_lat,
      lng: it.place_lng,
      label: it.label,
      onClick: onMarkerClick ? () => onMarkerClick(it.id) : undefined,
    })));
    handleRef.current.fitBounds(items.map(it => ({ lat: it.place_lat, lng: it.place_lng })));
  }, [items, ready, onMarkerClick]);

  return <div ref={containerRef} className="w-full h-64 rounded-lg overflow-hidden bg-surface-200" />;
}
```

**Patch BB — provider 스위치 시 destroy/recreate:**
- `isDomestic` 가 바뀌면 (이론상 거의 없음, trip 편집으로 is_domestic 토글 시) provider 도 달라짐 → effect cleanup 이 destroy. 새 provider 로 recreate.
- 성능: trip 내에선 is_domestic 불변 → effect 는 1회만 실행.

**Patch CC — 첫 픽셀 fallback 좌표:**
- items 가 0개면 지도 중심을 "서울 시청(국내)" 또는 "도쿄역(해외)" 등으로 fallback. 여기선 단순히 서울 사용. UX 개선은 Phase 8 폴리시.

### 5.8 Integration & Unit 테스트 포인트

**Unit:**
- `providerForTrip(true) === 'naver'`, `providerForTrip(false) === 'google'`
- `renderMarkerHtml('3')` 이 `3` 문자 포함한 HTML string 반환

**Integration (DOM mock 은 jsdom 한계로 어려움 → Playwright E2E 에서):**
- Naver/Google SDK 실제 로드는 E2E 시나리오로 검증 (§8)

---

## 6. Place Search Flow

### 6.1 UI 흐름

일정 편집 모달 (`<ScheduleItemModal />`) 에서:

```
┌───────────────────────────────┐
│ [제목 입력]                    │
│ [시간 입력 — optional]         │
│ [장소: 선택됨 ▼ | 직접 검색 →] │ ← 장소 row
│   → tap                       │
└───────────────────────────────┘
             ↓
┌───────────────────────────────┐
│ PlaceSearchSheet (Bottom)     │
│ ┌─────────────────────────┐  │
│ │ 🔍 [검색어 입력]         │  │
│ └─────────────────────────┘  │
│ ────────────────────────────  │
│ ┌─ 결과 리스트 ──────────────┐│
│ │ 🍜 Ichiran Ramen           ││
│ │    도쿄 시부야구 ...         ││
│ │ ────────────────────────── ││
│ │ 🏯 Sensoji Temple          ││
│ │    도쿄 다이토구 ...         ││
│ └──────────────────────────┘│
│       [직접 입력으로 저장]    │
└───────────────────────────────┘
             ↓ (결과 tap)
장소 필드 자동 채움 + 시트 닫힘
```

### 6.2 서버 라우트 — `app/api/maps/search/route.ts`

**왜 서버 라우트인가:**
- Naver 지역검색은 Client Secret 필요 — 브라우저 노출 불가
- Google Places Text Search 도 server key 사용 권장 (referrer 제한 불필요, IP 제한)
- Rate limit · 캐싱 · 응답 정규화를 서버에서 일괄 처리

**요청 스키마:**

```typescript
// app/api/maps/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';

const requestSchema = z.object({
  query: z.string().min(1).max(100),
  provider: z.enum(['naver', 'google']),
  near: z.object({ lat: z.number(), lng: z.number() }).optional(),
});

export async function POST(req: NextRequest) {
  // 1) 인증 — Supabase 세션 확인 (anonymous 차단)
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  // 2) 입력 검증
  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  // 3) rate limit (Phase 3: 단순 메모리, Phase 8 에서 Upstash 등으로 교체 후보)
  //    유저당 분당 30건. 초과 시 429.
  if (!checkRateLimit(user.id)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  // 4) provider dispatch
  try {
    const results = parsed.data.provider === 'naver'
      ? await searchNaver(parsed.data.query)
      : await searchGoogle(parsed.data.query, parsed.data.near);
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: 'upstream_failure' }, { status: 502 });
  }
}
```

### 6.3 Naver 어댑터 — `lib/maps/search/naver-search.ts`

Naver 지역검색 API:
- Endpoint: `https://openapi.naver.com/v1/search/local.json?query=<q>&display=10`
- Headers: `X-Naver-Client-Id`, `X-Naver-Client-Secret`
- 응답의 `mapx`/`mapy` 는 **TM128 좌표계** (Naver 고유) — WGS84 변환 필요

```typescript
import type { PlaceResult } from '../types';
import { env } from '@/lib/env';

export async function searchNaver(query: string): Promise<PlaceResult[]> {
  const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=10`;
  const res = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': env.NAVER_SEARCH_CLIENT_ID,
      'X-Naver-Client-Secret': env.NAVER_SEARCH_CLIENT_SECRET,
    },
  });
  if (!res.ok) throw new Error(`naver search ${res.status}`);
  const json = await res.json() as NaverSearchResponse;
  return json.items.map(item => {
    const { lat, lng } = tm128ToWgs84(parseInt(item.mapx), parseInt(item.mapy));
    return {
      externalId: `naver:${item.link || `${item.mapx},${item.mapy}`}`,
      name: stripHtmlTags(item.title),         // 네이버 응답은 <b>강조</b> 포함 → 제거
      address: item.roadAddress || item.address,
      lat,
      lng,
      provider: 'naver' as const,
    };
  });
}
```

**Patch DD — TM128 → WGS84 변환:**
- Naver 지역검색은 legacy TM128 좌표 반환. 위도/경도로 변환해야 Maps SDK 마커에 사용 가능.
- 변환 공식은 복잡한 projection — 라이브러리 `proj4` 사용 or Naver 공식 변환 식을 인라인. Phase 3 Implementation Plan 에서 선택.
- 대안: Naver 지역검색 대신 **NCP Geocoding API** (WGS84 직접 반환) 사용 — 단점: POI 검색 기능 약함, 주소 위주.
- 결정: **지역검색(POI) + proj4 변환** 이 UX 승. Naver 공식 "좌표계 변환 가이드" 문서 기반.

**Patch EE — HTML 태그 제거:**
- Naver 응답의 `title` 에 `<b>` 강조 태그 포함 → UI 에 raw HTML 로 렌더 금지. `stripHtmlTags()` 유틸로 정리.
- XSS 측면: 검색어 자체가 HTML 로 에스케이프 없이 반영될 수 있음 → 반드시 태그 제거 + textContent 사용.

### 6.4 Google 어댑터 — `lib/maps/search/google-search.ts`

Google Places Text Search (New API):
- Endpoint: `https://places.googleapis.com/v1/places:searchText`
- Method: POST
- Headers: `X-Goog-Api-Key`, `X-Goog-FieldMask`
- WGS84 좌표 기본 (변환 불필요)

```typescript
export async function searchGoogle(query: string, near?: LatLng): Promise<PlaceResult[]> {
  const url = 'https://places.googleapis.com/v1/places:searchText';
  const body = {
    textQuery: query,
    ...(near && {
      locationBias: {
        circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 5000 },
      },
    }),
    pageSize: 10,
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_MAPS_SERVER_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`google search ${res.status}`);
  const json = await res.json() as GooglePlacesResponse;
  return (json.places ?? []).map(p => ({
    externalId: `google:${p.id}`,
    name: p.displayName?.text ?? '',
    address: p.formattedAddress ?? '',
    lat: p.location.latitude,
    lng: p.location.longitude,
    provider: 'google' as const,
  }));
}
```

**Patch FF — FieldMask 로 비용 제어:**
- Google Places New API 는 반환 필드별 과금. 필수 필드만 요청 → cost 최소화.
- `id`, `displayName`, `formattedAddress`, `location` 4개만. `photos`, `rating` 등은 제외.

### 6.5 클라이언트 — `lib/maps/use-place-search.ts`

```typescript
import { useMutation } from '@tanstack/react-query';
import type { PlaceResult, MapsProviderName } from './types';

export function usePlaceSearch() {
  return useMutation({
    mutationFn: async (vars: { query: string; provider: MapsProviderName; near?: LatLng }) => {
      const res = await fetch('/api/maps/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? 'search_failed');
      }
      const { results } = await res.json() as { results: PlaceResult[] };
      return results;
    },
  });
}
```

UI 에서 debounce (300ms) 후 `mutate({ query, provider })` → 결과 리스트 렌더.

### 6.6 `<PlaceSearchSheet />` 컴포넌트 카피

| 상태 | UI |
|---|---|
| 초기 (검색어 없음) | "장소를 검색해보세요" + 추천어 힌트 "예: 성수동 카페, 시부야 라멘" |
| 검색 중 | Skeleton 3개 |
| 결과 0개 | "검색 결과가 없어요" · [직접 입력으로 저장] 버튼 |
| 결과 있음 | 리스트 (icon + name + address) · tap 시 선택 |
| 에러 (upstream_failure) | "장소 검색이 일시적으로 어려워요. 직접 입력하실 수 있어요." · [직접 입력] |
| 에러 (rate_limited) | "검색을 너무 많이 하셨어요. 잠시 후 다시 시도해주세요." |

### 6.7 저장 정책

장소 선택 시 schedule_items 에 저장되는 필드:

| DB 컬럼 | 출처 |
|---|---|
| place_name | `PlaceResult.name` |
| place_address | `PlaceResult.address` |
| place_lat | `PlaceResult.lat` |
| place_lng | `PlaceResult.lng` |
| place_provider | `PlaceResult.provider` |
| place_external_id | `PlaceResult.externalId` |

"직접 입력" 선택 시 → 모든 place_* 필드 `null` (§2 Patch F 원자성 만족).

**Patch GG — provider 가 trip.is_domestic 과 불일치 방지:**
- UI 에서 `PlaceSearchSheet` 은 `providerForTrip(trip.is_domestic)` 로 고정 호출 → 반대 provider 검색 자체가 불가.
- `create_schedule_item`/`update_schedule_item` RPC 에서도 검증 (§2 Patch H) — 이중 방어.

---

## 7. 일정 ↔ 경비 연동 준비 훅

### 7.1 Phase 3 의 역할

원 스펙 §6.4 Schedule 의 ⋮ 메뉴:
- 편집
- 다른 날로 이동
- **경비 추가** → 경비 입력 폼 열림 (제목·날짜 자동 채움)
- 삭제

Phase 3 에선 **expenses 테이블 자체가 없음** → "경비 추가" 메뉴는 활성화 불가. Phase 4 에 본격 연동.

### 7.2 결정 — Phase 3 에서는 메뉴 숨김

**Patch HH — "경비 추가" 메뉴는 Phase 3 에서 렌더 자체 생략:**
- 대안 A (선택): 메뉴에서 제외. Phase 4 에서 활성화.
- 대안 B: 메뉴에 disabled "경비 추가 (곧 사용 가능)" 표시.
- 채택: **대안 A**. 이유:
  - disabled 메뉴는 사용자 클릭 시 기대 위배 → 부정적 UX
  - Phase 0 mockup 철학("다음 단계에서 연결됩니다" 배너) 는 탭 레벨 에만 적용. 개별 액션은 숨김 선호
  - Phase 4 에서 메뉴 항목 1줄 추가 비용 거의 0

### 7.3 DB 스키마 — Phase 3 에서 변경 없음

최초 스펙의 `expenses.schedule_item_id uuid FK → schedule_items ON DELETE SET NULL` 는 **Phase 4 마이그레이션(0007)** 에서 expenses 테이블과 함께 추가. Phase 3 의 `schedule_items` 에는 경비 관련 컬럼 없음.

**schedule_items 삭제 시 cascade 동작 (Phase 4 후):**
- `expenses.schedule_item_id → NULL` (경비는 보존)
- Phase 3 은 이 동작을 알 필요 없음 — schedule_items 삭제는 단순 DELETE

### 7.4 RPC — Phase 3 에서 변경 없음

`create_schedule_item`, `update_schedule_item`, `delete_schedule_item` 은 expenses 와 무관한 독립 RPC.

Phase 4 에서 추가될 RPC:
- `create_expense_from_schedule_item(p_schedule_item_id uuid, p_amount numeric, p_currency text)` — 일정 상세의 "경비 추가" 버튼이 호출
- `link_expense_to_schedule_item(p_expense_id uuid, p_schedule_item_id uuid)` — 기존 경비 연결
- `unlink_expense_from_schedule_item(p_expense_id uuid)` — 연결 해제

이들은 **Phase 4 Design Spec 에서 구체화**. Phase 3 은 name 만 예약.

### 7.5 UI 컴포넌트 — Phase 3 ↔ Phase 4 경계

| 컴포넌트 | Phase 3 상태 | Phase 4 확장 |
|---|---|---|
| `<ScheduleItemCard />` ⋮ 메뉴 | 편집 / 다른 날로 이동 / 삭제 (3개) | + 경비 추가 (4개) |
| `<ScheduleItemModal />` | 제목·시간·장소·메모·URL | + 연결된 경비 리스트 섹션 |
| `<ExpenseListTab />` | mock + 배너 | 실 DB, schedule_items 연결 표시 |

**Phase 4 에서 ScheduleItemModal 의 변경 최소화 설계:**
- 현재 모달에 `<LinkedExpensesSection />` 을 **조건부 렌더** 형태로 자리 예약:
  ```tsx
  {/* Phase 4 에서 활성화 */}
  {/* <LinkedExpensesSection scheduleItemId={item.id} /> */}
  ```
- 이 주석은 코드 리더에게 의도 전달용. CLAUDE.md "rot 위험 주석" 원칙과 충돌 가능하므로 **주석 대신 Phase 4 design spec 에 명시** 하는 방식 채택. 코드에는 남기지 않음.

### 7.6 schedule_item 데이터 모델에 "expense hint" 없음

일부 설계에서는 schedule_items 에 `estimated_cost_krw numeric` 같은 예상 비용 필드를 추가하기도 한다. Phase 3 에서 **도입하지 않음**:
- 이유: expenses 가 실 지출을 다루고, 예상치는 UX 요구 미확인. YAGNI.
- 재검토: V2+ 에서 "예산 계획" 기능 제안 시.

---

## 8. E2E Automation Return Infrastructure

### 8.1 배경

Phase 2 Task 16 에서 Playwright 자동화 시도 → Google OAuth 가 automation-controlled 브라우저(Chrome for Testing + `channel: "chrome"`) 를 "브라우저가 안전하지 않음" 으로 거절 → 우회 불가 → **수동 체크리스트로 대체**. Phase 3 에서는 자동화 복귀가 **Exit Criteria 의 일부**.

핵심 통찰: Google OAuth 는 우회할 수 없지만, **Google OAuth 를 거치지 않고 Supabase 세션을 획득하는 경로** 는 있다 — `auth.admin.createUser({ email, password })` + `signInWithPassword`. E2E 테스트는 이 경로로 인증을 bypass.

### 8.2 설계 원칙

1. **테스트 전용 유저 pool** — `alice@test.travel-manager.local`, `bob@test.travel-manager.local`. Integration 테스트와 공유 (Phase 1~2 에서 이미 사용).
2. **Service role 키는 CI secret + 로컬 `.env.test` 전용** — production .env 에는 절대 미포함. `lib/env.ts` 의 server schema 에서 이미 관리.
3. **Global setup 1회 실행** — 모든 spec 시작 전 Supabase admin API 로 유저 생성/보장 + `signInWithPassword` → cookie 획득 → `storageState` 파일 저장. 각 spec 은 저장된 상태에서 시작.
4. **Google OAuth 는 smoke only** — `login.spec.ts` 는 Google 버튼 렌더만 검증(클릭 skip), CI 에서는 `test.skip` 조건부.
5. **Teardown idempotent** — truncate cascade 헬퍼로 매 spec 전 DB reset. Integration 패턴 재사용.

### 8.3 파일 구조

```
tests/
├── e2e/
│   ├── helpers/
│   │   ├── auth.ts               # ensureTestUser, buildStorageState
│   │   ├── db-reset.ts           # truncateCascade, seedBaseline
│   │   └── realtime-hooks.ts     # window.__realtimeEvents 대기 유틸
│   ├── fixtures/
│   │   └── users.ts              # alice/bob 상수
│   ├── global-setup.ts           # Playwright global — storageState 2종 생성
│   ├── global-teardown.ts        # 테스트 DB 정리 (optional)
│   ├── .auth/                    # storageState JSON (gitignored)
│   │   ├── alice.json
│   │   └── bob.json
│   ├── login.spec.ts             # 기존 (Google smoke, CI skip)
│   ├── schedule-crud.spec.ts     # 신규
│   ├── drag-same-day.spec.ts     # 신규
│   ├── drag-cross-day.spec.ts    # 신규
│   ├── partner-realtime.spec.ts  # 기존 (Phase 2 plan) — 이제 실행 가능
│   ├── share-toggle.spec.ts      # 신규 (§9 자동 전환 포함)
│   └── resize-with-items.spec.ts # 신규 (축소 시 items 합병)
```

### 8.4 Helper — `tests/e2e/helpers/auth.ts`

```typescript
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { request, type APIRequestContext } from '@playwright/test';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface TestUser {
  email: string;
  password: string;
  displayName: string;
}

let adminClient: SupabaseClient | null = null;
function getAdmin(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

/**
 * 멱등: 유저가 이미 있으면 패스, 없으면 생성.
 * email_confirm: true 로 verified 상태 (confirm email 플로우 회피).
 */
export async function ensureTestUser(user: TestUser): Promise<string> {
  const admin = getAdmin();

  // 1) 기존 유저 확인 (listUsers 는 pagination — email 필터)
  const { data: existing } = await admin.auth.admin.listUsers({
    page: 1, perPage: 200,
  });
  const found = existing?.users.find(u => u.email === user.email);
  if (found) {
    // password reset (테스트 안정성 — 이전 run 에서 변경됐을 수 있음)
    await admin.auth.admin.updateUserById(found.id, {
      password: user.password,
    });
    return found.id;
  }

  // 2) 생성
  const { data, error } = await admin.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { display_name: user.displayName },
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  return data.user.id;
}

/**
 * Supabase signInWithPassword 로 세션 획득 → Next.js app cookie 로 포맷팅 → storageState JSON.
 * 주의: Supabase SSR cookie 포맷과 호환되는 직렬화 필요.
 * 간단한 경로: 실제 브라우저 띄워 /login 페이지에서 dev-only test endpoint 호출 → cookie 를
 * 정상 경로로 세팅한 뒤 storageState dump.
 */
export async function buildStorageState(user: TestUser, outputPath: string): Promise<void> {
  const ctx = await request.newContext();

  // dev-only test endpoint: app/api/test/sign-in/route.ts (NODE_ENV !== production guard)
  // body: { email, password } → server 가 createServerClient 로 signInWithPassword + Set-Cookie
  const res = await ctx.post(`${process.env.PLAYWRIGHT_BASE_URL}/api/test/sign-in`, {
    data: { email: user.email, password: user.password },
  });
  if (!res.ok()) throw new Error(`test sign-in failed: ${res.status()}`);

  await ctx.storageState({ path: outputPath });
  await ctx.dispose();
}
```

**Patch II — dev-only test endpoint `app/api/test/sign-in/route.ts`:**
- 이유: Supabase SSR cookie 는 `@supabase/ssr` 의 `createServerClient` 가 설정하는 특정 포맷(`sb-<project>-auth-token` base64 JSON). Playwright 에서 이 cookie 를 수동 생성하면 포맷 drift 리스크.
- endpoint 는 **guard 3중**:
  1. `process.env.NODE_ENV !== 'production'` — prod 빌드 throw
  2. `process.env.ALLOW_TEST_SIGNIN === 'true'` — 명시적 opt-in
  3. 요청에 `X-Test-Secret` 헤더 검증 — CI secret
- 이 route 는 `lib/mocks/factory.ts` 와 같은 급의 "테스트 전용 인프라" 로 관리. eslint `no-restricted-imports` 같은 추가 가드는 불필요 (route 자체가 가드 내장).

### 8.5 Global setup — `tests/e2e/global-setup.ts`

```typescript
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { ALICE, BOB } from './fixtures/users';
import { ensureTestUser, buildStorageState } from './helpers/auth';
import { truncateCascade } from './helpers/db-reset';

export default async function globalSetup() {
  // 1) DB reset — 이전 run 의 테스트 데이터 제거
  await truncateCascade();

  // 2) 테스트 유저 생성/보장
  await ensureTestUser(ALICE);
  await ensureTestUser(BOB);

  // 3) storageState 생성
  const aliceState = resolve('tests/e2e/.auth/alice.json');
  const bobState = resolve('tests/e2e/.auth/bob.json');
  await mkdir(dirname(aliceState), { recursive: true });
  await buildStorageState(ALICE, aliceState);
  await buildStorageState(BOB, bobState);
}
```

### 8.6 Playwright config — `playwright.config.ts` 확장

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: require.resolve('./tests/e2e/global-setup'),
  fullyParallel: false,   // DB 공유하므로 병렬 비활성 (Phase 3 초기)
  workers: 1,

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'anonymous',
      use: { ...devices['Desktop Chrome'] },
      testMatch: ['login.spec.ts'],
    },
    {
      name: 'alice',
      use: { ...devices['Desktop Chrome'], storageState: 'tests/e2e/.auth/alice.json' },
      testMatch: ['schedule-crud.spec.ts', 'drag-*.spec.ts', 'resize-with-items.spec.ts'],
    },
    {
      name: 'partner-dual',
      use: { ...devices['Desktop Chrome'] },
      testMatch: ['partner-realtime.spec.ts', 'share-toggle.spec.ts'],
      // 이 프로젝트는 테스트 내에서 alice + bob context 를 수동 생성 (storageState 파일 2개 로드)
    },
  ],
});
```

**Patch JJ — partial concurrency 비활성화 이유:**
- 유저 fixture 공유 (alice/bob) + DB 공유 → race. Phase 3 는 단순함 우선.
- V2+ 에서 유저 pool (alice-1, alice-2, ...) + 테스트별 isolated 유저로 확장 검토.

**Patch KK — 2-browser context 시나리오 (partner-realtime, share-toggle):**
- 한 spec 안에서 `browser.newContext({ storageState: 'alice.json' })` + `browser.newContext({ storageState: 'bob.json' })` 로 2개 생성
- alice context 에서 owner 작업 → bob context 에서 partner 반응 `waitForFunction` 으로 확인
- Phase 2 plan 의 설계 그대로. 이번엔 실제 구현.

### 8.7 db-reset helper — `tests/e2e/helpers/db-reset.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

export async function truncateCascade() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // SECURITY DEFINER RPC `test_truncate_cascade()` 를 DB 에 추가하고 service_role 에만 grant
  // 이유: truncate 은 TRUNCATE 권한 필요 + CASCADE 로 관련 테이블 일괄 초기화
  const { error } = await admin.rpc('test_truncate_cascade');
  if (error) throw new Error(`truncate failed: ${error.message}`);
}
```

**Patch LL — `test_truncate_cascade` SECURITY DEFINER RPC:**
- 마이그레이션에 포함하지 않고 `supabase/seed/test.sql` 같은 테스트 전용 스크립트로 별도 관리
- production DB 에 배포되지 않도록 main migration 에서 분리
- `test-env` 에서만 실행: `psql $DATABASE_URL -f supabase/seed/test.sql`

**Patch MM — alice/bob auth.users 는 보존:**
- `truncateCascade` 는 `public.*` 만 초기화 (profiles, groups, trips, trip_days, schedule_items, group_members). `auth.users` 는 건드리지 않음 → alice/bob 재생성 불필요
- `ensureTestUser` 가 이미 멱등

### 8.8 Realtime 대기 유틸 — `tests/e2e/helpers/realtime-hooks.ts`

Phase 2 설계의 `window.__realtimeEvents` dev-only 훅을 활용.

```typescript
import type { Page } from '@playwright/test';

export async function waitForRealtimeEvent(
  page: Page,
  predicate: (ev: { table: string; eventType: string; new?: unknown; old?: unknown }) => boolean,
  timeoutMs = 5000
): Promise<void> {
  await page.waitForFunction(
    (pred) => {
      const events = (window as unknown as { __realtimeEvents?: unknown[] }).__realtimeEvents ?? [];
      return events.some(ev => (eval(`(${pred})`))(ev));
    },
    predicate.toString(),
    { timeout: timeoutMs }
  );
}
```

**Patch NN — `eval` 사용 정당화:**
- `page.evaluate` 에 function 를 직접 pass 할 수 있지만 closure 바인딩 어려움. 이 내부 유틸에 한정하여 `eval` 사용.
- dev CSP 가 `unsafe-eval` 을 이미 허용 (Phase 1 Next.js HMR) → 기능상 문제 없음.
- prod 빌드에선 이 파일이 import 되지 않음 (tests 폴더 exclude).

### 8.9 CI 통합

- GitHub Actions `.github/workflows/e2e.yml` (Phase 3 Task 에서 신규):
  1. Supabase 로컬 CLI 로 임시 DB 기동 (or dedicated test project)
  2. `pnpm db:migrate` + `psql -f supabase/seed/test.sql`
  3. `pnpm build` + `pnpm start` background
  4. `pnpm exec playwright test`
  5. artifacts 업로드 (trace, video)
- Secrets: `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_*` (public 이지만 CI 에서도 필요), `ALLOW_TEST_SIGNIN`, `TEST_SECRET`

**Patch OO — Phase 3 은 CI 통합 optional:**
- 로컬 Playwright 통과가 Phase 3 Exit 의 필수. CI 워크플로우 파일 작성은 Phase 3 Task 후반 or Phase 4 로 이월.
- 이유: Supabase CI 환경 비용 + Vercel preview 연동 설계까지 포함하면 Phase 3 범위 초과.

---

## 9. Partner Share-Toggle OFF 자동 Realtime 전환 ADR

### 9.1 문제 복기 (Phase 2 known limitation)

Partner 측에서 owner 가 파트너 공유 토글을 OFF 로 하면:
- 기대 동작: Partner 의 `/trips` 목록에서 해당 trip 이 즉시 사라짐. 현재 보고 있던 `/trips/{id}` 페이지는 `<TripUnavailable />` 로 전환.
- 실제 Phase 2 동작: **새로고침 전까지 전환 안 됨.** 일부 경우 목록에 stale row 잔존.

원인:
- `trips` UPDATE (group_id: `my_group_id` → `NULL`) 이벤트가 Realtime 으로 송신되지만, Partner 클라이언트는 이를 "삭제" 로 해석하지 않고 단순 invalidate 만 수행
- invalidate 후 refetch → RLS 상 visibility 사라져 row 누락 → list 는 갱신되지만 detail 쿼리의 stale cache 처리가 미흡

### 9.2 원인 심층 분석

Supabase Realtime 의 실제 송신 규칙:
- `UPDATE` 이벤트는 **old row RLS 평가** 또는 **new row RLS 평가** 중 하나라도 통과하면 수신자에게 송신
- 따라서 group_id: X → NULL 전이는 Partner 에게 수신됨 (old.group_id=X 기준 visible)
- 하지만 **기본 REPLICA IDENTITY (DEFAULT)** 상태에서 payload 의 `old` 는 **PK만 포함**, 나머지 컬럼은 `undefined`. → 클라이언트가 `old.group_id` 를 읽을 수 없어 "나에게 더 이상 visible 이 아님" 을 판정 불가

### 9.3 선택지

#### 옵션 A: `REPLICA IDENTITY FULL` + 클라이언트 가상 DELETE 판정
- **장점:**
  - 간단한 DB 한 줄 변경 (`alter table trips replica identity full`)
  - Supabase Realtime 기본 기능만 사용, 트리거 불필요
  - `old.group_id` 전 상태 접근 → 가상 DELETE 판정 가능
  - `group_members` 에도 같은 패턴 적용 가능 (본인이 그룹에서 제거되는 경우)
- **단점:**
  - 모든 UPDATE 의 WAL 크기 증가 (old row 전체 포함)
  - `trips` 는 update 빈도 낮아 영향 미미, `schedule_items` 등 빈도 높은 테이블엔 적용 신중

#### 옵션 B: 서버 트리거로 별도 broadcast
- **장점:** WAL 영향 없음
- **단점:**
  - pg_notify / realtime.broadcast 분리 채널 설계 복잡
  - 테이블-이벤트 이중화로 유지보수 비용 큼
  - 클라이언트가 postgres_changes + broadcast 둘 다 구독

#### 옵션 C: 앱 레벨 broadcast (Supabase Realtime Broadcast channel)
- **장점:** 기능은 같음
- **단점:** app 코드가 매 UPDATE 후 명시적 broadcast 발행 — 누락 위험 + 이중 write

#### 옵션 D: 클라이언트 주기적 poll
- 기각 (UX 후퇴)

### 9.4 결정

**옵션 A 채택 — `alter table trips replica identity full`.**

마이그레이션 `0006_schedule_rpc.sql` 끝 또는 전용 `0007_replica_identity.sql` 에:

```sql
alter table public.trips replica identity full;
-- group_members 는 이미 primary key 가 (group_id, user_id) 로 composite 아닌 id 단일 PK.
-- dissolve 시 본인 row DELETE 가 발생 → 기본 REPLICA IDENTITY DEFAULT 로도 수신 가능.
-- 필요 시 Phase 4+ 에서 group_members 도 FULL 로 전환 검토.
```

### 9.5 클라이언트 로직 — `lib/realtime/trips-channel.ts`

```typescript
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { QueryClient } from '@tanstack/react-query';

interface TripsChannelContext {
  supabase: SupabaseClient;
  queryClient: QueryClient;
  currentUserId: string;
  currentGroupId: string | null;  // 내 active group id (없으면 null)
}

export function subscribeTripsChannel(ctx: TripsChannelContext): RealtimeChannel {
  return ctx.supabase
    .channel('trips-visibility')
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'trips' },
      (payload) => {
        const oldRow = payload.old as { id: string; group_id: string | null; created_by: string };
        const newRow = payload.new as { id: string; group_id: string | null; created_by: string };

        const myId = ctx.currentUserId;
        const myGroup = ctx.currentGroupId;

        const wasVisible =
          oldRow.created_by === myId ||
          (oldRow.group_id !== null && oldRow.group_id === myGroup);
        const isVisibleNow =
          newRow.created_by === myId ||
          (newRow.group_id !== null && newRow.group_id === myGroup);

        if (wasVisible && !isVisibleNow) {
          // 가상 DELETE — 나에게 더 이상 보이지 않음
          ctx.queryClient.invalidateQueries({ queryKey: ['trips', 'list'] });
          ctx.queryClient.setQueryData(
            ['trips', 'detail', newRow.id],
            { __unavailable: true }
          );
        } else if (isVisibleNow) {
          // 일반 UPDATE — 상세/목록 refetch
          ctx.queryClient.invalidateQueries({ queryKey: ['trips', 'list'] });
          ctx.queryClient.invalidateQueries({ queryKey: ['trips', 'detail', newRow.id] });
        }
        // wasVisible=false && isVisibleNow=false: Partner 에게 RLS 상 visible 아닌 event — 무시
      }
    )
    // INSERT, DELETE 도 같은 패턴
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trips' }, () => {
      ctx.queryClient.invalidateQueries({ queryKey: ['trips', 'list'] });
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'trips' }, (payload) => {
      const oldRow = payload.old as { id: string };
      ctx.queryClient.invalidateQueries({ queryKey: ['trips', 'list'] });
      ctx.queryClient.setQueryData(['trips', 'detail', oldRow.id], { __unavailable: true });
    })
    .subscribe();
}
```

**Patch PP — `__unavailable` 센티넬 패턴:**
- `queryClient.setQueryData(key, { __unavailable: true })` 로 detail 캐시에 플래그 주입
- `/trips/[id]/page.tsx` 는 `data.__unavailable` 이 true 면 `<TripUnavailable />` 렌더
- 이 패턴은 Phase 2 의 PGRST116(row not found) 처리 경로를 재사용 — 컴포넌트 레벨 변경 불필요

**Patch QQ — `currentGroupId` 의 실시간성 보장:**
- `subscribeTripsChannel` 의 context 는 구독 시점 snapshot. 내가 그룹에 막 들어왔거나 해제된 직후라면 stale
- 해결: `useRealtimeGateway` 내부에서 `useProfile` + `useMyGroup` 을 의존성으로, 변경 시 `removeChannel` → re-subscribe
- 또는 handler 가 매번 `queryClient.getQueryData(['profile','me'])` 에서 최신 group_id 조회 (권장 — re-subscribe 비용 회피)

**Patch RR — share-toggle ON 재전환:**
- Owner 가 OFF → ON 으로 복원하면 Partner 에게 UPDATE 이벤트 송신, `isVisibleNow=true` → detail 캐시 정상 refetch → `<TripUnavailable />` 해제
- 별도 처리 불필요

### 9.6 테스트 검증 (Integration + E2E)

**Integration (`tests/integration/realtime-visibility.spec.ts`):**
- Alice 가 trip 생성 + group 공유 → Bob 세션으로 list 에서 보임
- Alice share-toggle OFF → Bob 의 postgres_changes listener 에 UPDATE 수신, payload.old.group_id != null
- 어려움: node 환경에서 WebSocket subscription + 서버 triggering. Supabase CLI 로 로컬 실행 필요
- 또는 pg_publication_tables + REPLICA IDENTITY 설정만 SQL 쿼리로 검증 (간접):
  ```sql
  select relreplident from pg_class where oid = 'public.trips'::regclass;
  -- expected: 'f' (FULL)
  ```

**E2E (`share-toggle.spec.ts`):**
- 2-browser context (alice, bob)
- Alice create trip (group 공유) → Bob list 5초 내 등장
- Alice manage 탭 → share OFF → Bob list 5초 내 해당 trip 사라짐
- Bob 이 원래 보고 있던 `/trips/{id}` URL → 5초 내 TripUnavailable 로 전환 (no reload)
- Phase 2 의 manual QA 를 자동화

### 9.7 확장 지점

- **group_members**: owner 가 dissolve → trigger 가 trips.group_id → NULL 전파 (Phase 2 이미 구현) + group_members DELETE 이벤트. Partner 는 DELETE 이벤트에서 본인 row 인지 판정 후 state 전환. REPLICA IDENTITY FULL 불필요 (DELETE 의 old 는 기본적으로 PK 포함, 그리고 group_members 의 PK 는 단독 `id` 이므로 추가 필드가 필요하면 FULL 전환 검토)
- **schedule_items (Phase 3 이후)**: 일정 이동 시 UPDATE 의 old.trip_day_id 필요 → **FULL 전환 필요할 수 있음**. Phase 3 Task 에서 확정.

### 9.8 비용 관찰

- WAL 크기: trips 의 update 빈도 낮음 (edit-trip + share-toggle 정도) → WAL 증가 1KB 이하/event
- 수용 범위. Phase 8 PWA 시나리오에서 모바일 대역폭 영향 재검토.

---

## 10. Pre-flight · Tests · Risks · Exit

### 10.1 Pre-flight (Phase 3 Task 0)

Phase 2 완료 전제. **신규 확인:**

| 항목 | 상태 | 작업 |
|---|---|---|
| NCP 계정 + Maps API 활성화 | 사용자 준비됨 | 콘솔에서 Web Dynamic Map + 좌표변환 활성화, `localhost:3000` + Vercel 도메인 등록, Client ID 발급 |
| Naver 지역검색 앱 등록 | 사용자 | developers.naver.com → 애플리케이션 등록 → 지역검색 API 선택 → Client ID/Secret |
| Google Cloud 프로젝트 + Maps API | 사용자 | Maps JavaScript API + Places API (New) 활성화, API 키 2개 (referrer 제한 public / IP 제한 server) |
| `.env.local` / `.env.example` 에 5개 키 반영 | 개발자 | 기존 4개 + Maps 5개 |
| `@dnd-kit/core`, `@dnd-kit/sortable` 패키지 설치 | 개발자 | `pnpm add @dnd-kit/core @dnd-kit/sortable`. Next.js 16 / React 19 호환 smoke 테스트 |
| Playwright `tests/e2e/.auth/` gitignore | 개발자 | `.gitignore` 추가 |
| `supabase/seed/test.sql` — `test_truncate_cascade` RPC + dev signin route 구성 | 개발자 | 8.4 / 8.7 참조 |
| `ALLOW_TEST_SIGNIN`, `TEST_SECRET` 환경변수 | 개발자 | CI secret + 로컬 `.env.test` |

### 10.2 Mock vs Real-DB Scope (Phase 3 종료 시점)

| 항목 | 상태 |
|---|---|
| `auth.users`, `public.profiles` | ✅ 실 DB (Phase 1) |
| `public.groups`, `group_members` | ✅ 실 DB (Phase 2) |
| `public.trips`, `trip_days` | ✅ 실 DB (Phase 2, REPLICA IDENTITY FULL 업그레이드 Phase 3) |
| **`public.schedule_items`** | ✅ 실 DB (Phase 3 신규) |
| `expenses`, `todos`, `records`, `guest_shares`, `categories` | ⚠️ mock (Phase 4~6) |
| `/trips/[id]` 일정 탭 | ✅ 실 DB |
| `/trips/[id]` 경비/Todo/기록 탭 | ⚠️ mock + 배너 유지 |
| Realtime: trips/group_members/groups/**schedule_items** | ✅ 4 채널 |

### 10.3 Test Strategy

#### Unit (vitest, jsdom)

| 파일 | 시나리오 |
|---|---|
| `tests/unit/sort-order.test.ts` | `applyLocalReorder(state, dayId, orderedIds)` 의 pure fn 검증 — 입력 일관성 / 인덱스 경계 / 중복 거부 |
| `tests/unit/apply-local-move.test.ts` | `applyLocalMove(state, itemId, targetDayId, targetPos)` pure fn — source/target renumber |
| `tests/unit/coordinate-clamp.test.ts` | lat [-90,90] / lng [-180,180] validator |
| `tests/unit/url-scheme.test.ts` | zod url schema — `https://` / `http://` allow, `javascript:` 거부 |
| `tests/unit/tm128-wgs84.test.ts` | Naver TM128 변환 — 서울역(TM128 308815,552989) ↔ WGS84(37.5547,126.9707) 등 5 known points |
| `tests/unit/provider-selector.test.ts` | `providerForTrip(true)==='naver'`, `false==='google'` |
| `tests/unit/strip-html-tags.test.ts` | Naver `<b>강조</b>` 제거, `<script>` 제거, plaintext 유지 |

**Coverage threshold:** `lib/maps/`, `lib/schedule/` ≥ 80% lines/functions/branches.

#### Integration (`vitest.integration.config.ts`, 실 Supabase)

| Spec | 시나리오 |
|---|---|
| `rls-schedule-items.spec.ts` | owner CRUD / member CRUD / stranger 403 / trip_day_id 변조 시도 차단 / `can_access_trip` 재사용 검증 |
| `reorder-schedule-items-in-day.spec.ts` | 정상 reorder / `item_set_mismatch` / `item_not_in_day` / `duplicate_item_ids` / 빈 day 호출 |
| `move-schedule-item-across-days.spec.ts` | 정상 cross-day / `use_reorder_for_same_day` / `cannot_move_across_trips` / `invalid_target_position` (0, count+2) / source/target 재번호 정확성 |
| `resize-trip-days-v2.spec.ts` | §4.4 의 10 케이스 전부 |
| `create-schedule-item.spec.ts` | 정상 / title 101자 거부 / place 원자성 반쪽 거부 / `place_provider_mismatch` (Naver provider on overseas trip) / time_of_day 포맷 |
| `update-schedule-item.spec.ts` | 장소 추가/제거 / title 편집 / provider mismatch on update |
| `realtime-publication-audit.spec.ts` | `query_publication_tables()` 결과에 `schedule_items` 있음 + `profiles` 없음 유지 |
| `replica-identity-audit.spec.ts` | `select relreplident from pg_class where oid='public.trips'::regclass` → `'f'` (FULL) |
| `share-toggle-realtime.spec.ts` | Alice toggle OFF → Bob 의 subscribe 핸들러가 `old.group_id != null` 수신 확인 (local Supabase + WebSocket client) |
| `place-search-rate-limit.spec.ts` | 30건 초과 요청 시 429 응답 |

#### E2E (Playwright, 실 Supabase + next dev)

| Spec | 시나리오 |
|---|---|
| `schedule-crud.spec.ts` | 일정 생성 (장소 있음/없음) / 편집 / 삭제 / 탭 새로고침 후 persist |
| `drag-same-day.spec.ts` | 같은 day 내 3→1 위치 이동 + Realtime 미수신 확인 (자기 변경은 invalidate 만) |
| `drag-cross-day.spec.ts` | Day1 → Day3 이동 + Day Tab auto-switch + 양 day 재번호 |
| `partner-realtime.spec.ts` | Phase 2 설계대로 — Alice create → Bob list 5초 내 등장 |
| `share-toggle.spec.ts` | Alice OFF → Bob list 5초 내 사라짐 + 열린 detail 이 TripUnavailable 로 전환 (§9 검증) |
| `resize-with-items.spec.ts` | Alice Day 4→2 축소, Day 3/4 items 3개씩 → 확인 다이얼로그 → Day 2 에 items 합쳐진 채 6개 + sort_order 1~6 |
| `place-search.spec.ts` | 국내 trip: "성수동 카페" Naver 검색 → 결과 tap → place 필드 채워짐 / 해외 trip: "Ichiran Ramen" Google → 동일 |
| `login.spec.ts` (기존) | Google 버튼 렌더만 검증 (CI 에선 `test.skip` 또는 smoke only) |

#### Verification SQL

```sql
-- (1) schedule_items 정책 목록
select policyname from pg_policies
  where tablename = 'schedule_items' order by policyname;

-- (2) schedule_items CHECK 제약
select conname from pg_constraint
  where conrelid='public.schedule_items'::regclass and contype='c'
  order by conname;
-- Expected: title/place_name/place_address/memo/url/place_external_id length,
--           lat/lng range, place_provider check, place_atomic

-- (3) Realtime publication (schedule_items 포함)
select * from public.query_publication_tables() order by tablename;
-- Expected: group_members, groups, schedule_items, trips

-- (4) REPLICA IDENTITY FULL on trips
select relreplident from pg_class where oid = 'public.trips'::regclass;
-- Expected: 'f'

-- (5) 신규 함수 privilege
select p.proname, array_agg(distinct r.grantee) as grantees
  from information_schema.routine_privileges r
  join pg_proc p on p.proname = r.routine_name
  where r.routine_schema='public' and p.proname in
    ('create_schedule_item','update_schedule_item','delete_schedule_item',
     'reorder_schedule_items_in_day','move_schedule_item_across_days',
     'test_truncate_cascade')
  group by p.proname;
-- Expected: 모든 RPC grantees = {authenticated}, test_truncate_cascade = {service_role}
```

### 10.4 Risks

| ID | Sev | 리스크 | 대응 |
|---|---|---|---|
| R1 | High | `@dnd-kit` + Next.js 16 / React 19 호환성 리그레션 | Pre-flight Task 0 smoke 테스트. 불호환 시 `react-beautiful-dnd` (maintenance mode) 대신 `dnd-kit` fork 또는 자체 long-press 구현 |
| R2 | High | Naver TM128 변환 정확도 — edge case (섬·국경) | `proj4` 라이브러리 사용 + 5 known points unit test. 불일치 시 inline 공식 (Naver 공식 가이드) 로 fallback |
| R3 | High | service_role key 가 CI 외 누출 | `.env.test` gitignore, `test-sign-in` route 의 3중 guard (NODE_ENV + env flag + X-Test-Secret). production 배포 시 `ALLOW_TEST_SIGNIN != true` 검증 |
| R4 | Med | REPLICA IDENTITY FULL 이 trips UPDATE WAL 증가 | trips 는 저빈도 테이블. schedule_items 같은 고빈도 테이블은 케이스별 결정 — Phase 3 Task 에서 drag UPDATE 의 old 정보 필요 여부 분석 후 결정 |
| R5 | Med | Google Places API 쿼터 — $200 크레딧 over | FieldMask 로 최소 필드, rate limit 30/min/user. 접근 로그 관찰. 초과 시 cache-aside (동일 query 1시간 캐시) 도입 |
| R6 | Med | CSP `style-src 'unsafe-inline'` 로 XSS 방어 약화 | 현재 텍스트 입력만 있음 + DOMPurify 등 필요 시점에 도입. Phase 8 에서 Google Maps SDK nonce 지원 여부 재조사 |
| R7 | Med | SDK lazy load 가 E2E 에서 flaky | `page.waitForFunction(() => !!window.naver || !!window.google)` 명시적 대기. `page.route` 로 SDK 응답 stub 도입 검토 |
| R8 | Med | 드래그 중 realtime invalidate 유예 race — 드래그 종료 직전 새 item 생성됨 | last-write-wins 수용. 드래그 종료 후 pending flush. 피해 시나리오는 "내가 드래그 하는 동안 파트너가 같은 day 에 item 추가 → 내 drag 결과가 파트너의 item 을 밀어냄". 일반적으로 허용 |
| R9 | Low | NCP 도메인 등록에 Vercel preview URL pattern 미지원 | Naver Maps 는 wildcard 도메인 등록 가능 여부 확인. 없으면 production URL 만 등록 + preview 에서는 localhost 로 테스트 |
| R10 | Low | `@dnd-kit` a11y 의 스크린리더 한국어 메시지 누락 | Phase 8 i18n 에서 override. Phase 3 은 기본 영문 |

### 10.5 Phase 3 Exit Criteria

#### A. 자동 검증 (CI gate)

1. `pnpm build` — TypeScript 0 에러 (`types/database.ts` 포함 schedule_items 타입 재생성)
2. `pnpm test` unit — pass, coverage threshold 통과
3. `pnpm test:integration` — 모든 spec pass. race 루프 20회 deterministic
4. `pnpm exec playwright test` — 8 E2E pass, flaky 허용 0 (login.spec 의 Google smoke 는 skip)
5. `pnpm audit --production` — high/critical 0
6. `pnpm lint` — 0 error. `no-restricted-imports` (lib/mocks/factory) 유지
7. Verification SQL 5 쿼리 예상 결과 매칭
8. `types/database.ts` 최신 (schedule_items 포함)

#### B. 수동 검증 (실 Google 계정 2개)

| # | 시나리오 | 기대 |
|---|---|---|
| 1 | Alice 국내 trip 일정 탭 진입 | Naver 지도 lazy load, 중앙 서울 fallback |
| 2 | 일정 생성 with 장소 검색 (Naver) | BottomSheet 검색 → 선택 → place 필드 채워짐, 마커 "1" 번 표시 |
| 3 | 일정 3개 생성 후 같은 day drag (3→1) | optimistic 즉시 반영, 서버 confirm 후 persist, Bob 5초 내 갱신 |
| 4 | Day1 → Day2 cross-day drag | Day Tab auto-switch, 양 day 재번호, Bob 반영 |
| 5 | Alice share-toggle OFF (Manage 탭) | Bob `/trips` 에서 즉시 사라짐, 열린 detail → TripUnavailable |
| 6 | 해외 trip Google 검색 ("Ichiran") | Google 지도 lazy load, 검색 결과 tap → place 저장 |
| 7 | Day 4→2 축소 with 일정 | 확인 다이얼로그 "일정 N개가 이동돼요", confirm 후 Day 2 에 합쳐짐 |
| 8 | DevTools Console + Network | CSP violation 0, SDK script 2종 (선택된 provider 만) 로드, realtime WebSocket 활성 |

#### C. 문서 산출물

- [x] `docs/specs/2026-04-20-phase3-schedule-map-design.md` — 이 설계 문서
- [ ] `docs/plans/2026-04-20-phase3-schedule-map.md` — Implementation Plan (writing-plans)
- [ ] `docs/qa/phase3-e2e-manual-checklist.md` — 수동 검증 체크리스트
- [ ] ADR-009 이행 로그 (NCP/Google 실 계정 셋업 기록) — `docs/decisions/009-map-setup-log.md` 또는 plan 안에
- [ ] Phase 3 retrospective — plan 끝에 append
- [ ] Git tag `phase-3-schedule-map` + origin push

---

## 11. Phase 4 Handoff

Phase 3 이 Phase 4 에 남기는 확장 지점:

| 영역 | Phase 4 작업 |
|---|---|
| `categories` 테이블 + `schedule_items.category_id` FK | Phase 4 마이그레이션에서 ADD COLUMN |
| `expenses.schedule_item_id` FK | Phase 4 expenses 테이블 생성 시 정의 |
| `<ScheduleItemCard />` ⋮ 메뉴의 "경비 추가" 항목 | Phase 4 에서 1줄 추가 |
| `<ScheduleItemModal />` 의 연결된 경비 리스트 섹션 | Phase 4 에서 conditional render |
| `on_group_dissolved` 트리거 확장 | Phase 2 trigger body 에 `categories.group_id → null` 추가 |
| Realtime publication | `expenses`, `categories` 추가 |
| Provider 인터페이스 | 그대로 재사용. `places_autocomplete` 추가 확장 후보 |

---

## 참고 문서

- 현행 전체 스펙: `docs/specs/2026-04-20-travel-manager-design-updated.md`
- Phase 2 Design: `docs/specs/2026-04-19-phase2-trip-core-design.md`
- ADR-009 Dual Map Provider: `~/.MY_AI_WIKI/projects/travel-manager/decisions/009-map-api-naver-google-dual.md`
- Phase 2 Plan (resize baseline): `docs/plans/2026-04-19-phase2-trip-core.md`
- Phase 2 Manual E2E: `docs/qa/phase2-e2e-manual-checklist.md`
