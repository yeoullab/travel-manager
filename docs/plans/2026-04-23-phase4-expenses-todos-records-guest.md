---
type: implementation-plan
phase: phase-4-expenses-todos-records-guest
project: travel-manager
date: 2026-04-23
depends-on:
  - docs/superpowers/specs/2026-04-16-travel-manager-design.md (원본 스펙 §4, §5, §6.5~§6.9)
  - docs/specs/2026-04-20-travel-manager-design-updated.md (현행화 스펙 §0, §4, §5)
  - supabase/migrations/0003_trips.sql (trips, trip_days, can_access_trip)
  - supabase/migrations/0005_schedule_items.sql (schedule_items — FK from expenses)
  - supabase/migrations/0008_categories.sql (categories — schedule-only)
author: claude-opus-4-7 (plan draft)
status: draft
---

# Phase 4 Plan — 경비 · Todo · 기록 · 게스트 공유

> **맥락 한 줄**: Phase 3 갭 분석(2026-04-21)에서 "초기 스펙 대비 9건 누락" 중 Phase 3 갭 복구(2026-04-22)로 4건만 복구됨. Phase 4 는 나머지 5건 + 연관 항목을 정리:
>
> 1. 경비 탭 실 DB 연결 + 일정↔경비 연동 (⋮ "경비 추가" + `expenses.schedule_item_id`)
> 2. Todo 탭 실 DB
> 3. 기록 탭 실 DB
> 4. 게스트 공유 `/share/[token]` SSR + `get_guest_trip_data` RPC + 관리 탭 링크 생성 UI
> 5. Realtime publication 확장 (expenses/todos/records)
>
> **Part B v1 폐기 재발 방지**: §0 레지스트리를 source verbatim 으로 빌드. 각 Task 집행 전 grep 재검증. RPC 호출 시그니처는 `\dt` / 마이그레이션 파일 직접 grep.

---

## § 0 스키마 · 코드 레지스트리 (drift 방지용 verbatim 인용)

**이 섹션은 plan 집행 중 RPC 호출·마이그레이션 작성 직전에 반드시 grep 재검증.**
[[memory/feedback_plan_writing.md]] · [[knowledge/patterns/plan-writing-requires-schema-registry-first]]

### §0.1 `trips` 현재 컬럼 (verbatim from 0003_trips.sql:6-23)

```sql
create table public.trips (
  id           uuid        primary key default gen_random_uuid(),
  group_id     uuid        references public.groups(id) on delete set null,
  created_by   uuid        not null references public.profiles(id),
  title        text        not null,
  destination  text        not null,
  start_date   date        not null,
  end_date     date        not null,
  is_domestic  boolean     not null default true,
  currencies   text[]      not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint trips_title_length        check (char_length(title) between 1 and 100),
  constraint trips_destination_length  check (char_length(destination) between 1 and 100),
  constraint trips_date_range          check (end_date >= start_date),
  constraint trips_duration_max        check (end_date - start_date <= 90),
  constraint trips_currencies_count    check (array_length(currencies, 1) is null or array_length(currencies, 1) <= 5)
);
```

### §0.2 Helper `can_access_trip(uuid)` (verbatim from 0003_trips.sql:31-57)

```sql
create or replace function public.can_access_trip(p_trip_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_created_by uuid;
  v_group_id   uuid;
begin
  if v_uid is null then return false; end if;
  select created_by, group_id into v_created_by, v_group_id
    from public.trips where id = p_trip_id;
  if v_created_by is null then return false; end if;
  if v_created_by = v_uid then return true; end if;
  if v_group_id is null then return false; end if;
  return exists (
    select 1 from public.group_members gm
    join public.groups g on g.id = gm.group_id
    where gm.user_id = v_uid and gm.group_id = v_group_id and g.status = 'active'
  );
end;
$$;
```

→ **Phase 4 의 모든 신규 테이블 (expenses, todos, records, guest_shares) RLS 에서 재사용.** 추가 helper 불필요.

### §0.3 `schedule_items` (verbatim from 0005_schedule_items.sql + 0008_categories.sql)

- PK: `id uuid`
- NOT NULL: `trip_day_id`, `title`, `sort_order`, `category_code` (default 'other')
- nullable: time/place/memo/url
- CHECK: `place_atomic` (place_name/lat/lng/provider 원자성), 길이 제약, provider `in ('naver','google')`
- FK: `trip_day_id → trip_days(id) on delete cascade`, `category_code → categories(code) on update cascade on delete restrict`
- Realtime: publication 포함 (0005:93)
- **Phase 4 관련**: `expenses.schedule_item_id` FK 의 참조 대상. `on delete set null` 로 연결.

### §0.4 `categories` — 현재는 schedule-only (verbatim from 0008_categories.sql)

```sql
create table public.categories (
  code        text        primary key,
  name        text        not null,
  color_token text        not null,
  sort_order  int         not null,
  created_at  timestamptz not null default now()
);
-- seed: transport/sightseeing/food/lodging/shopping/other (6종)
```

**중요한 결정 (ADR-011 후보)**: Phase 4 에서 `categories` 테이블을 expense 용으로 **확장하지 않는다.** 이유:
- 기존 `schedule_items.category_code` FK 를 깨뜨리지 않으려면 composite PK 또는 type 컬럼 추가가 필요한데 마이그레이션 복잡도 과다
- V1 expense 카테고리는 고정 6종으로 충분 (사용자 정의 불필요)
- 커스텀 카테고리 관리 UI 는 V2 로 이관

→ **`expenses.category_code`** 는 **string CHECK 제약만**으로 처리 (FK 아님). 코드 리스트는 스펙 §6.10 준수:
`"food" | "transport" | "lodging" | "shopping" | "activity" | "other"`

### §0.5 기존 hook 패턴 (verbatim from lib/schedule/use-create-schedule-item.ts)

```ts
export function useCreateScheduleItem() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateScheduleItemInput): Promise<string> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("create_schedule_item", {
        p_trip_day_id: input.tripDayId,
        p_title: input.title,
        /* ... */
        p_category_code: input.categoryCode,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_id, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.schedule.byTripId(vars.tripId) });
    },
  });
}
```

→ Phase 4 의 모든 CRUD hook 이 이 패턴을 따른다: `getBrowserClient()` + `useMutation` + `(supabase as any).rpc()` escape hatch + `onSuccess` invalidate.

### §0.6 `queryKeys` 현재 구조 (verbatim from lib/query/keys.ts)

```ts
export const queryKeys = {
  profile: { me, byId },
  tripMembers: { byTripId },
  trips: { all, list, detail },
  group: { me },
  tripDays: { byTripId },
  schedule: { byTripId },
} as const;
```

→ Phase 4 에서 추가:
- `expenses: { byTripId, summary (통화별 집계 파생) }`
- `todos: { byTripId }`
- `records: { byTripId }`
- `guest: { byTripId, byToken (SSR 전용 서버키 — 클라이언트 캐시 키 아님) }`

### §0.7 Realtime Gateway 패턴 (verbatim from lib/realtime/schedule-channel.ts — handleScheduleChange)

- 현재 채널 5개: trips / group_members / groups / schedule_items / (pending flush effect)
- 각 채널 핸들러는 `queryClient.invalidateQueries` 로 간단한 fanout
- Phase 4 에서 expenses/todos/records 각 채널을 **useRealtimeGateway(userId)** 에 동일 패턴으로 추가
- **guest_shares 는 Realtime 제외** — 관리 탭에서 owner 만 접근 + mutation 직후 invalidate 로 충분

### §0.8 Mock 함수 call sites (grep 로 확인 대상)

- `lib/mocks/` 에 `getExpensesByTripId` / `getTodosByTripId` / `getRecordsByTripId` / `getGuestShareByToken` / `aggregateExpensesByCurrency` 등 존재
- call sites:
  - `components/trip/expenses-tab.tsx:11` → `getExpensesByTripId`, `aggregateExpensesByCurrency`
  - `components/trip/todos-tab.tsx:10` → `getTodosByTripId`
  - `components/trip/records-tab.tsx:10` → `getRecordsByTripId`
  - `app/share/[token]/page.tsx:18-26` → mock 7개
- Task 17~19 (UI rewire) 전수 교체. `lib/mocks/factory.ts` 는 다음 리팩터 시점에 자연 소멸.

### §0.9 `components/ui/expense-row.tsx` 기존 prop 계약

- `category: ExpenseCategory` ⟵ 정확한 6개 union (`lib/types.ts:88-94`)
- `title / amount / currency / paidByName? / paidByChip? / memo?`
- → Phase 4 실 데이터와 매핑 시 필드명 주의: DB 는 snake_case, UI prop 은 camelCase. adapter fn 필요.

### §0.10 `TRIP_CURRENCIES` 상수 (verbatim from lib/trip/constants.ts:1)

```ts
export const TRIP_CURRENCIES = ["KRW", "JPY", "USD", "EUR", "CNY", "THB"] as const;
```

→ 경비 생성 폼의 currency 선택지. 국내 여행은 `"KRW"` 고정.

---

## § 1 스펙: 스코프 · UX 모델 · 이관 항목

### §1.1 In-scope (이 plan 범위)

| # | 기능 | 관련 스펙 | 세부 |
|---|------|-----------|------|
| 1 | `expenses` 테이블 + CRUD + 통화/카테고리/날짜별 집계 | 원본 §6.5, 현행 §4 | 통화 선택·결제자 칩·일정 연동 |
| 2 | `todos` 테이블 + CRUD + 완료 토글 + 담당자 | 원본 §6.6, 현행 §6.6 | 미완료 먼저 정렬 |
| 3 | `records` 테이블 + CRUD | 원본 §6.7, 현행 §6.7 | 텍스트 전용, 날짜 |
| 4 | `guest_shares` 테이블 + `/share/[token]` SSR + `get_guest_trip_data` RPC | 원본 §6.8, 현행 §6.9 | show_* 플래그, 만료, CTA |
| 5 | 관리 탭 게스트 링크 생성·비활성화·공개 항목 토글 UI | 원본 §6.8 | placeholder 배너 제거 |
| 6 | 일정↔경비 연동: ⋮ 메뉴 "경비 추가 바로가기" + `expenses.schedule_item_id` FK | 원본 §6.4, 현행 §5 "경비 탭 이관 후 자연 복귀" | schedule-item 삭제 시 expense 유지 |
| 7 | Realtime publication 확장 (expenses/todos/records) + gateway 채널 추가 | 현행 §2 (Phase 7 이관을 Phase 4 로 당김) | last-write-wins, 간단 invalidate |

### §1.2 Out-of-scope (명시적 이관)

| # | 기능 | 이관 대상 | 이유 |
|---|------|----------|------|
| A | 커스텀 카테고리 관리 UI (`/settings/categories`) + 그룹 fanout | V2 또는 Phase 5 후반 | V1 은 고정 6종 + 6종 seed 로 충분. 사용자 요구 검증 후 진행 |
| B | 환율 변환 | V2 | 스펙 §2 Out of Scope 명시 |
| C | 게스트 접근 로그 | V2 | 스펙 §2 V2 후보 |
| D | 사진/미디어 첨부 | V2+ | 스펙 §10 |
| E | 일정 탭 카테고리 필터 | 별도 이슈 | Phase 4 스코프 아님 |

### §1.3 UX 모델 — 주요 결정

**경비 탭:**
- 기존 목업 구조 유지 (통화별 총계 카드 + 카테고리 필터 칩 + 날짜별 그룹)
- 실 DB 로 교체, Phase 0 배너 제거
- FAB → BottomSheet 의 "저장" 버튼이 실제 INSERT 하도록 배선
- `expense_date` 기본값: 여행 기간 내라면 오늘, 아니면 `start_date`
- 통화: 국내(`is_domestic=true`) → KRW 고정 필드 (읽기 전용). 해외 → `trips.currencies` 배열 기반 select
- 결제자: `tripMembers` 기반 chip radiogroup. "공동" 옵션 (null) 기본값
- 카테고리: 6종 chip radiogroup (식비/교통/숙박/쇼핑/액티비티/기타) — 기본 `other` (§0.4 code list 와 1:1 매칭)

**일정 → 경비 연동:**
- 일정 상세 모달 (또는 ⋮ 메뉴) 에 **"경비 추가"** 액션 추가
- 클릭 시 경비 BottomSheet 가 열리며 `title = scheduleItem.title`, `expense_date = scheduleItem.tripDay.date`, `schedule_item_id = scheduleItem.id` 자동 채움
- 사용자는 금액/카테고리/통화만 입력
- 저장 시 일반 경비와 동일하게 INSERT (schedule_item_id 만 함께 저장)

