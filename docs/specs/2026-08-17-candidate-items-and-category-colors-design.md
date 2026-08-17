---
type: spec
date: 2026-08-17
author: sohyun + Claude
status: approved-design
---

# 일정 후보(플랜 B) + 카페 카테고리 + 카테고리 색 마커 설계

## 1. 배경과 목적

- 일정을 등록할 때 바로 본 일정 번호에 넣지 않고 **"후보"로 등록**할 수 있게 한다.
- 후보는 두 가지 용도를 가진다:
  1. **플랜 B** — 주 일정을 못 하게 됐을 때 대체할 그 날의 예비 일정
  2. **보관함** — 실제 수행하지 못한 일정이나, 다음에 이 여행지를 다시 왔을 때 고려할 장소
- 카테고리에 **카페**를 추가한다 (현재는 식당만 있음).
- 지도 마커 번호를 **카테고리 색**으로 표시해 한눈에 구분되게 한다.

## 2. 확정된 요구사항 (사용자 결정 사항)

| 항목 | 결정 |
|---|---|
| 후보 소속 | **혼합** — 일자 화면에서 등록 시 "후보로 등록" 체크 → 그 일자의 후보. 일자 탭과 동일 레벨의 **"후보" 탭**에서 등록 → 여행 전체 풀 후보 |
| 후보 탭 역할 | 전체 풀 후보 + **각 일자별 후보를 한번에 모아보기** (집계 뷰) |
| Day 지도의 후보 범위 | "후보 보기" 토글 ON 시 **현재 일자 후보만** 추가 표시 |
| 후보 마커 스타일 | **속이 빈 스타일** — 흰 바탕 + 카테고리 색 점선 테두리 + 카테고리 색 숫자 |
| 후보 번호 | 후보도 번호를 가진다. 본 일정 번호와 **별도 시퀀스** (본 1..N, 후보 1..M) |
| 카페 색 | 로즈핑크 `#e08cab` |
| 식당 색 | 브라운 `#a5673f`로 변경 (가장 많이 쓰는 카테고리라 눈에 띄게) |
| 쇼핑 색 | 머스터드 옐로우 `#e0b64f`로 변경 |
| 여행 기간 축소 시 삭제일의 일자 후보 | **풀 후보로 이동** (본 일정은 현행대로 마지막 유지일 끝으로) |
| 풀 후보 드래그 정렬 | **V1 제외** — 등록순 고정 표시, 필요 시 추후 추가 |
| 후보 탭 지도의 번호 중복 | 그룹별 번호 유지(풀 1..K, Day별 1..M). **마커 탭 시 소속 표시**(예: "Day 2 후보 3번" / "전체 풀 후보")로 구분 |

## 3. 데이터 모델 (마이그레이션 `0023_candidate_items.sql`)

`schedule_items` 테이블 확장 (별도 테이블을 만들지 않는다 — 장소검색·수정 모달·realtime·RLS 재사용, 승격/강등 시 메모·URL·장소정보 보존):

```sql
alter table public.schedule_items
  add column is_candidate boolean not null default false,
  add column trip_id uuid references public.trips(id) on delete cascade;

-- 기존 행 백필: trip_day_id → trip_days.trip_id
-- 이후 trip_id not null 설정

alter table public.schedule_items
  alter column trip_day_id drop not null;

-- 제약: 일자가 없는 행은 반드시 전체 풀 후보
alter table public.schedule_items
  add constraint schedule_items_dayless_is_candidate
  check (trip_day_id is not null or is_candidate);
```

- **전체 풀 후보** = `trip_day_id is null and is_candidate = true`
- **일자 후보** = `trip_day_id = <day> and is_candidate = true`
- **본 일정** = `trip_day_id = <day> and is_candidate = false`

### sort_order 파티션

`sort_order`는 파티션별 독립 시퀀스로 관리한다. 표시 번호는 저장하지 않고 파티션 내 배열 인덱스(1-based)로 계산한다 (현행 방식 유지).