**Todo 탭:**
- 기존 목업 구조 유지 (진행도 카드 + 미완료 섹션 + 완료 섹션)
- 체크박스 토글 → `useToggleTodo` optimistic mutation
- 담당자 chip: owner / member / 공동(null)
- 정렬: `is_completed` ASC, `created_at` DESC

**기록 탭:**
- 기존 목업 구조 유지 (카드 + 3줄 프리뷰 + 펼치기)
- 날짜는 여행 기간 내로 제한 (앱 UI, DB 제약 없음)
- 제목/날짜/내용 입력 → INSERT

**게스트 공유 관리 (manage-tab):**
- "게스트 링크" 섹션 교체 (현재 placeholder 배너)
- 활성 상태:
  - no-share: [게스트 링크 생성] 버튼
  - active: 링크 표시 + 복사 + show_* 4 토글 + 만료 설정 + [비활성화] (빨강)
- 토큰은 UUID v4 (서버 생성). show_schedule 기본 true, 나머지 false

**`/share/[token]` 뷰:**
- **Server Component** (SSR) 로 재작성
- 서버에서 supabase anon client 로 `rpc("get_guest_trip_data", { p_token })` 호출
- 반환 JSON 에 trip / share / schedule_by_day / expenses / todos / records 포함 (show_* 플래그 서버 필터링)
- 메타데이터: `generateMetadata` 로 OG 태그 export
- Rate limit: `middleware.ts` 또는 RPC 내부에서 `pg_sleep` 없이 그대로 — 현 MVP 에는 없음, V2 후보

### §1.4 보안 결정

| 항목 | 결정 | 근거 |
|------|------|------|
| RLS re-use | expenses/todos/records/guest_shares 모두 `can_access_trip(trip_id)` 재사용 | §0.2 helper 성숙. 새 helper 불필요 |
| guest_shares SELECT 정책 | owner / group member (via can_access_trip) | anon 은 RPC 만 허용 |
| guest_shares INSERT/UPDATE/DELETE | **owner 만** (`trips.created_by = auth.uid()`) | 파트너가 임의로 링크 발급 못하도록 |
| `get_guest_trip_data` | SECURITY DEFINER, anon GRANT | 토큰 검증 → `is_active` + `expires_at` → show_* 기반 필터 |
| PII 노출 | 게스트 뷰 응답에 email/paid_by uuid 제외, display_name 만 | 원본 §6.8 보안 체크리스트 |
| 검증 순서 | 토큰 존재 → active → not expired → 데이터 반환 | 실패 시 NULL (에러로 토큰 존재 여부 힌트 금지) |

---

## § 2 Task 총람

| Task | 제목 | 산출물 | 의존 |
|------|------|--------|------|
| 0 | Pre-flight — 레지스트리 grep 재검증 + worktree 정리 | - | — |
| 1 | `0010_expenses.sql` 작성 + 적용 | expenses 테이블 + RLS + 인덱스 + Realtime | §0.1 §0.2 |
| 2 | `0011_expenses_rpc.sql` 작성 + 적용 | CRUD RPC 4종 (create/update/delete/—) | Task 1 |
| 3 | `0012_todos.sql` 작성 + 적용 | todos 테이블 + RLS + 인덱스 + Realtime | §0.2 |
| 4 | `0013_todos_rpc.sql` 작성 + 적용 | CRUD + toggle RPC | Task 3 |
| 5 | `0014_records.sql` 작성 + 적용 | records 테이블 + RLS + 인덱스 + Realtime | §0.2 |
| 6 | `0015_records_rpc.sql` 작성 + 적용 | CRUD RPC 3종 | Task 5 |
| 7 | `0016_guest_shares.sql` 작성 + 적용 | guest_shares 테이블 + RLS + `get_guest_trip_data` RPC | Tasks 1,3,5 |
| 8 | DB types regen + `PostgrestVersion: "12"` 복원 + query keys 확장 | `types/database.ts` + `lib/query/keys.ts` | Tasks 1~7 |
| 9 | `lib/expense/*` hooks (list/create/update/delete + aggregate) | 5 hooks + schema.ts | Task 8 |
| 10 | `lib/todo/*` hooks (list/create/update/toggle/delete) | 5 hooks | Task 8 |
| 11 | `lib/record/*` hooks (list/create/update/delete) | 4 hooks | Task 8 |
| 12 | `lib/guest/*` hooks (byTripId/create/update/deactivate) | 4 hooks + rpc caller | Task 8 |
| 13 | expenses-tab.tsx rewire | mock 제거 + hook 배선 + BottomSheet 저장 동작 | Task 9 |
| 14 | expenses ⟶ schedule 연동 (⋮ "경비 추가" 플로우) | schedule-item-modal 액션 / URL 파라미터 | Tasks 9, 13 |
| 15 | todos-tab.tsx rewire | mock 제거 + 토글 optimistic + 담당자 선택 | Task 10 |
| 16 | records-tab.tsx rewire | mock 제거 + 폼 INSERT + 날짜 경계 검증 | Task 11 |
| 17 | manage-tab.tsx 게스트 링크 섹션 | 생성/복사/토글/비활성화 UI | Task 12 |
| 18 | `/share/[token]` SSR 재작성 | Server Component + generateMetadata + rpc 호출 | Task 7 |
| 19 | Realtime 채널 확장 (expenses/todos/records) | schedule-channel 패턴 복제 3회 | Tasks 1, 3, 5 |
| 20 | Unit 테스트 (schema·aggregate·date-validators) | ≥10 테스트 | Tasks 9~11 |
| 21 | Integration 테스트 (RLS·RPC·publication·rate-limit) | ≥14 테스트 | Tasks 1~8 |
| 22 | E2E 테스트 (expenses/todos/records/guest-share) | 4 spec | Tasks 13~18 |
| 23 | Manual QA 체크리스트 | `docs/qa/phase4-e2e-manual-checklist.md` | Tasks 13~18 |
| 24 | Exit gate — Verification SQL + retrospective + tag | `phase-4-expenses-records-guest` | 전체 |

**체크포인트:**
- **Part A 체크포인트** (Task 8 후): tsc 0 / lint 0 / build ✓ / 마이그레이션 0010~0016 적용 확인
- **Part B 체크포인트** (Task 19 후): 4 탭 + /share 수동 smoke / unit+integration 전수
- **Part C 체크포인트** (Task 24 전): E2E 전수 + Manual QA + Verification SQL 5/5

---

## § 3 Task 0 — Pre-flight

### §3.1 목표

Task 1 착수 전 §0 레지스트리를 source 와 **verbatim 재검증**. Part B v1 폐기(2026-04-20)·C1 재발(2026-04-20 심야) 원인 원천 차단.

### §3.2 체크리스트

- [ ] `grep -n "create table public.trips" supabase/migrations/0003_trips.sql` 로 §0.1 재확인
- [ ] `grep -n "can_access_trip" supabase/migrations/` 로 §0.2 함수 시그니처 재확인
- [ ] `grep -rn "getExpensesByTripId\|getTodosByTripId\|getRecordsByTripId\|getGuestShareByToken" components/ app/ lib/` 로 §0.8 mock call sites 전수 확인 — 나중에 rewire 체크리스트와 일치하는지
- [ ] `grep -n "export const TRIP_CURRENCIES" lib/trip/constants.ts` 로 §0.10 상수 확인
- [ ] `grep -n "queryKeys\.\(expenses\|todos\|records\|guest\)" lib/ components/ app/` → 0건 확인 (아직 없음)
- [ ] git worktree 상태 정리: `git worktree list` 에 오래된 prunable 없는지 확인, 있으면 `git worktree prune` + `git branch -d`
- [ ] `.env.local` 체크: Supabase URL/anon/service_role + Maps 5키 + GIS 1키 + test 2키 (Phase 3 동일 9 변수). 누락 시 작업 중단 후 사용자에 요청

### §3.3 환경 필수 요건

- Supabase local 이 **실행 중이어야** 함 (Docker). 아니면 remote link 된 프로젝트로 `supabase db push` 사용
- pnpm 10.17+, node 22+ (package.json engines)
- 마이그레이션 적용 순서 강제: 0001 → 0009 는 이미 적용된 상태로 가정. 0010~0016 은 이번 plan 에서 처음 생성

---

## § 4 Task 1 — `0010_expenses.sql`

### §4.1 목표

`expenses` 테이블 + RLS + 인덱스 + Realtime publication 등록. RPC 는 Task 2 에서 별도 파일.

### §4.2 마이그레이션 파일 (초안 SQL)

```sql
-- 0010_expenses.sql
-- Phase 4: expenses 테이블 + RLS + 인덱스 + Realtime publication
-- 의존: 0003_trips.sql (trips, can_access_trip), 0005_schedule_items.sql (schedule_items FK 대상)

-- ── expenses 테이블 ───────────────────────────────────────────────────
create table public.expenses (
  id                uuid           primary key default gen_random_uuid(),
  trip_id           uuid           not null references public.trips(id) on delete cascade,
  expense_date      date           not null,
  title             text           not null,
  amount            numeric(12,2)  not null,
  currency          text           not null default 'KRW',
  category_code     text           not null default 'other',
  paid_by           uuid           references public.profiles(id) on delete set null,
  schedule_item_id  uuid           references public.schedule_items(id) on delete set null,
  memo              text,
  created_at        timestamptz    not null default now(),
  updated_at        timestamptz    not null default now()
);

-- ── CHECK 제약 ─────────────────────────────────────────────────────────
alter table public.expenses
  add constraint expenses_title_length      check (char_length(title) between 1 and 100),
  add constraint expenses_currency_code     check (char_length(currency) = 3 and currency ~ '^[A-Z]+$'),
  add constraint expenses_amount_nonneg     check (amount >= 0),
  add constraint expenses_amount_max        check (amount <= 9999999999.99),
  add constraint expenses_memo_length       check (memo is null or char_length(memo) <= 1000),
  add constraint expenses_category_valid    check (
    category_code in ('food','transport','lodging','shopping','activity','other')
  );

-- ── 인덱스 ─────────────────────────────────────────────────────────────
create index idx_expenses_trip       on public.expenses(trip_id);
create index idx_expenses_trip_date  on public.expenses(trip_id, expense_date);
create index idx_expenses_schedule   on public.expenses(schedule_item_id)
  where schedule_item_id is not null;
create index idx_expenses_category   on public.expenses(trip_id, category_code);

-- ── 트리거: updated_at ────────────────────────────────────────────────
create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────
alter table public.expenses enable row level security;

create policy "expenses_select"
  on public.expenses for select to authenticated
  using (public.can_access_trip(trip_id));

create policy "expenses_insert"
  on public.expenses for insert to authenticated
  with check (public.can_access_trip(trip_id));

create policy "expenses_update"
  on public.expenses for update to authenticated
  using (public.can_access_trip(trip_id))
  with check (public.can_access_trip(trip_id));

create policy "expenses_delete"
  on public.expenses for delete to authenticated
  using (public.can_access_trip(trip_id));

-- ── Realtime publication 확장 ──────────────────────────────────────────
alter publication supabase_realtime add table public.expenses;

-- ── ROLLBACK ───────────────────────────────────────────────────────────
-- alter publication supabase_realtime drop table public.expenses;
-- drop table if exists public.expenses;
```

### §4.3 검증 SQL (적용 후 실행)

```sql
-- 1. 테이블·RLS 존재
select relname, relrowsecurity from pg_class where relname = 'expenses';
-- 기대: relrowsecurity = t

-- 2. 정책 4종
select policyname, cmd from pg_policies where tablename = 'expenses' order by cmd;
-- 기대: select/insert/update/delete 4행

-- 3. CHECK 제약 6종
select conname from pg_constraint where conrelid = 'public.expenses'::regclass and contype = 'c';
-- 기대: expenses_title_length, _currency_code, _amount_nonneg, _amount_max, _memo_length, _category_valid

-- 4. Realtime publication
select * from query_publication_tables() where tablename = 'expenses';
-- 기대: 1행
```

### §4.4 체크리스트

- [ ] 파일 작성 완료 (`supabase/migrations/0010_expenses.sql`)
- [ ] `supabase db push` (또는 Dashboard + `supabase migration repair --status applied 0010_expenses`)
- [ ] 검증 SQL 4개 PASS
- [ ] commit: `feat(db): add expenses table + RLS + realtime (0010)`

---

## § 5 Task 2 — `0011_expenses_rpc.sql`

### §5.1 목표

expenses CRUD RPC 3종 (create/update/delete). SECURITY DEFINER + `can_access_trip` 체크 + 통화/카테고리 검증.

**방침**: `schedule_item_id` 는 **owner/partner 모두** 설정 가능 (일정은 이미 공유된 자원이므로). `schedule_item_id → trip_id` 일치 검증은 함수 내부에서 수행.

### §5.2 마이그레이션 파일 (초안 SQL)

```sql
-- 0011_expenses_rpc.sql
-- Phase 4: expenses CRUD RPC
-- 의존: 0010_expenses.sql

-- ── create_expense ─────────────────────────────────────────────────────
create or replace function public.create_expense(
  p_trip_id          uuid,
  p_expense_date     date,
  p_title            text,
  p_amount           numeric,
  p_currency         text default 'KRW',
  p_category_code    text default 'other',
  p_paid_by          uuid default null,
  p_schedule_item_id uuid default null,
  p_memo             text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_is_domestic  boolean;
  v_currencies   text[];
  v_sched_trip   uuid;
  v_new_id       uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  if not public.can_access_trip(p_trip_id) then raise exception 'forbidden'; end if;

  -- 통화 정합성: 국내면 KRW 고정, 해외면 trips.currencies 에 포함되어야
  select is_domestic, currencies into v_is_domestic, v_currencies
    from public.trips where id = p_trip_id;
  if v_is_domestic then
    if p_currency != 'KRW' then raise exception 'currency_not_allowed'; end if;
  else
    if p_currency != 'KRW' and not (p_currency = any(v_currencies)) then
      raise exception 'currency_not_allowed';
    end if;
  end if;

  -- schedule_item_id ↔ trip_id 일치 검증
  if p_schedule_item_id is not null then
    select td.trip_id into v_sched_trip
      from public.schedule_items si
      join public.trip_days td on td.id = si.trip_day_id
      where si.id = p_schedule_item_id;
    if v_sched_trip is null then raise exception 'schedule_item_not_found'; end if;
    if v_sched_trip != p_trip_id then raise exception 'schedule_trip_mismatch'; end if;
  end if;

  -- paid_by 는 trip 접근 가능자여야 (선택 사항이지만, set 됐으면 검증)
  if p_paid_by is not null then
    if not (
      exists (select 1 from public.trips where id = p_trip_id and created_by = p_paid_by)
      or exists (
        select 1 from public.group_members gm
        join public.trips t on t.group_id = gm.group_id
        where t.id = p_trip_id and gm.user_id = p_paid_by
      )
    ) then raise exception 'paid_by_not_trip_member'; end if;
  end if;

  insert into public.expenses(
    trip_id, expense_date, title, amount, currency,
    category_code, paid_by, schedule_item_id, memo
  ) values (
    p_trip_id, p_expense_date, p_title, p_amount, p_currency,
    p_category_code, p_paid_by, p_schedule_item_id, p_memo
  ) returning id into v_new_id;

  return v_new_id;
end $$;

revoke all on function public.create_expense(
  uuid, date, text, numeric, text, text, uuid, uuid, text
) from public;
grant execute on function public.create_expense(
  uuid, date, text, numeric, text, text, uuid, uuid, text
) to authenticated;

-- ── update_expense ─────────────────────────────────────────────────────
create or replace function public.update_expense(
  p_expense_id       uuid,
  p_expense_date     date,
  p_title            text,
  p_amount           numeric,
  p_currency         text,
  p_category_code    text,
  p_paid_by          uuid default null,
  p_schedule_item_id uuid default null,
  p_memo             text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_trip_id     uuid;
  v_is_domestic boolean;
  v_currencies  text[];
  v_sched_trip  uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;

  select trip_id into v_trip_id from public.expenses where id = p_expense_id;
  if v_trip_id is null then raise exception 'expense_not_found'; end if;
  if not public.can_access_trip(v_trip_id) then raise exception 'forbidden'; end if;

  select is_domestic, currencies into v_is_domestic, v_currencies
    from public.trips where id = v_trip_id;
  if v_is_domestic then
    if p_currency != 'KRW' then raise exception 'currency_not_allowed'; end if;
  else
    if p_currency != 'KRW' and not (p_currency = any(v_currencies)) then
      raise exception 'currency_not_allowed';
    end if;
  end if;

  if p_schedule_item_id is not null then
    select td.trip_id into v_sched_trip
      from public.schedule_items si
      join public.trip_days td on td.id = si.trip_day_id
      where si.id = p_schedule_item_id;
    if v_sched_trip is null then raise exception 'schedule_item_not_found'; end if;
    if v_sched_trip != v_trip_id then raise exception 'schedule_trip_mismatch'; end if;
  end if;

  if p_paid_by is not null then
    if not (
      exists (select 1 from public.trips where id = v_trip_id and created_by = p_paid_by)
      or exists (
        select 1 from public.group_members gm
        join public.trips t on t.group_id = gm.group_id
        where t.id = v_trip_id and gm.user_id = p_paid_by
      )
    ) then raise exception 'paid_by_not_trip_member'; end if;
  end if;

  update public.expenses
    set expense_date = p_expense_date,
        title = p_title,
        amount = p_amount,
        currency = p_currency,
        category_code = p_category_code,
        paid_by = p_paid_by,
        schedule_item_id = p_schedule_item_id,
        memo = p_memo
    where id = p_expense_id;
end $$;

revoke all on function public.update_expense(
  uuid, date, text, numeric, text, text, uuid, uuid, text
) from public;
grant execute on function public.update_expense(
  uuid, date, text, numeric, text, text, uuid, uuid, text
) to authenticated;

-- ── delete_expense ─────────────────────────────────────────────────────
create or replace function public.delete_expense(p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_trip_id uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  select trip_id into v_trip_id from public.expenses where id = p_expense_id;
  if v_trip_id is null then raise exception 'expense_not_found'; end if;
  if not public.can_access_trip(v_trip_id) then raise exception 'forbidden'; end if;
  delete from public.expenses where id = p_expense_id;
end $$;

revoke all on function public.delete_expense(uuid) from public;
grant execute on function public.delete_expense(uuid) to authenticated;

-- ── ROLLBACK ───────────────────────────────────────────────────────────
-- drop function if exists public.delete_expense(uuid);
-- drop function if exists public.update_expense(uuid, date, text, numeric, text, text, uuid, uuid, text);
-- drop function if exists public.create_expense(uuid, date, text, numeric, text, text, uuid, uuid, text);
```

### §5.3 검증 SQL

```sql
-- 1. 함수 3종 존재 + SECURITY DEFINER
select proname, prosecdef from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('create_expense','update_expense','delete_expense');

-- 2. 권한 — authenticated 만 execute
select p.proname, r.rolname
  from pg_proc p
  join pg_roles r on has_function_privilege(r.oid, p.oid, 'execute')
  where p.proname like '%_expense'
    and r.rolname in ('anon','authenticated','service_role');
-- 기대: authenticated + service_role 만, anon 없음
```

### §5.4 체크리스트

- [ ] 파일 작성 (`supabase/migrations/0011_expenses_rpc.sql`)
- [ ] `supabase db push`
- [ ] 검증 SQL PASS
- [ ] commit: `feat(db): add expenses CRUD RPC (0011)`

---

## § 6 Task 3 — `0012_todos.sql`

### §6.1 마이그레이션 파일 (초안 SQL)

```sql
-- 0012_todos.sql
-- Phase 4: todos 테이블 + RLS + 인덱스 + Realtime
-- 의존: 0003_trips.sql

create table public.todos (
  id            uuid        primary key default gen_random_uuid(),
  trip_id       uuid        not null references public.trips(id) on delete cascade,
  title         text        not null,
  memo          text,
  is_completed  boolean     not null default false,
  assigned_to   uuid        references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.todos
  add constraint todos_title_length check (char_length(title) between 1 and 100),
  add constraint todos_memo_length  check (memo is null or char_length(memo) <= 1000);

create index idx_todos_trip           on public.todos(trip_id);
create index idx_todos_trip_completed on public.todos(trip_id, is_completed);

create trigger todos_set_updated_at
  before update on public.todos
  for each row execute function public.set_updated_at();

alter table public.todos enable row level security;

create policy "todos_select"
  on public.todos for select to authenticated
  using (public.can_access_trip(trip_id));

create policy "todos_insert"
  on public.todos for insert to authenticated
  with check (public.can_access_trip(trip_id));

create policy "todos_update"
  on public.todos for update to authenticated
  using (public.can_access_trip(trip_id))
  with check (public.can_access_trip(trip_id));

create policy "todos_delete"
  on public.todos for delete to authenticated
  using (public.can_access_trip(trip_id));

alter publication supabase_realtime add table public.todos;

-- ROLLBACK
-- alter publication supabase_realtime drop table public.todos;
-- drop table if exists public.todos;
```

### §6.2 체크리스트

- [ ] 파일 작성 + `supabase db push`
- [ ] 검증: `select count(*) from pg_policies where tablename = 'todos'` = 4
- [ ] commit: `feat(db): add todos table + RLS + realtime (0012)`

---

## § 7 Task 4 — `0013_todos_rpc.sql`

### §7.1 마이그레이션 파일 (초안 SQL)

```sql
-- 0013_todos_rpc.sql
-- Phase 4: todos CRUD + toggle RPC
-- 의존: 0012_todos.sql

-- ── create_todo ────────────────────────────────────────────────────────
create or replace function public.create_todo(
  p_trip_id     uuid,
  p_title       text,
  p_memo        text default null,
  p_assigned_to uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_new_id uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  if not public.can_access_trip(p_trip_id) then raise exception 'forbidden'; end if;

  if p_assigned_to is not null then
    if not (
      exists (select 1 from public.trips where id = p_trip_id and created_by = p_assigned_to)
      or exists (
        select 1 from public.group_members gm
        join public.trips t on t.group_id = gm.group_id
        where t.id = p_trip_id and gm.user_id = p_assigned_to
      )
    ) then raise exception 'assigned_to_not_trip_member'; end if;
  end if;

  insert into public.todos(trip_id, title, memo, assigned_to)
    values (p_trip_id, p_title, p_memo, p_assigned_to)
    returning id into v_new_id;
  return v_new_id;
end $$;

revoke all on function public.create_todo(uuid, text, text, uuid) from public;
grant execute on function public.create_todo(uuid, text, text, uuid) to authenticated;

-- ── update_todo (title/memo/assigned_to 만) ────────────────────────────
create or replace function public.update_todo(
  p_todo_id     uuid,
  p_title       text,
  p_memo        text default null,
  p_assigned_to uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_trip_id uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  select trip_id into v_trip_id from public.todos where id = p_todo_id;
  if v_trip_id is null then raise exception 'todo_not_found'; end if;
  if not public.can_access_trip(v_trip_id) then raise exception 'forbidden'; end if;

  if p_assigned_to is not null then
    if not (
      exists (select 1 from public.trips where id = v_trip_id and created_by = p_assigned_to)
      or exists (
        select 1 from public.group_members gm
        join public.trips t on t.group_id = gm.group_id
        where t.id = v_trip_id and gm.user_id = p_assigned_to
      )
    ) then raise exception 'assigned_to_not_trip_member'; end if;
  end if;

  update public.todos
    set title = p_title,
        memo = p_memo,
        assigned_to = p_assigned_to
    where id = p_todo_id;
end $$;

revoke all on function public.update_todo(uuid, text, text, uuid) from public;
grant execute on function public.update_todo(uuid, text, text, uuid) to authenticated;

-- ── toggle_todo (is_completed 만 반전) ─────────────────────────────────
create or replace function public.toggle_todo(
  p_todo_id  uuid,
  p_complete boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_trip_id uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  select trip_id into v_trip_id from public.todos where id = p_todo_id;
  if v_trip_id is null then raise exception 'todo_not_found'; end if;
  if not public.can_access_trip(v_trip_id) then raise exception 'forbidden'; end if;

  update public.todos set is_completed = p_complete where id = p_todo_id;
end $$;

revoke all on function public.toggle_todo(uuid, boolean) from public;
grant execute on function public.toggle_todo(uuid, boolean) to authenticated;

-- ── delete_todo ────────────────────────────────────────────────────────
create or replace function public.delete_todo(p_todo_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_trip_id uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  select trip_id into v_trip_id from public.todos where id = p_todo_id;
  if v_trip_id is null then raise exception 'todo_not_found'; end if;
  if not public.can_access_trip(v_trip_id) then raise exception 'forbidden'; end if;
  delete from public.todos where id = p_todo_id;
end $$;

revoke all on function public.delete_todo(uuid) from public;
grant execute on function public.delete_todo(uuid) to authenticated;

-- ROLLBACK
-- drop function if exists public.delete_todo(uuid);
-- drop function if exists public.toggle_todo(uuid, boolean);
-- drop function if exists public.update_todo(uuid, text, text, uuid);
-- drop function if exists public.create_todo(uuid, text, text, uuid);
```