| 파티션 | 키 |
|---|---|
| 본 일정 | `(trip_day_id, is_candidate=false)` |
| 일자 후보 | `(trip_day_id, is_candidate=true)` |
| 풀 후보 | `(trip_id, trip_day_id is null)` |

### trip_id 정합성 (denormalization 보호)

`trip_id`는 비정규화 컬럼이므로 `trip_day_id`가 있는 행에서 두 값이 어긋나지 않도록 강제한다:

```sql
-- trip_days(id, trip_id) 복합 unique 인덱스 후 복합 FK
create unique index trip_days_id_trip_id_key on public.trip_days(id, trip_id);
alter table public.schedule_items
  add constraint schedule_items_day_trip_consistent
  foreign key (trip_day_id, trip_id) references public.trip_days(id, trip_id);
```

### RLS

- 기존 정책은 `trip_days` 경유로만 소유권을 판정하므로 `trip_day_id is null`인 행이 판정 불가.
- **단순 OR 추가는 금지**: `day경유 OR can_access_trip(trip_id)` 형태면 "남의 trip_day_id + 내 trip_id"로 남의 일정에 행을 삽입할 수 있는 구멍이 생긴다.
- **조건부 판정**으로 교체한다:
  - `trip_day_id is not null` → 현행대로 `trip_days` 경유 판정만
  - `trip_day_id is null` → `can_access_trip(trip_id)` 판정
- 위 복합 FK가 day-있는 행의 `trip_id` 위조를 막아주므로 두 경로가 정합.

## 4. RPC 변경 (같은 마이그레이션)

기존 RPC는 positional 시그니처 + grant 블록이 명시되어 있으므로 (`0021` 참조) 교체 + grant 갱신으로 처리한다.
**시그니처가 바뀌는 함수는 구 오버로드를 반드시 drop 한다** — 구·신 오버로드가 공존하면 클라이언트가
신규 인자를 생략한 named-args 호출 시 PostgREST 오버로드 모호성 에러(300)가 난다.
(현재도 `create_schedule_item` 11-param(0006)·13-param(0021)이 공존 중 — 0023에서 함께 정리.)

### 공통 원칙: 파티션 인식 재번호

`sort_order` 재번호(renumber)가 있는 **모든 지점**은 파티션 단위로 동작해야 한다.
현행 재번호 쿼리는 전부 `where trip_day_id = <day>` 전체를 하나의 시퀀스로 압축하므로,
그대로 두면 본·후보가 한 시퀀스로 섞인다. 대상: `delete_schedule_item`,
`delete_schedule_items`(bulk), `move_schedule_item_across_days`, `move_schedule_items_to_day`,
`reorder_schedule_items_in_day`, `resize_trip_days`, 신규 `set_schedule_item_candidacy`.
재번호 조건은 `(trip_day_id, is_candidate)` 또는 풀이면 `(trip_id, trip_day_id is null)`.

### 공통 원칙: dayless 행 소유권 판정

현행 update/delete/move RPC는 `trip_day_id`를 조회해 null이면 `schedule_item_not_found`를 던지고,
`is_domestic`·소유권을 day 경유로 판정한다. 풀 후보(`trip_day_id is null`)를 다루는 모든 RPC는
**존재 판정을 행 존재 여부로, 소유권·`is_domestic` 조회를 `trip_id` 직접 경유로** 바꾼다.