### §7.2 체크리스트

- [ ] 파일 작성 + push
- [ ] 4 함수 `prosecdef = true`
- [ ] commit: `feat(db): add todos CRUD + toggle RPC (0013)`

---

## § 8 Task 5 — `0014_records.sql`

### §8.1 마이그레이션 파일 (초안 SQL)

```sql
-- 0014_records.sql
-- Phase 4: records 테이블 + RLS + 인덱스 + Realtime
-- 의존: 0003_trips.sql

create table public.records (
  id          uuid        primary key default gen_random_uuid(),
  trip_id     uuid        not null references public.trips(id) on delete cascade,
  title       text        not null,
  content     text        not null,
  date        date        not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.records
  add constraint records_title_length   check (char_length(title) between 1 and 100),
  add constraint records_content_length check (char_length(content) between 1 and 20000);

create index idx_records_trip      on public.records(trip_id);
create index idx_records_trip_date on public.records(trip_id, date);

create trigger records_set_updated_at
  before update on public.records
  for each row execute function public.set_updated_at();

alter table public.records enable row level security;

create policy "records_select"
  on public.records for select to authenticated
  using (public.can_access_trip(trip_id));

create policy "records_insert"
  on public.records for insert to authenticated
  with check (public.can_access_trip(trip_id));

create policy "records_update"
  on public.records for update to authenticated
  using (public.can_access_trip(trip_id))
  with check (public.can_access_trip(trip_id));

create policy "records_delete"
  on public.records for delete to authenticated
  using (public.can_access_trip(trip_id));

alter publication supabase_realtime add table public.records;

-- ROLLBACK
-- alter publication supabase_realtime drop table public.records;
-- drop table if exists public.records;
```

### §8.2 체크리스트

- [ ] 파일 작성 + push
- [ ] commit: `feat(db): add records table + RLS + realtime (0014)`

---

## § 9 Task 6 — `0015_records_rpc.sql`

### §9.1 마이그레이션 파일 (초안 SQL)

```sql
-- 0015_records_rpc.sql
-- Phase 4: records CRUD RPC
-- 의존: 0014_records.sql

create or replace function public.create_record(
  p_trip_id  uuid,
  p_title    text,
  p_content  text,
  p_date     date
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_new_id uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  if not public.can_access_trip(p_trip_id) then raise exception 'forbidden'; end if;

  insert into public.records(trip_id, title, content, date)
    values (p_trip_id, p_title, p_content, p_date)
    returning id into v_new_id;
  return v_new_id;
end $$;
revoke all on function public.create_record(uuid, text, text, date) from public;
grant execute on function public.create_record(uuid, text, text, date) to authenticated;

create or replace function public.update_record(
  p_record_id uuid,
  p_title     text,
  p_content   text,
  p_date      date
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_trip_id uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  select trip_id into v_trip_id from public.records where id = p_record_id;
  if v_trip_id is null then raise exception 'record_not_found'; end if;
  if not public.can_access_trip(v_trip_id) then raise exception 'forbidden'; end if;

  update public.records
    set title = p_title,
        content = p_content,
        date = p_date
    where id = p_record_id;
end $$;
revoke all on function public.update_record(uuid, text, text, date) from public;
grant execute on function public.update_record(uuid, text, text, date) to authenticated;

create or replace function public.delete_record(p_record_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_trip_id uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  select trip_id into v_trip_id from public.records where id = p_record_id;
  if v_trip_id is null then raise exception 'record_not_found'; end if;
  if not public.can_access_trip(v_trip_id) then raise exception 'forbidden'; end if;
  delete from public.records where id = p_record_id;
end $$;
revoke all on function public.delete_record(uuid) from public;
grant execute on function public.delete_record(uuid) to authenticated;

-- ROLLBACK
-- drop function if exists public.delete_record(uuid);
-- drop function if exists public.update_record(uuid, text, text, date);
-- drop function if exists public.create_record(uuid, text, text, date);
```

### §9.2 체크리스트

- [ ] 파일 작성 + push
- [ ] commit: `feat(db): add records CRUD RPC (0015)`

---

## § 10 Task 7 — `0016_guest_shares.sql`

### §10.1 설계 결정

- **토큰**: `uuid` 타입 (UUID v4, 122-bit 랜덤). text 가 아님 — SQL injection 원천 차단 + URL path 직접 매핑
- **테이블 RLS**: SELECT 는 `can_access_trip`, INSERT/UPDATE/DELETE 는 **owner 만** (`trips.created_by = auth.uid()`)
- **get_guest_trip_data**: SECURITY DEFINER, **anon GRANT** (인증 없이 호출 가능). 검증 순서:
  1. `where token = p_token` 존재?
  2. `is_active = true`
  3. `expires_at is null or expires_at > now()`
  4. 실패 시 `return null` (에러 메시지 금지 — 토큰 존재 여부 힌트 방지)
- **반환 JSON 스키마** (show_* 플래그 기반 서버 필터):
  ```ts
  {
    trip: { title, destination, startDate, endDate, isDomestic },
    share: { showSchedule, showExpenses, showTodos, showRecords },
    scheduleByDay?: [{ dayNumber, date, items: [{ title, time, placeName, memo, categoryCode }] }],
    expenses?: [{ expenseDate, title, amount, currency, categoryCode, memo }],
    todos?: [{ title, memo, isCompleted }],
    records?: [{ title, content, date }]
  }
  ```
  PII 제외: `paid_by` / `assigned_to` / `email` / `id (uuid)` 생략. display_name 도 생략 (원본 §6.8 체크리스트).

### §10.2 마이그레이션 파일 (초안 SQL)

```sql
-- 0016_guest_shares.sql
-- Phase 4: guest_shares 테이블 + RLS + get_guest_trip_data RPC (anon)
-- 의존: 0003_trips.sql, 0005_schedule_items.sql, 0010_expenses.sql, 0012_todos.sql, 0014_records.sql

create table public.guest_shares (
  id             uuid        primary key default gen_random_uuid(),
  trip_id        uuid        not null references public.trips(id) on delete cascade,
  token          uuid        not null unique default gen_random_uuid(),
  show_schedule  boolean     not null default true,
  show_expenses  boolean     not null default false,
  show_todos     boolean     not null default false,
  show_records   boolean     not null default false,
  is_active      boolean     not null default true,
  expires_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 1 trip = 1 active share 제약 (동시 복수 share 는 V2)
create unique index idx_guest_shares_active_unique on public.guest_shares(trip_id) where is_active;

create index idx_guest_shares_token on public.guest_shares(token);
create index idx_guest_shares_trip  on public.guest_shares(trip_id);

create trigger guest_shares_set_updated_at
  before update on public.guest_shares
  for each row execute function public.set_updated_at();

alter table public.guest_shares enable row level security;

-- SELECT: owner / member (trip 접근 가능자)
create policy "guest_shares_select"
  on public.guest_shares for select to authenticated
  using (public.can_access_trip(trip_id));

-- INSERT/UPDATE/DELETE: **owner 만** (주의: can_access_trip 이 아님)
create policy "guest_shares_insert"
  on public.guest_shares for insert to authenticated
  with check (
    exists (select 1 from public.trips where id = trip_id and created_by = auth.uid())
  );

create policy "guest_shares_update"
  on public.guest_shares for update to authenticated
  using (
    exists (select 1 from public.trips where id = trip_id and created_by = auth.uid())
  )
  with check (
    exists (select 1 from public.trips where id = trip_id and created_by = auth.uid())
  );

create policy "guest_shares_delete"
  on public.guest_shares for delete to authenticated
  using (
    exists (select 1 from public.trips where id = trip_id and created_by = auth.uid())
  );

-- ── get_guest_trip_data (anon) ────────────────────────────────────────
create or replace function public.get_guest_trip_data(p_token uuid)
returns json
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_share        public.guest_shares%rowtype;
  v_trip         public.trips%rowtype;
  v_schedule     json;
  v_expenses     json;
  v_todos        json;
  v_records      json;
begin
  -- 1. 토큰 검증 (에러 메시지 없이 null)
  select * into v_share from public.guest_shares
    where token = p_token
      and is_active = true
      and (expires_at is null or expires_at > now());
  if v_share.id is null then return null; end if;

  -- 2. trip
  select * into v_trip from public.trips where id = v_share.trip_id;
  if v_trip.id is null then return null; end if;

  -- 3. show_* 기반 섹션 조합
  if v_share.show_schedule then
    -- 각 Day 를 json_build_object 로 명시 구성 — 다른 섹션과 camelCase 키 일관성 확보 (critic MED#3)
    select json_agg(
      json_build_object(
        'dayNumber', td.day_number,
        'date',      td.date,
        'items', coalesce(
          (
            select json_agg(
              json_build_object(
                'title',         si.title,
                'timeOfDay',     si.time_of_day,
                'placeName',     si.place_name,
                'placeAddress',  si.place_address,
                'memo',          si.memo,
                'url',           si.url,
                'categoryCode',  si.category_code
              ) order by si.sort_order
            ) from public.schedule_items si where si.trip_day_id = td.id
          ),
          '[]'::json
        )
      ) order by td.day_number
    ) into v_schedule
    from public.trip_days td
    where td.trip_id = v_share.trip_id;
  end if;

  if v_share.show_expenses then
    select json_agg(
      json_build_object(
        'expenseDate', expense_date,
        'title', title,
        'amount', amount,
        'currency', currency,
        'categoryCode', category_code,
        'memo', memo
      ) order by expense_date desc, created_at desc
    ) into v_expenses
    from public.expenses where trip_id = v_share.trip_id;
  end if;

  if v_share.show_todos then
    select json_agg(
      json_build_object(
        'title', title,
        'memo', memo,
        'isCompleted', is_completed
      ) order by is_completed asc, created_at desc
    ) into v_todos
    from public.todos where trip_id = v_share.trip_id;
  end if;

  if v_share.show_records then
    select json_agg(
      json_build_object(
        'title', title,
        'content', content,
        'date', date
      ) order by date desc, created_at desc
    ) into v_records
    from public.records where trip_id = v_share.trip_id;
  end if;

  -- 4. 최종 JSON (PII 제외)
  return json_build_object(
    'trip', json_build_object(
      'title', v_trip.title,
      'destination', v_trip.destination,
      'startDate', v_trip.start_date,
      'endDate', v_trip.end_date,
      'isDomestic', v_trip.is_domestic
    ),
    'share', json_build_object(
      'showSchedule', v_share.show_schedule,
      'showExpenses', v_share.show_expenses,
      'showTodos',    v_share.show_todos,
      'showRecords',  v_share.show_records
    ),
    'scheduleByDay', coalesce(v_schedule, '[]'::json),
    'expenses',      coalesce(v_expenses, '[]'::json),
    'todos',         coalesce(v_todos, '[]'::json),
    'records',       coalesce(v_records, '[]'::json)
  );
end $$;

revoke all on function public.get_guest_trip_data(uuid) from public;
grant execute on function public.get_guest_trip_data(uuid) to anon, authenticated;

-- ROLLBACK
-- drop function if exists public.get_guest_trip_data(uuid);
-- drop table if exists public.guest_shares;
```

### §10.3 검증 SQL

```sql
-- 1. anon 권한 확인
select p.proname, r.rolname
  from pg_proc p
  join pg_roles r on has_function_privilege(r.oid, p.oid, 'execute')
  where p.proname = 'get_guest_trip_data' and r.rolname = 'anon';
-- 기대: 1행

-- 2. active unique index 작동 확인 (SQL 수동)
-- insert 2 rows with same trip_id + is_active=true → 2번째는 unique violation
```

### §10.4 체크리스트

- [ ] 파일 작성 (`supabase/migrations/0016_guest_shares.sql`)
- [ ] push + anon grant 확인
- [ ] SECURITY DEFINER 보안 체크리스트 (§10.1) 4항 전부 준수
- [ ] commit: `feat(db): add guest_shares + get_guest_trip_data RPC (0016)`

---

## § 11 Task 8 — DB types regen + query keys 확장

### §11.1 목표

`pnpm db:types` 실행 → 0010~0016 반영 → `PostgrestVersion: "12"` 복원 (fix-postgrest-version.mjs 후처리). `lib/query/keys.ts` 에 4개 스코프 추가.

### §11.2 절차

```bash
pnpm db:types
# types/database.ts 가 overwrite 됨. PostgrestVersion 이 "13" 으로 바뀌어 있을 수 있음
pnpm tsx scripts/fix-postgrest-version.mjs
# grep 'PostgrestVersion' types/database.ts → "12" 확인
pnpm tsc --noEmit
# 0 error 확인
```

### §11.3 queryKeys 추가 (초안)

```ts
// lib/query/keys.ts
export const queryKeys = {
  profile: { me: ["profile", "me"] as const, byId: (id: string) => ["profile", "byId", id] as const },
  tripMembers: { byTripId: (tripId: string) => ["tripMembers", tripId] as const },
  trips: {
    all: ["trips"] as const,
    list: ["trips", "list"] as const,
    detail: (id: string) => ["trips", "detail", id] as const,
  },
  group: { me: ["group", "me"] as const },
  tripDays: { byTripId: (tripId: string) => ["tripDays", tripId] as const },
  schedule: { byTripId: (tripId: string) => ["schedule", tripId] as const },
  // ── Phase 4 additions ──
  expenses: {
    byTripId: (tripId: string) => ["expenses", tripId] as const,
  },
  todos: {
    byTripId: (tripId: string) => ["todos", tripId] as const,
  },
  records: {
    byTripId: (tripId: string) => ["records", tripId] as const,
  },
  guest: {
    byTripId: (tripId: string) => ["guest", "byTripId", tripId] as const,
  },
} as const;
```

### §11.4 체크리스트

- [ ] `pnpm db:types` 성공
- [ ] `PostgrestVersion: "12"` 유지
- [ ] `types/database.ts` 에 expenses/todos/records/guest_shares 4 테이블 Row/Insert/Update 타입 존재
- [ ] `create_expense/update_expense/delete_expense/create_todo/update_todo/toggle_todo/delete_todo/create_record/update_record/delete_record/get_guest_trip_data` 11 함수의 Args/Returns 타입 존재
- [ ] queryKeys 4 스코프 추가
- [ ] `pnpm tsc --noEmit` 0 error
- [ ] commit: `chore(types): regen database types + query keys for Phase 4`

---

## § 12 Task 9 — `lib/expense/*` hooks (5 파일)

### §12.1 파일 구조

```
lib/expense/
├── constants.ts           # EXPENSE_CATEGORIES = ["food","transport",...,"other"] (6종)
├── schema.ts              # zod schemas: expenseTitleSchema, expenseAmountSchema
├── aggregate.ts           # aggregateByCurrency, aggregateByCategory, groupByDate (순수 함수)
├── use-expense-list.ts
├── use-create-expense.ts
├── use-update-expense.ts
├── use-delete-expense.ts
```

### §12.2 `constants.ts` + `aggregate.ts` — 순수 함수 우선

```ts
// lib/expense/constants.ts
export const EXPENSE_CATEGORIES = [
  { code: "food",      label: "식비"     },
  { code: "transport", label: "교통"     },
  { code: "lodging",   label: "숙박"     },
  { code: "shopping",  label: "쇼핑"     },
  { code: "activity",  label: "액티비티" },
  { code: "other",     label: "기타"     },
] as const;
export type ExpenseCategoryCode = (typeof EXPENSE_CATEGORIES)[number]["code"];
```

```ts
// lib/expense/aggregate.ts  (순수 함수 — unit 테스트 대상)
import type { Database } from "@/types/database";
type Expense = Database["public"]["Tables"]["expenses"]["Row"];

export function aggregateByCurrency(items: Expense[]): Record<string, number> { /* ... */ }
export function aggregateByCategory(items: Expense[]): Record<string, Record<string, number>> { /* ... */ }
export function groupByDate(items: Expense[]): Record<string, Expense[]> { /* ... */ }
export function sumByCurrency(items: Expense[]): Record<string, number> { /* ... */ }
```

### §12.3 `schema.ts` (zod)

```ts
import { z } from "zod";
import { TRIP_CURRENCIES } from "@/lib/trip/constants";
import { EXPENSE_CATEGORIES } from "./constants";

export const expenseTitleSchema = z.string().trim().min(1).max(100);

export const expenseAmountSchema = z
  .coerce.number()
  .finite()
  .min(0, "금액은 0 이상이어야 해요")
  .max(9_999_999_999.99, "금액이 너무 커요");

export const expenseCurrencySchema = z.enum(TRIP_CURRENCIES);

export const expenseCategorySchema = z.enum(
  EXPENSE_CATEGORIES.map((c) => c.code) as [string, ...string[]]
);

export const expenseMemoSchema = z
  .string().max(1000, "메모는 1000자 이하")
  .transform((v) => (v.trim() === "" ? null : v));
```

### §12.4 `use-expense-list.ts`

```ts
"use client";
import { useQuery } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import type { Database } from "@/types/database";

export type Expense = Database["public"]["Tables"]["expenses"]["Row"];

export function useExpenseList(tripId: string | null) {
  const supabase = getBrowserClient();
  return useQuery({
    queryKey: tripId ? queryKeys.expenses.byTripId(tripId) : ["expenses", "__idle"],
    enabled: Boolean(tripId),
    queryFn: async (): Promise<Expense[]> => {
      if (!tripId) return [];
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("trip_id", tripId)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10_000,
  });
}
```

### §12.5 `use-create-expense.ts`

```ts
"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import type { ExpenseCategoryCode } from "./constants";

export type CreateExpenseInput = {
  tripId: string;
  expenseDate: string;
  title: string;
  amount: number;
  currency: string;
  categoryCode: ExpenseCategoryCode;
  paidBy?: string | null;
  scheduleItemId?: string | null;
  memo?: string | null;
};

export function useCreateExpense() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateExpenseInput): Promise<string> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("create_expense", {
        p_trip_id: input.tripId,
        p_expense_date: input.expenseDate,
        p_title: input.title,
        p_amount: input.amount,
        p_currency: input.currency,
        p_category_code: input.categoryCode,
        p_paid_by: input.paidBy ?? null,
        p_schedule_item_id: input.scheduleItemId ?? null,
        p_memo: input.memo ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_id, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.expenses.byTripId(vars.tripId) });
    },
  });
}
```

### §12.6 `use-update-expense.ts` — 전체 9 필드 명시 (critic MED#2)

```ts
"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import type { ExpenseCategoryCode } from "./constants";

export type UpdateExpenseInput = {
  tripId: string;            // invalidate 키 용도 (서버엔 미전달)
  expenseId: string;
  expenseDate: string;
  title: string;
  amount: number;
  currency: string;
  categoryCode: ExpenseCategoryCode;
  paidBy?: string | null;
  scheduleItemId?: string | null;
  memo?: string | null;
};

export function useUpdateExpense() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateExpenseInput): Promise<void> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("update_expense", {
        p_expense_id: input.expenseId,
        p_expense_date: input.expenseDate,
        p_title: input.title,
        p_amount: input.amount,
        p_currency: input.currency,
        p_category_code: input.categoryCode,
        p_paid_by: input.paidBy ?? null,
        p_schedule_item_id: input.scheduleItemId ?? null,
        p_memo: input.memo ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.expenses.byTripId(vars.tripId) });
    },
  });
}
```

### §12.6b `use-delete-expense.ts`

```ts
export type DeleteExpenseInput = { tripId: string; expenseId: string };

export function useDeleteExpense() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeleteExpenseInput) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("delete_expense", {
        p_expense_id: input.expenseId,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.expenses.byTripId(vars.tripId) });
    },
  });
}
```

### §12.7 체크리스트

- [ ] 5 파일 작성
- [ ] `use-*` 훅 모두 `(supabase as any).rpc()` escape hatch 사용 (Phase 2~3 패턴 준수)
- [ ] `tsc --noEmit` 0 error
- [ ] `lint` 0 error
- [ ] commit: `feat(expense): add expense CRUD hooks + schema + aggregate`

---

## § 13 Task 10 — `lib/todo/*` hooks

### §13.1 파일

```
lib/todo/
├── schema.ts              # todoTitleSchema, todoMemoSchema
├── use-todo-list.ts
├── use-create-todo.ts
├── use-update-todo.ts
├── use-toggle-todo.ts     # optimistic
├── use-delete-todo.ts
```

### §13.2 `use-todo-list.ts` 정렬

```ts
queryFn: async () => {
  const { data, error } = await supabase
    .from("todos")
    .select("*")
    .eq("trip_id", tripId)
    .order("is_completed", { ascending: true })
    .order("created_at", { ascending: false });
  /* ... */
}
```

### §13.3 `use-toggle-todo.ts` optimistic 패턴

```ts
export function useToggleTodo() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ todoId, complete }: { tripId: string; todoId: string; complete: boolean }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("toggle_todo", {
        p_todo_id: todoId,
        p_complete: complete,
      });
      if (error) throw error;
    },
    onMutate: async ({ tripId, todoId, complete }) => {
      const key = queryKeys.todos.byTripId(tripId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Todo[]>(key);
      if (prev) {
        qc.setQueryData<Todo[]>(key, prev.map((t) =>
          t.id === todoId ? { ...t, is_completed: complete } : t
        ));
      }
      return { prev };
    },
    onError: (_err, { tripId }, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.todos.byTripId(tripId), ctx.prev);
    },
    onSettled: (_d, _e, { tripId }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.todos.byTripId(tripId) });
    },
  });
}
```

### §13.4 체크리스트

- [ ] 5 파일 작성
- [ ] `useToggleTodo` 는 optimistic + rollback 을 실구현
- [ ] commit: `feat(todo): add todo CRUD + toggle hooks`

---

## § 14 Task 11 — `lib/record/*` hooks

### §14.1 파일

```
lib/record/
├── schema.ts              # recordTitleSchema, recordContentSchema, recordDateSchema
├── use-record-list.ts
├── use-create-record.ts
├── use-update-record.ts
├── use-delete-record.ts
```

### §14.2 `schema.ts` 날짜 경계 검증

```ts
import { z } from "zod";
export const recordTitleSchema = z.string().trim().min(1).max(100);
export const recordContentSchema = z.string().trim().min(1).max(20000);
// 여행 기간 내 제한은 UI 레벨에서. DB CHECK 없음 (원본 §6.7 "앱 UI에서 trip 기간으로 제한, DB 제약 없음")
export function buildRecordDateSchema(start: string, end: string) {
  return z.string().refine(
    (v) => v >= start && v <= end,
    `날짜는 ${start} ~ ${end} 사이여야 해요`
  );
}
```

### §14.3 체크리스트

- [ ] 5 파일 작성
- [ ] `useRecordList` 정렬 `date desc, created_at desc`
- [ ] commit: `feat(record): add record CRUD hooks`

---

## § 15 Task 12 — `lib/guest/*` hooks

### §15.1 파일

```
lib/guest/
├── use-guest-share.ts           # byTripId (owner 전용, `useMyGroup` 같은 단일 레코드 쿼리)
├── use-create-guest-share.ts    # 새 토큰 발급
├── use-update-guest-share.ts    # show_* 플래그, expires_at 변경
├── use-deactivate-guest-share.ts # is_active=false
├── build-share-url.ts           # 토큰 → /share/{token} 절대 URL (origin + path)
```

### §15.2 설계 핵심

- **활성 share 는 trip 당 1개** (DB unique index — `idx_guest_shares_active_unique on (trip_id) where is_active`). 따라서 `useGuestShare(tripId)` 는 단일 row 반환 or null
- **재활성화 (`useCreateGuestShare`) 는 plain INSERT**:
  - 이전 row 가 존재해도 `is_active=false` 상태이므로 partial unique index 의 WHERE 절에서 제외됨 → INSERT 충돌 없음
  - 서버가 `gen_random_uuid()` default 로 새 토큰 발급 → 이전 링크의 토큰은 DB 에 남아있지만 `is_active=false` 라 `get_guest_trip_data` 검증에서 null 반환 → 자연스럽게 404
  - **동시성**: owner 가 두 탭에서 동시에 "생성" 클릭 시 unique violation (23505) 발생 가능. UI 는 에러 catch → `queryClient.invalidateQueries(queryKeys.guest.byTripId(tripId))` → 리페치 후 기존 활성 토큰을 그대로 노출
- `useUpdateGuestShare` 는 show_* 4개 + expires_at 만. 토큰은 불변
- `useDeactivateGuestShare` 는 soft delete (`is_active=false`) — 공유 로그 감사 목적, 완전 delete 는 CASCADE 로 trip 삭제 시에만

### §15.3 `use-guest-share.ts`

```ts
export function useGuestShare(tripId: string | null) {
  const supabase = getBrowserClient();
  return useQuery({
    queryKey: tripId ? queryKeys.guest.byTripId(tripId) : ["guest", "__idle"],
    enabled: Boolean(tripId),
    queryFn: async (): Promise<GuestShare | null> => {
      if (!tripId) return null;
      const { data, error } = await supabase
        .from("guest_shares")
        .select("*")
        .eq("trip_id", tripId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    staleTime: 30_000,
  });
}
```