| RPC | 변경 |
|---|---|
| `create_schedule_item` | `p_is_candidate boolean default false`, `p_trip_id uuid default null` 추가 (구 오버로드 drop). `p_trip_day_id`가 null이면 풀 후보로 생성 — 이때 `p_is_candidate=false`면 에러(`dayless_must_be_candidate`), `is_domestic`은 `p_trip_id` 경유 조회. day가 있으면 `trip_id`는 day에서 파생해 항상 저장. `max(sort_order)+1`은 해당 파티션 내에서 계산 |
| `update_schedule_item` | **변경 필요** — dayless 행 대응(위 공통 원칙). 후보 여부 전환은 전용 RPC |
| `delete_schedule_item` / `delete_schedule_items` | **변경 필요** — dayless 행 대응(bulk는 `trip_days` inner join 제거) + 파티션 인식 재번호 |
| `reorder_schedule_items_in_day` | 시그니처 유지. 전달된 아이템들의 `is_candidate` 플래그로 파티션 판정(본·후보 혼합 입력은 에러), 개수 검증(`item_set_mismatch`)도 **그 파티션의 개수**와 비교. 풀 후보 재정렬은 V1 미지원(시그니처상 불가, 클라이언트에서 노출 안 함) |
| `move_schedule_item_across_days` / `move_schedule_items_to_day` | **본 일정 전용 유지**. 입력에 후보가 포함되면 에러(`candidate_not_movable_here`) — 후보 이동은 아래 전용 RPC. 재번호는 파티션 인식으로 수정 |
| **신규** `set_schedule_item_candidacy(p_item_id uuid, p_is_candidate boolean, p_target_day_id uuid default null)` | **"대상 파티션으로 이동" 단일 RPC** — 승격·강등·후보 간 이동·풀 이동을 모두 담당. 규칙: ① `p_is_candidate=false`면 `p_target_day_id` 필수 → 그 일자 본 일정 끝 (승격) ② `p_is_candidate=true` + day → 그 일자 후보 끝 (강등·후보 일자 이동) ③ `p_is_candidate=true` + day null → 풀 끝 (풀 이동, 본→풀 직행도 허용) ④ 이미 대상 파티션에 있으면 **no-op(멱등)**. 원 파티션은 재압축 |
| `resize_trip_days` | 기간 축소 시: 삭제일의 **본 일정**은 현행대로 마지막 유지일 본 일정 끝으로(파티션 인식 재번호로 수정), 삭제일의 **일자 후보는 풀 후보로 이동**(`trip_day_id → null`, 풀 끝에 append) |
| `get_guest_trip_data` | `is_candidate = false` 필터 추가 — **게스트 공유 뷰에서 후보 제외** (V1). 풀 후보는 day 순회 구조상 자연 제외 |

## 5. 카테고리 '카페' + 색 변경

### 카페 추가

- 마이그레이션은 **기존 DB 기준 update + insert**: 기존 행 sort_order 재조정 update(숙소 4→5, 쇼핑 5→6, 기타 6→7) 후 `('cafe', '카페', 'bg-accent-rose', 4)` insert — 식당 바로 다음 정렬.
- 카페는 식당과 동일하게 **장소검색 플로우** — 모달 분기가 `code === "other" ? other_form : place_search`이므로 **코드 변경 불필요** (자동 적용).
- 지출 카테고리 매핑: `cafe → food` (`lib/schedule/category-map.ts`).
- 동기화 지점 4곳 모두 갱신: DB seed / `ScheduleCategory` 유니온(`lib/types.ts`) / `components/ui/schedule-item.tsx` 색상·라벨 맵 / `components/schedule/schedule-item-modal.tsx` 피커 맵.

### 최종 색상 팔레트

| 카테고리 | 색 | hex | 토큰 |
|---|---|---|---|
| 교통 | 파랑 (유지) | `#9fbbe0` | `bg-ti-read` |
| 관광 | 초록 (유지) | `#9fc9a2` | `bg-ti-grep` |
| 식당 | **브라운 (변경)** | `#a5673f` | 신규 `--color-accent-brown` |
| 카페 | **로즈핑크 (신규)** | `#e08cab` | 신규 `--color-accent-rose` |
| 숙소 | 보라 (유지) | `#c0a8dd` | `bg-ti-edit` |
| 쇼핑 | **머스터드 옐로우 (변경)** | `#e0b64f` | 신규 `--color-accent-yellow` |
| 기타 | 회색 (유지) | `rgba(38,37,30,0.2)` | `bg-ink-400` |