### §15.4 `build-share-url.ts`

```ts
export function buildShareUrl(token: string, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/share/${token}`;
}
```

### §15.5 체크리스트

- [ ] 5 파일 작성
- [ ] `useGuestShare` 의 쿼리가 `is_active=true` 만 필터 (비활성 history 노출 안 함)
- [ ] commit: `feat(guest): add guest share hooks + build-share-url`

---

## § 16 Task 13 — `expenses-tab.tsx` rewire

### §16.1 변경 요약

- `@/lib/mocks` import 전부 제거
- `useExpenseList` / `useCreateExpense` / `useUpdateExpense` / `useDeleteExpense` 배선
- `useTripDetail` 에서 `is_domestic`, `currencies` 가져와 통화 선택지 구성
- `useTripMembers` 로 결제자 chip 렌더
- BottomSheet "저장" 버튼이 실제 INSERT 실행
- Phase 0 배너 제거
- Category chip 에 `EXPENSE_CATEGORIES` 사용

### §16.2 BottomSheet 폼 상태

```ts
type ExpenseFormValue = {
  expenseDate: string;              // ISO
  title: string;
  amount: string;                   // UI 문자열, zod coerce
  currency: string;                 // KRW 기본
  categoryCode: ExpenseCategoryCode;
  paidBy: string | null;            // profile.id 또는 null=공동
  memo: string;
};
```

검증: zod schemas 조합 + 통화 매칭 (국내는 KRW 강제).

### §16.3 카테고리별 필터는 기존 그대로 유지

- `CATEGORIES` 상수를 `EXPENSE_CATEGORIES` + `"all"` 조합으로 재구성
- 데이터 소스가 바뀌어도 필터 로직은 동일

### §16.4 체크리스트

- [ ] mock import 0건 (grep 확인)
- [ ] 빈 상태 empty state 유지 (여행 기간 내 첫 경비 생성 UX)
- [ ] FAB 클릭 → BottomSheet → 저장 → 리스트에 즉시 반영 (invalidate)
- [ ] tsc / lint 0
- [ ] commit: `feat(expenses): wire expenses-tab to real DB`

---

## § 17 Task 14 — 일정↔경비 연동 (⋮ 메뉴 "경비 추가")

### §17.1 UX 결정

- `ScheduleItemModal` 의 **편집 모드** 에서만 노출 (새 일정 등록 중엔 맥락 없음)
- 하단 작은 secondary 버튼: "이 일정의 경비 추가"
- 클릭 시 모달 **닫지 않고** 상단에 ExpenseQuickAdd bottom sheet 를 **오버레이**... 복잡함 → 단순화:
  - 일정 모달 닫기 → `tab=expenses` URL 파라미터로 리다이렉트 + `scheduleItemId` URL query param 포함 → expenses-tab 이 URL 파라미터 감지 → BottomSheet 자동 오픈 + scheduleItemId 프리필 (그리고 title/expenseDate 프리필)
  - 경비 저장 후 URL query 정리

### §17.2 URL 계약

```
/trips/[id]?tab=expenses&quickAdd=scheduleItemId:<uuid>
```

- 기존 탭 라우팅에 `quickAdd` 읽기 로직 추가
- 성공 저장 시 `router.replace` 로 쿼리 제거

### §17.3 expenses-tab.tsx 추가 로직

```tsx
const search = useSearchParams();
const quickAdd = search.get("quickAdd");
// "scheduleItemId:<uuid>" 파싱 — UUID 정규식 검증 (critic MIN#2, R9)
const UUID_RE = /^[0-9a-f-]{36}$/i;
useEffect(() => {
  if (!quickAdd) return;
  const [kind, id] = quickAdd.split(":");
  if (kind !== "scheduleItemId" || !id || !UUID_RE.test(id)) return;  // 악성·오타 입력 무시
  // schedule item 로드 → 폼 프리필 → sheet open
  /* ... */
}, [quickAdd]);
```

### §17.4 ScheduleItemModal 액션 추가

```tsx
{mode === "edit" && (
  <Button variant="tertiary" onClick={() => {
    router.push(`/trips/${tripId}?tab=expenses&quickAdd=scheduleItemId:${item.id}`);
  }}>
    이 일정의 경비 추가
  </Button>
)}
```

### §17.5 체크리스트

- [ ] URL 파라미터 기반 프리필 (X-state 간 navigation 단순화)
- [ ] 저장 후 URL cleanup
- [ ] E2E spec (§ 23) 에 시나리오 포함: 일정 → 경비 추가 → expenses 탭 → BottomSheet 자동 열림 → 저장
- [ ] commit: `feat(expenses): link schedule→expense via URL quickAdd`

---

## § 18 Task 15 — `todos-tab.tsx` rewire

### §18.1 변경

- mock 제거
- `useTodoList` / `useCreateTodo` / `useUpdateTodo` / `useToggleTodo` / `useDeleteTodo` 배선
- 체크박스 클릭 → `useToggleTodo` optimistic
- 담당자 선택 chip 추가 (TripMembers 기반)
- 배너 제거

### §18.2 체크리스트

- [ ] optimistic 토글 (클릭 즉시 UI 반영)
- [ ] 담당자 null (공동) vs user.id 선택 UI 구분
- [ ] commit: `feat(todos): wire todos-tab to real DB with optimistic toggle`

---

## § 19 Task 16 — `records-tab.tsx` rewire

### §19.1 변경

- mock 제거
- `useRecordList` / `useCreateRecord` / `useUpdateRecord` / `useDeleteRecord` 배선
- 날짜 경계: `useTripDetail` → `start_date`/`end_date` 로 `buildRecordDateSchema(start, end)` 활용
- 배너 제거

### §19.2 체크리스트

- [ ] 날짜 validation (trip 기간 밖 입력 시 zod 에러)
- [ ] 내용 20000자 제한 안내
- [ ] commit: `feat(records): wire records-tab to real DB`

---

## § 20 Task 17 — `manage-tab.tsx` 게스트 링크 섹션

### §20.1 UI 상태 분기

```
[게스트 링크 섹션]

no-share (useGuestShare → null):
  [게스트 링크 생성] 버튼

active:
  - 링크: https://...share/<uuid>
  - [복사] [QR — Phase 5+ ] 
  - show_* 4 토글 (일정/경비/Todo/기록)
  - 만료: "무기한" | "YYYY-MM-DD" + 변경
  - [공유 비활성화] 빨강 (2단 확인)
```

### §20.2 새 컴포넌트

`components/trip/guest-share-section.tsx` — manage-tab 하위 컴포넌트. 기존 manage-tab placeholder 배너 교체.

### §20.3 토큰 복사

```ts
async function copyLink(url: string) {
  try { await navigator.clipboard.writeText(url); flash("링크가 복사되었어요"); }
  catch { flash("복사에 실패했어요"); }
}
```

(Phase 2 invite page 의 패턴 준수.)

### §20.4 체크리스트

- [ ] placeholder 배너 제거
- [ ] no-share / active 분기 렌더
- [ ] 비활성화 2단 ConfirmDialog (파트너 공유 OFF 와 동일 구조)
- [ ] commit: `feat(manage): add guest share link section`

---

## § 21 Task 18 — `/share/[token]` SSR 재작성

### §21.1 결정

- **Server Component** 로 전환 (`"use client"` 제거)
- supabase 서버 client 는 anon 롤 사용 (`@supabase/ssr`) — 세션 없이 `get_guest_trip_data` 호출
- `generateMetadata` 로 OG 태그 export
- 섹션 컴포넌트는 전부 server-safe (useState/useEffect 없이 렌더)
- CTA 배너 → `/login` 링크 (기존 유지)

### §21.2 `app/share/[token]/page.tsx` 초안 — 기존 `getServerClient()` 래퍼 재사용 (critic HIGH#3)

```tsx
// Server Component — "use client" 없음
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServerClient } from "@/lib/supabase/server-client";
import { AppBar } from "@/components/ui/app-bar";  // AppBar 는 "use client" 없음 — SSR 안전
/* ...섹션 컴포넌트 import ... */

type SharePayload = {
  trip: { title: string; destination: string; startDate: string; endDate: string; isDomestic: boolean };
  share: { showSchedule: boolean; showExpenses: boolean; showTodos: boolean; showRecords: boolean };
  scheduleByDay: Array<{ dayNumber: number; date: string; items: ScheduleItemShare[] }>;
  expenses: ExpenseShare[];
  todos: TodoShare[];
  records: RecordShare[];
};

async function fetchGuestData(token: string): Promise<SharePayload | null> {
  const supabase = await getServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("get_guest_trip_data", { p_token: token });
  if (error || !data) return null;
  return data as SharePayload;
}

// 주의: get_guest_trip_data 는 anon GRANT 라 세션 없이도 호출 가능.
// getServerClient 는 cookies 기반이지만 세션 없어도 문제 없음 — RPC 가 auth.uid() 를 안 씀.

export async function generateMetadata({
  params,
}: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const data = await fetchGuestData(token);
  if (!data) return { title: "공유 링크" };
  return {
    title: `${data.trip.title} · 여행 공유`,
    description: `${data.trip.destination} · ${data.trip.startDate}~${data.trip.endDate}`,
    openGraph: {
      title: data.trip.title,
      description: data.trip.destination,
      type: "website",
    },
    robots: { index: false, follow: false },
  };
}

export default async function SharePage({
  params,
}: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await fetchGuestData(token);
  if (!data) notFound();  // 404 (만료·비활성·존재 안 함 전부 동일 UI)

  return (
    <div /* ...레이아웃... */>
      {/* Read-only banner, AppBar, Hero */}
      {data.share.showSchedule  && <ScheduleSection days={data.scheduleByDay} />}
      {data.share.showExpenses  && <ExpensesSection items={data.expenses} />}
      {data.share.showTodos     && <TodosSection items={data.todos} />}
      {data.share.showRecords   && <RecordsSection items={data.records} />}
      {/* CTA 배너 (기존 유지) */}
    </div>
  );
}
```

### §21.3 404 처리

- `notFound()` 호출 → `app/share/[token]/not-found.tsx` 가 EmptyState 렌더
- 만료·비활성·잘못된 토큰 모두 동일 UI (존재 여부 leak 방지)

### §21.4 CSP 검토

- Server Component 는 브라우저에서 `rpc` 호출하지 않음 → `connect-src` 영향 없음
- AppBar / 섹션 컴포넌트가 client directive 포함 시 hydration 주의. 현재 사용 컴포넌트는 대부분 server-safe 하나 `useRouter` 등 사용 시 분리 필요 (현재 share 페이지는 router 사용 안 함)

### §21.5 체크리스트

- [ ] `"use client"` 제거 확인
- [ ] `@/lib/mocks` import 0건
- [ ] `generateMetadata` export 존재
- [ ] 404 분기 (`not-found.tsx` 별도 생성)
- [ ] `pnpm build` 에서 `/share/[token]` 가 **dynamic** (SSR) 로 표시
- [ ] commit: `feat(share): convert /share/[token] to SSR with get_guest_trip_data`

---

## § 22 Task 19 — Realtime 채널 확장

### §22.1 파일 패턴 (schedule-channel 복제)

```
lib/realtime/
├── expenses-channel.ts    (신규)
├── todos-channel.ts       (신규)
├── records-channel.ts     (신규)
└── use-realtime-gateway.ts  (3 채널 추가)
```

### §22.2 핸들러 패턴 (기존 `lib/realtime/schedule-channel.ts:20-33` 와 **동일 구조** — critic HIGH#2 반영)

```ts
// lib/realtime/expenses-channel.ts
import type { QueryClient, Query } from "@tanstack/react-query";
import { subscribeToTable } from "./channel";

export function handleExpenseChange(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({
    predicate: (q: Query) => Array.isArray(q.queryKey) && q.queryKey[0] === "expenses",
  });
}

export function subscribeToExpenses(queryClient: QueryClient) {
  return subscribeToTable<{ trip_id: string }>({
    channel: "expenses-changes",
    table: "expenses",
    onChange: () => handleExpenseChange(queryClient),
  });
}
```

**반환 타입 주의**: `subscribeToTable` 은 내부적으로 `supabase.channel(...).subscribe()` 호출 후 **unsubscribe 함수** `() => supabase.removeChannel(ch)` 를 반환한다. 기존 `subscribeToScheduleItems/Trips/Groups/GroupMembers` 와 동일 계약.

todos/records 도 동일 패턴 (`trip_id: string`, `channel: "todos-changes"` / `"records-changes"`, `table: "todos"` / `"records"`, queryKey prefix `"todos"` / `"records"`).

### §22.3 `use-realtime-gateway.ts` 확장 — 기존 `useEffect(..., [userId, queryClient, supabase, showToast])` **하나** 안에 추가 (critic HIGH#2)

**기존 시그니처 유지**: `useRealtimeGateway(userId: string | undefined)` (`lib/realtime/use-realtime-gateway.ts:13`).

**Diff** (line 22-45 기존 useEffect 에 3 라인 추가 + cleanup 에 3 라인):

```diff
 useEffect(() => {
   if (!userId) return;

   const unsubTrips = subscribeToTrips(queryClient, userId);
   const unsubSchedule = subscribeToScheduleItems(queryClient);
   const unsubMembers = subscribeToGroupMembers(queryClient);
   const unsubGroups = subscribeToGroups(queryClient, {
     onDissolved: () => showToast("파트너와의 공유가 종료되었어요"),
   });
+  const unsubExpenses = subscribeToExpenses(queryClient);
+  const unsubTodos = subscribeToTodos(queryClient);
+  const unsubRecords = subscribeToRecords(queryClient);

   const handleOnline = () => { void queryClient.invalidateQueries(); };
   window.addEventListener("online", handleOnline);

   return () => {
     unsubTrips();
     unsubSchedule();
     unsubMembers();
     unsubGroups();
+    unsubExpenses();
+    unsubTodos();
+    unsubRecords();
     window.removeEventListener("online", handleOnline);
     void supabase.removeAllChannels();
   };
 }, [userId, queryClient, supabase, showToast]);