- 신규 토큰은 `app/globals.css`에 추가. 식당/쇼핑의 `categories.color_token` seed 값도 마이그레이션에서 update.
- 기존 `bg-ti-thinking`(피치), `bg-accent-gold`(골드)는 다른 곳에서 쓰일 수 있으므로 토큰 자체는 유지하고 카테고리 매핑만 바꾼다.

## 6. 지도 마커

### 카테고리 색 단일 소스

- `lib/maps/marker-colors.ts` 신설: `Record<ScheduleCategory, { fill: string; text: "light" | "dark" }>` — 카테고리 → hex 매핑의 코드 레벨 단일 소스.
- **밝은 배경(쇼핑 옐로우 등)은 `text: "dark"`** 로 지정해 숫자를 진한 잉크색으로 렌더 — 명도 기반 규칙을 데이터로 명시.

### MarkerSpec 확장 (`lib/maps/types.ts`)

```ts
interface MarkerSpec {
  lat: number; lng: number; label: string;
  color: string;                    // 카테고리 hex
  textColor: string;                // cream 또는 ink
  variant: "main" | "candidate";
  onClick?: () => void;
}
```

### 렌더링 (Naver `renderMarkerHtml` / Google `renderPinElement` 동일 규칙)

- **본 일정(main)**: 카테고리 색으로 채운 원형 배지 + textColor 숫자 + 흰 테두리 (현행 형태에서 색만 변경)
- **후보(candidate)**: 흰(크림) 바탕 + 카테고리 색 **점선 테두리** + 카테고리 색 숫자

### 표시 범위

- **Day 탭 지도**: 본 일정 마커(카테고리 색, 1..N) 기본 표시. 지도 패널에 **"후보 보기" 토글** (기본 OFF) → ON 시 현재 일자 후보(1..M, hollow) 추가 표시. 토글 상태는 URL 쿼리(`?candidates=1`, 기존 `?map=open` 패턴과 동일).
- **후보 탭 지도**: 전체 풀 후보 + 모든 일자 후보 표시 (모아보기와 일치). 본 일정은 표시하지 않는다.
- Day 지도에서 본 일정 번호와 후보 번호가 같은 숫자일 수 있으나(본 3, 후보 3) 스타일(채움 vs hollow)로 구분된다.
- 후보 탭 지도에서는 그룹별 번호(풀 1..K, Day별 1..M)가 겹칠 수 있다 — 번호는 그대로 두고 **마커 탭 시 소속을 표시**한다 (예: "Day 2 후보 3" / "전체 풀 후보 1", `MarkerSpec.onClick` 활용).

## 7. 목록 UI

### 일자 탭 바 (`day-tab-bar.tsx`)

- 마지막에 **"후보" 탭** 추가. Day 탭과 동일 레벨, 시각적으로 구분(예: 점선 테두리 또는 아이콘).

### Day 화면 (`schedule-tab.tsx`)

- 본 일정 리스트 아래 **접이식 "후보 (M)" 섹션**. 접힘 상태 기본, 후보가 0개면 섹션 숨김.
- 후보 행: 속이 빈 번호 배지(카테고리 색 테두리+숫자, 1..M), 드래그로 후보 내 순서 변경 (본 일정 리스트와 별도 `SortableContext`).

### 후보 탭 화면 (신규 컴포넌트)

- 구성: ① **전체 풀 후보** 섹션 → ② **Day 1..N 일자별 후보** 그룹 (해당 일자에 후보가 있는 날만 표시).
- 여기서 FAB(+)로 등록하면 풀 후보로 생성.
- **풀 후보 섹션은 드래그 정렬 없음** (V1) — 등록순 고정. 일자별 후보 그룹의 정렬은 Day 화면에서.
- 지도 열기 시 모든 후보 표시 (§6).

### 등록 모달 (`schedule-item-modal.tsx`)

- Day 컨텍스트에서 열면 **"후보로 등록" 체크박스** 추가 (기본 해제). 체크 시 그 일자의 후보로 생성.
- 후보 탭에서 열면 체크박스 없이 자동으로 풀 후보.
- 숙소 다중일 범위 생성(`create_lodging_schedule_items_for_range`)은 후보와 조합하지 않는다 — 후보로 등록 체크 시 범위 UI 비활성.