```

**두 번째 useEffect 추가 금지** — 단일 effect 유지로 cleanup 일관성 보장.

### §22.4 체크리스트

- [ ] 3 파일 신규 작성
- [ ] gateway 에 구독 3개 추가
- [ ] integration 테스트: `realtime-publication-audit.test.ts` 에 `expenses/todos/records` 포함 확인
- [ ] commit: `feat(realtime): extend gateway with expenses/todos/records channels`

---

## § 23 Task 20 — Unit 테스트 (≥10 테스트)

### §23.1 대상

| 파일 | 테스트 |
|------|--------|
| `tests/unit/expense-schema.test.ts` | expenseTitleSchema / amountSchema / currencySchema / categorySchema (4) |
| `tests/unit/expense-aggregate.test.ts` | aggregateByCurrency / aggregateByCategory / groupByDate / sumByCurrency (4) |
| `tests/unit/todo-schema.test.ts` | title/memo length, optional (2) |
| `tests/unit/record-schema.test.ts` | title/content length + buildRecordDateSchema 경계 (3) |
| `tests/unit/guest-build-share-url.test.ts` | buildShareUrl (2) |

총 ≥15 테스트.

### §23.2 체크리스트

- [ ] 5 파일 신규
- [ ] vitest `include` 경로 확인 (기존 config 가 `tests/unit/**` 커버)
- [ ] `pnpm vitest run tests/unit` 전수 PASS
- [ ] commit: `test(unit): add Phase 4 unit tests (expenses/todos/records/guest)`

---

## § 24 Task 21 — Integration 테스트 (≥14 테스트)

### §24.1 대상

| 파일 | 테스트 목적 |
|------|-----------|
| `tests/integration/rls-expenses.test.ts` | alice/bob 접근 매트릭스 (8케이스: select/insert/update/delete × owner/partner/stranger) |
| `tests/integration/create-expense-currency-validation.test.ts` | 국내→KRW only / 해외→currencies 리스트 검증 / schedule_item_id 일치 검증 |
| `tests/integration/rls-todos.test.ts` | 동일 패턴 |
| `tests/integration/rls-records.test.ts` | 동일 패턴 |
| `tests/integration/rls-guest-shares.test.ts` | owner INSERT OK / partner INSERT 거부 / anon SELECT 직접 거부 |
| `tests/integration/get-guest-trip-data.test.ts` | 토큰 검증 3단계 (존재·active·expires) / show_* 기반 섹션 필터 / PII 제외 / 잘못된 토큰 → null (에러 아님) |
| `tests/integration/expenses-schedule-link.test.ts` | schedule_item 삭제 시 expense.schedule_item_id → NULL (CASCADE 금지, SET NULL 확인) |
| `tests/integration/realtime-publication-audit.test.ts` | **확장** — expenses/todos/records 추가 확인 (기존 파일) |
| `tests/integration/guest-shares-one-active-per-trip.test.ts` | 2번째 active INSERT 시 unique violation 확인 |
| `tests/integration/toggle-todo-optimistic-consistency.test.ts` | toggle 후 row 값 확인 |

**예상 테스트 파일 수: 9 (8 신규 + 1 확장). 테스트 케이스 총합 ≥30.**

### §24.2 데이터 시드 패턴

- `tests/integration/create-trip.test.ts` 에서 쓴 inline `auth.admin.createUser` + `signInWithPassword` 패턴 재사용
- `test_truncate_cascade` seed 함수 활용 (Phase 3 Task 4 에서 도입)

### §24.3 체크리스트

- [ ] 9 파일 (8 신규 + 1 확장)
- [ ] `pnpm test:integration` 전수 PASS
- [ ] alice/bob 재사용 (1 계정당 최대 2 underscore 제약 회피 — Phase 3 Task 23 학습)
- [ ] commit: `test(integration): add Phase 4 RLS/RPC/publication tests`

---

## § 25 Task 22 — E2E 테스트 (5 spec)

### §25.1 spec 파일

| 파일 | 시나리오 |
|------|---------|
| `tests/e2e/expenses-crud.spec.ts` | 생성/편집/삭제/필터/통화별 집계 검증 |
| `tests/e2e/expenses-from-schedule.spec.ts` | 일정 → ⋮ → "경비 추가" → URL quickAdd → BottomSheet 프리필 → 저장 → 경비탭 확인 |
| `tests/e2e/todos-crud.spec.ts` | 생성/토글/담당자 지정/삭제 + 미완료 먼저 정렬 |
| `tests/e2e/records-crud.spec.ts` | 생성/편집/삭제/날짜 경계 에러 |
| `tests/e2e/guest-share-flow.spec.ts` | 관리탭 → 생성 → 복사 → 신 탭 `/share/[token]` (anon) → show_* 토글 시 섹션 visibility 변경 → 비활성화 → 새로고침 시 404 |

총 5 spec.

### §25.2 인증 인프라 재사용

- `tests/e2e/auth.ts` + `buildStorageState` (Phase 3 Task 24 에서 `chromium.launch()` 로 교정된 버전) 유지
- signOut 은 `{ scope: "local" }` 명시

### §25.3 체크리스트

- [ ] 5 spec PASS (skip 없음 우선 목표; 외부 의존 발견 시 그때만 skip)
- [ ] `pnpm test:e2e` 전수 녹색
- [ ] commit: `test(e2e): add Phase 4 specs (expenses/todos/records/guest)`

---

## § 26 Task 23 — Manual QA 체크리스트

### §26.1 파일

`docs/qa/phase4-e2e-manual-checklist.md` — 섹션 구성:

1. Pre-flight (키·마이그레이션·계정 2개)
2. 경비 CRUD + 통화 분기 (국내 vs 해외)
3. 일정→경비 quickAdd 흐름
4. Todo CRUD + 토글 + 담당자 + 정렬
5. 기록 CRUD + 날짜 경계
6. 게스트 링크 생성 + anon 뷰 + show_* 토글 반영
7. 게스트 비활성화 → 새 탭 404
8. Realtime — alice INSERT → bob 즉시 반영 (expenses/todos/records 각각)
9. DB Verification SQL 5 쿼리

### §26.2 체크리스트

- [ ] 파일 작성
- [ ] 사용자 수동 수행 대상 명확 (Maps 키 의존 없는 이 phase 는 전부 자동화 가능)
- [ ] commit: `docs(qa): add Phase 4 manual checklist`

---

## § 27 Task 24 — Exit gate

### §27.1 자동 게이트 (연속 3회 통과 기준)

```bash
pnpm tsc --noEmit          # 0 error
pnpm lint                  # 0 error
pnpm build                 # 14+ routes 성공 (신규 /share/[token] dynamic)
pnpm vitest run tests/unit
pnpm test:integration
pnpm test:e2e
pnpm audit --audit-level=high  # 0 vulnerability
```

### §27.2 Verification SQL (`scripts/phase4-verify.sql`)

```sql
-- 1. expenses/todos/records/guest_shares RLS 활성
select relname, relrowsecurity from pg_class
 where relname in ('expenses','todos','records','guest_shares') order by relname;
-- 기대: 4행 전부 t

-- 2. CHECK 제약 수
select relname, count(*) from pg_constraint c
 join pg_class cl on cl.oid = c.conrelid
 where cl.relname in ('expenses','todos','records','guest_shares')
   and c.contype = 'c'
 group by relname;
-- 기대: expenses ≥6, todos ≥2, records ≥2, guest_shares ≥0

-- 3. Realtime publication
select tablename from query_publication_tables()
 where tablename in ('expenses','todos','records')
 order by tablename;
-- 기대: 3행

-- 4. get_guest_trip_data anon grant
select p.proname, r.rolname
  from pg_proc p
  join pg_roles r on has_function_privilege(r.oid, p.oid, 'execute')
  where p.proname = 'get_guest_trip_data'
    and r.rolname = 'anon';
-- 기대: 1행

-- 5. expenses.schedule_item_id ON DELETE SET NULL 확인
select conname, confdeltype from pg_constraint
 where conname = 'expenses_schedule_item_id_fkey';
-- 기대: confdeltype = 'n' (SET NULL)
```

### §27.3 Retrospective append

- `docs/plans/2026-04-23-phase4-expenses-todos-records-guest.md` 끝에 5개 섹션:
  1. 무엇이 잘 되었나
  2. 무엇이 어려웠나
  3. Plan drift 발견 건수
  4. 새로 추가된 knowledge 페이지
  5. 다음 phase 주의점

### §27.4 Tag

```bash
git tag phase-4-expenses-records-guest
# push 는 사용자 수동 (harness 훅으로 default branch 직접 push 차단)
```

### §27.5 체크리스트

- [ ] 7 자동 게이트 연속 3회 PASS
- [ ] Verification SQL 5/5 PASS
- [ ] Retrospective append
- [ ] tag 생성 (push 사용자)
- [ ] commit: `chore(phase-4): exit gate + verification + retrospective`

---

## § 28 집행 프로토콜 (7항)

1. **Task 순서 엄수**: 0 → 1 → 2 → ... → 24. DB 마이그레이션 단계 (1~7) 는 반드시 순차.
2. **§0 레지스트리 grep 재검증**: 각 Task 착수 직전에 해당 §0.x 섹션을 source 와 re-grep. C1 재발 방지.
3. **RPC 호출 시그니처**: 훅 작성 시 **마이그레이션 파일 직접 grep** (LLM 기억 금지).
4. **`(supabase as any).rpc()` escape hatch**: 신규 RPC 전부 해당. PostgrestVersion "12" workaround 유지.
5. **Task 8 후 Part A 체크포인트**: tsc/lint/build/마이그레이션 전수 PASS 확인 후 Task 9~12 훅 시리즈 착수.
6. **Task 19 후 Part B 체크포인트**: 4 탭 + /share 스모크 테스트 + unit+integration 전수 PASS 확인 후 Task 20~22 테스트 착수.
7. **Task 24 전 Part C 체크포인트**: E2E 전수 + Manual QA 섹션 1~9 + Verification SQL 5/5 PASS 후 tag.

---

## § 29 Risks & Mitigations

| ID | Risk | Mitigation |
|----|------|-----------|
| R1 | `categories` 테이블을 expense 에도 쓰려다 composite PK 로 0008 을 깨뜨림 | §0.4 에서 string CHECK 로 분리 결정. FK 없음 |
| R2 | `guest_shares` 동시 생성 race — owner 가 두 탭에서 동시에 "생성" 클릭 시 두 번째 INSERT 가 unique violation (23505) | §15.2 에 명시 — catch 해서 `invalidateQueries(guest.byTripId)` 로 기존 활성 토큰 리페치 후 UI 자연 복구. 추가 트랜잭션 불필요 (비활성 row 는 unique index WHERE 절에서 제외되므로 정상 INSERT 경로는 2-step 필요 없음) |
| R3 | Server Component `/share/[token]` 에서 cookies() 사용 시 hydration 경고 | `createServerClient` 에 빈 setAll 핸들러 전달 (anon 이므로 세션 쓰기 불필요) |
| R4 | Realtime publication 에 테이블 추가 시 이미 존재 에러 | **0005_schedule_items.sql:93 의 unguarded `alter publication add table` 선례를 따름** (신규 테이블은 publication 에 존재하지 않는 것이 보장됨). 로컬 재실행 시 에러 나면 Dashboard 에서 수동 drop 후 재적용. `do $$ if not exists` 가드는 기존 테이블 재조정용 (0003_trips.sql) 에 한정 — 신규 테이블에는 불필요 |
| R5 | `expenses.paid_by` profile 삭제 시 — SET NULL 로 했지만 실제 Supabase auth 에서 profile 삭제는 구현 안 됨 | Phase 4 에선 cascade 없음. V2 계정 삭제 기능 추가 시 ADR 필요 |
| R6 | `get_guest_trip_data` 성능 (4 서브쿼리) | 현 MVP 는 trip 당 수십 ~ 수백 아이템 가정. V2 에서 materialized view 검토 |
| R7 | E2E 게스트 테스트 의 second browser context (anon) 불안정 | `browser.newContext({ storageState: undefined })` 로 명시적 무세션 |
| R8 | `expenses.amount` precision loss (JS number → numeric(12,2)) | `.toFixed(2)` 후 string 으로 전송. Supabase 가 numeric 으로 parse |
| R9 | 일정↔경비 quickAdd URL 파라미터 XSS | `scheduleItemId:<uuid>` 포맷 + 정규식 검증 (`/^[0-9a-f-]{36}$/i`) — UI 에서만 트리거, DB 에는 RPC 로 |
| R10 | `useMyGroup` 이 non-owner 에 대해 guest 링크 섹션 숨기는 로직 검토 | owner 만 guest share CRUD 가능 (§10.2 RLS). UI 도 동일 — `trip.created_by !== me.id` 면 섹션 전체 hidden |

---

## § 30 Spec 커버리지 매트릭스

원본 스펙 (`2026-04-16-travel-manager-design.md`) 의 §6.5~§6.8 + §4 요구사항 전수 매핑:

| 스펙 요구 | 대응 Task | 테스트 |
|-----------|----------|--------|
| expenses.trip_id / expense_date / title / amount / currency / category_id / paid_by / schedule_item_id / memo | Task 1 | integration: rls-expenses |
| expenses aggregation (일별·통화별·카테고리별) | Task 9 (aggregate.ts) | unit: expense-aggregate |
| "경비 추가" ⋮ 메뉴 + schedule_item 삭제 시 expense.schedule_item_id → NULL | Tasks 14, 1 | e2e: expenses-from-schedule, integration: expenses-schedule-link |
| todos.trip_id / title / memo / is_completed / assigned_to | Task 3 | integration: rls-todos |
| Todo 미완료 먼저 정렬 | Task 10 | e2e: todos-crud |
| records.trip_id / title / content / date | Task 5 | integration: rls-records |
| records 날짜 UI 제약 (trip 기간 내) | Task 11 schema | unit: record-schema |
| guest_shares.trip_id / token / show_* / is_active / expires_at | Task 7 | integration: rls-guest-shares |
| `get_guest_trip_data` SECURITY DEFINER + 보안 체크리스트 4 | Task 7 | integration: get-guest-trip-data |
| `/share/[token]` SSR + OG 메타 | Task 18 | e2e: guest-share-flow |
| "나도 여행 계획 세우기 →" CTA 배너 | Task 18 | (기존 유지) |
| PII 제외 (email / paid_by uuid) | Task 7 RPC | integration: get-guest-trip-data |
| 관리 탭 게스트 링크 생성 UI | Task 17 | e2e: guest-share-flow |
| Realtime — schedule/expenses/todos | Task 19 | integration: realtime-publication-audit 확장 |
| RLS — 모든 테이블 can_access_trip 재사용 | Tasks 1/3/5/7 | integration: rls-* × 4 |

**커버리지: Unit 5/5 · Integration 9/9 · E2E 5/5 = 100%** (unit 파일 5 = expense-schema / expense-aggregate / todo-schema / record-schema / guest-build-share-url)

---

## § 31 ADR 작성 의무

Phase 4 에서 다음 ADR 들을 `~/MY_AI_WIKI/projects/travel-manager/decisions/` 에 작성 (번호는 현재 ADR-011 부터):

- **ADR-011**: Expense 카테고리를 string CHECK 로 처리 (categories 테이블 재사용 안 함) — §0.4 결정
- **ADR-012**: Guest share 1 trip = 1 active (unique index) — 스펙 원본은 복수 링크 허용이나 V1 단순화
- **ADR-013**: `/share/[token]` Server Component + `notFound()` 공통 UI (만료·비활성·존재 안 함 leak 방지) — §21.3
- **ADR-014**: Expense↔schedule 연동을 URL query 로 하고 props drilling 회피 — §17 결정

---

## § 32 Plan 버전 히스토리

- 2026-04-23 v1 draft — 초안 (2264 lines). critic 검토 전
- 2026-04-23 v2 (critic 1회차 inline patched) — Verdict **REVISE** (HIGH 4 / MED 3 / MIN 4). 10 patch 인라인 반영:
  - HIGH#1 §1.3 경비 카테고리 한글 라벨 drift fix (`관광` → `액티비티`)
  - HIGH#2 §22.2 + §22.3 Realtime 채널 패턴 `subscribeToTable` 로 교정 + 기존 useEffect 병합
  - HIGH#3 §21.2 `getServerClient()` 재사용
  - HIGH#4 §15.2 + R2 재활성화·race 설명 재작성
  - MED#1 R4 unguarded alter publication 선례로 정합
  - MED#2 §12.6 `UpdateExpenseInput` / `DeleteExpenseInput` 명시 draft
  - MED#3 §10.2 schedule 섹션을 `json_build_object` 로 재작성 (camelCase 일관)
  - MIN#2 §17.3 UUID 정규식 검증 inline
  - MIN#3 §25 "4 spec" → "5 spec"
  - MIN#4 §30 "Unit 4/4" → "Unit 5/5"
  - Open question 해결: `components/ui/app-bar.tsx` 는 `"use client"` 없음 확인 → §21.2 주석으로 기록
- Spec coverage matrix 100% 재확인 (Unit 5 / Integration 9 / E2E 5)
- 다음: critic 2회차 또는 executor 착수 (Task 0 pre-flight)

---

## 참고 / 크로스 링크

- 스펙 원본: `docs/superpowers/specs/2026-04-16-travel-manager-design.md`
- 현행화 스펙: `docs/specs/2026-04-20-travel-manager-design-updated.md`
- Phase 3 spec: `docs/specs/2026-04-20-phase3-schedule-map-design.md`
- Phase 3 gap recovery plan: `docs/plans/2026-04-22-phase3-gap-recovery.md` (§0 레지스트리 패턴 차용)
- Knowledge: [[knowledge/patterns/plan-writing-requires-schema-registry-first]] · [[knowledge/patterns/plan-execution-config-scan-checklist]]
- Memory: [[memory/feedback_plan_writing]]

---

## § 33 Retrospective (2026-04-24 집행 완료)

실행 범위: Tasks 13~20 + 23~24 (UI rewire + SSR + Realtime + unit 테스트 + QA 체크리스트 + Exit gate). Tasks 21 (integration) · 22 (E2E) 는 Phase 4 follow-up 으로 이관.

### §33.1 무엇이 잘 되었나

- **§0 source-verbatim 레지스트리 원칙 정착**: 직전 세션의 migrations + hooks 단계와 동일한 critic REVISE 패턴으로 plan 이 정확한 시그니처를 제공 → Task 13~19 에서 RPC 파라미터 드리프트 0건.
- **BottomSheet 재사용 가능한 "SheetMode" 패턴 확립**: expenses/todos/records 3 탭 전부 `{ kind: "closed" | "create" | "edit" }` discriminated union + `buildInitialValues(mode)` + `sheetKey` re-init effect 패턴 공유. 유지보수 일관성 확보.
- **Task 14 quickAdd URL 계약이 간결**: state machine 대신 URL 단일 source-of-truth. `UUID_RE` 가 오염된 입력을 첫 관문에서 차단.
- **Task 18 SSR 전환 매끄러움**: `get_guest_trip_data` 가 anon GRANT + camelCase JSON 으로 설계돼 있어 Server Component 에서 `as SharePayload` 한 번의 캐스팅만 필요. 섹션 컴포넌트는 전부 `"use client"` 없이 렌더.
- **Task 19 Realtime 3 채널 확장이 3 라인 패치**: 기존 `subscribeToTable` 계약 재사용으로 gateway `useEffect` 단일화 원칙 유지 (critic HIGH#2 준수).

### §33.2 무엇이 어려웠나

- **React 19 `react-hooks/set-state-in-effect` 재발 (3 파일)**: expenses/todos/records 의 sheet re-init 에서 동일 패턴 반복. 기존 config-scan 체크리스트의 block eslint-disable 조항을 참조해 해결. 근본 완화는 `key` prop 기반 re-mount 패턴 전환이 더 낫지만, BottomSheet mount-unmount 플리커를 피하려면 현행 effect 유지 + disable 이 실용적.
- **UUID_RE regex 범위 차이**: schedule quickAdd 파싱용 UUID_RE (`/^[0-9a-f-]{36}$/i`) 와 `/share/[token]` 용 strict UUID (`/^[0-9a-f]{8}-[0-9a-f]{4}-...$/i`) 를 의도적으로 분리. 전자는 빠른 sanity gate, 후자는 RPC 호출 전 strict validation. 향후 `lib/uuid.ts` 공용 유틸로 통합 고려.
- **Expense 타입 factory**: 통합 테스트 없이 unit 테스트만 작성하려니 `Database["public"]["Tables"]["expenses"]["Row"]` 의 모든 필드를 mock 해야 함. 작은 헬퍼 (`mk()`) 로 회피.

### §33.3 Plan drift 발견 건수

- **0건** — §0 레지스트리 원칙 + §32 version history 에 critic inline patch 반영으로 plan 자체가 실행 지침. Task 19 Realtime 이 가장 명확한 레지스트리 일치 사례 (`subscribeToTable<{ trip_id: string }>` 계약 100% 매칭).

### §33.4 새로 추가된 knowledge 페이지

- 신규 추가 없음. 기존 패턴 적용만:
  - [[knowledge/patterns/react-effect-set-state-rule-handling]] (Phase 3 Task 18~20 에서 도입) 재활용
  - [[knowledge/patterns/plan-writing-requires-schema-registry-first]] 재활용

### §33.5 다음 phase 주의점

1. **Integration/E2E 이관**: Phase 4 follow-up 에서 Task 21 (RLS × 4 테이블 + 통화 검증 + FK SET NULL + publication audit 확장 + 1 active per trip unique + toggle consistency) + Task 22 (5 spec) 집행. 참고: [[issues/supabase-signout-default-global-scope-revokes-all-sessions]], [[issues/dnd-kit-sortable-stoppropagation-blocks-pointer-sensor]] 피해 가야 함.
2. **Realtime 구독 완성도**: Phase 3 에서 skip 처리된 partner-realtime / share-toggle E2E 는 `useTripsList`/`useTripDetail` Realtime 구독 미구현이 원인. Phase 5 (또는 별도 hotfix) 에서 trips row-level subscription 로 복구 필요.
3. **Maps API 키 prod 등록**: Vercel preview 배포 시 preview 도메인 GIS origin + Naver/Google Maps 도메인 등록이 선행돼야 `/share/[token]` 이외 모든 trip 기반 기능이 동작.
4. **audit 2 moderate**: `pnpm audit --audit-level=high` 는 통과하지만 moderate 2건 잔존. Phase 5 착수 전 `pnpm update` 1회 검토.

### §33.6 게이트 결과 (2026-04-24)

| 항목 | 결과 |
|------|------|
| `pnpm tsc --noEmit` | 0 error |
| `pnpm lint` | 0 error · 11 pre-existing warnings |
| `pnpm build` | ✓ 14 routes · `/share/[token]` = ƒ (Dynamic) |
| `pnpm vitest run tests/unit` | 102 passed / 27 files |
| `pnpm audit --audit-level=high` | 0 high · 2 moderate |
| Manual QA | `docs/qa/phase4-e2e-manual-checklist.md` 9 섹션 · 실 수행은 사용자 몫 |
| Verification SQL | `scripts/phase4-verify.sql` 6 쿼리 · 실 수행은 사용자 몫 |

### §33.7 Tag

`git tag phase-4-expenses-records-guest` — UI rewire + SSR + Realtime + unit 완료 지점. Integration/E2E 는 `phase-4-e2e-complete` 별도 tag 로 follow-up.