### 전환 액션 (항목 편집/롱프레스 메뉴)

| 액션 | 동작 |
|---|---|
| 본 일정 → **"후보로 빼기"** | 같은 일자의 후보 끝으로 이동 (못 간 일정 보관) — `set_schedule_item_candidacy(true, 같은 day)` |
| 후보 → **"일정으로 승격"** | 일자 선택 시트 → 그 날 본 일정 끝에 추가 (플랜 B 투입) — `set_schedule_item_candidacy(false, day)` |
| 후보 간 이동 | 일자 후보 ↔ 다른 일자 ↔ 풀 — 항목 단위 액션, 일자 선택 시트에 "전체 후보" 대상 추가. 전부 `set_schedule_item_candidacy` 사용 |
| 다중 선택 이동 | **본 일정 전용 유지** — 선택에 후보가 포함되면 이동 액션 비활성 (RPC도 에러로 방어) |

### 데이터 조회·낙관적 업데이트 (클라이언트 변경)

- `lib/schedule/use-schedule-list.ts`: 현재 `trip_days!inner` 조인으로 tripId 필터 → 풀 후보(`trip_day_id null`)가 결과에서 탈락한다. 신규 `trip_id` 컬럼으로 `.eq("trip_id", tripId)` 직접 필터로 교체 (조인 제거, 단순화).
- `apply-local-reorder/move/bulk-move.ts`(낙관적 업데이트 헬퍼): RPC의 파티션 인식 재번호와 동일하게 파티션 단위로 동작하도록 수정 — 어긋나면 낙관 상태와 서버 상태가 diverge.
- `types/database.ts` 재생성 시 `trip_day_id`가 `string | null`이 되어 day 그룹핑 코드 전반에 타입 파급 — 구현 계획에서 작업량으로 산정.
- Realtime은 테이블 전체 구독 + coarse invalidation(`lib/realtime/schedule-channel.ts`)이라 변경 불필요.

## 8. 게스트 공유 뷰

- V1에서는 후보를 **노출하지 않는다** (`get_guest_trip_data`에서 필터). 공유 옵션(예: `show_candidates`)은 필요해지면 추후 추가.

## 9. 테스트 계획

- **유닛**: 카테고리 맵 7종(라벨·색·지출 매핑·모달 stage) 갱신 — `schedule-category-mapping.test.ts` 등 기존 회귀 가드 업데이트. `marker-colors` 결정 로직(밝은 배경 → dark text). 파티션별 번호 계산 로직. `apply-local-*` 낙관 헬퍼의 파티션 인식.
- **통합**: 풀/일자 후보 생성 RPC(불법 조합 `dayless + is_candidate=false` 에러 포함), `set_schedule_item_candidacy` 승격·강등·풀 이동·no-op 멱등(원 파티션 재압축 포함), 파티션별 reorder(개수 검증·혼합 입력 에러), move RPC 후보 포함 시 에러, **풀 후보의 update/삭제(단건·bulk)**, `resize_trip_days` 축소 시 일자 후보 → 풀 이동, 게스트 RPC 후보 제외, `cafe` FK insert, **RLS 교차 소유 insert 시도 차단**("남의 trip_day_id + 내 trip_id" 직접 insert가 거부되는지).
- **E2E**: 후보 등록 → Day 후보 섹션 표시 → 지도 후보 토글 → 승격 후 본 일정 번호 반영. 후보 탭 모아보기.

## 10. 구현 범위 밖 (명시적 제외)

- 게스트 공유에 후보 노출 옵션
- 후보에 대한 지출/할일 연동 특수 처리 (본 일정과 동일하게 동작)
- 여행 간 후보 복사 ("다음 여행으로 가져가기") — 풀 후보가 그 역할의 기반이 되지만 V1에서는 같은 여행 내에서만
