# travel-manager Design Spec

> **Date:** 2026-04-16
> **Status:** Draft → Reviewed (2026-04-16)
> **Author:** AI + Human collaborative design
> **Review:** 데이터 정합성, 보안, UX, 사용자 여정, 확장성 5개 관점 검토 완료

---

## 1. Overview

### Purpose

커플이 함께 여행을 계획하고 경비·기록을 관리하는 모바일 퍼스트 웹앱 (PWA).

### User Types

| Type | Description | Auth |
|------|-------------|------|
| Owner | 여행 생성자 | Google 로그인 |
| Partner | 초대 코드로 연결된 파트너 | Google 로그인 |
| Guest | 공유 URL로 조회만 | 인증 없음 (토큰 기반) |

### Tech Stack

| Area | Technology | Rationale |
|------|-----------|-----------|
| Framework | Next.js (App Router) | SSR(게스트) + Client(인증 페이지) 유연 전환 |
| Backend | Supabase | PostgreSQL + Realtime 통합 |
| Auth | Google Identity Services (GIS) + Supabase `signInWithIdToken` | Supabase OAuth rate limit 우회 |
| Server Data | TanStack Query | 캐싱, optimistic update, persist |
| UI State | Zustand | 가볍고 확장 용이 |
| Style | Tailwind CSS + CSS Modules | 유틸리티 + 컴포넌트 스타일 분리 |
| Font | Pretendard Variable | 한글 최적화 가변 폰트 |
| Deploy | Vercel | Next.js 최적 플랫폼 |
| Maps | Google Maps + Naver Maps | 해외/국내 분리 |

---

## 2. Scope

### In Scope

| Feature | Description |
|---------|-------------|
| 인증 | Google Sign-In (GIS) + Supabase signInWithIdToken |
| 그룹 연결 | UUID 토큰 기반 초대 링크로 파트너 연결 (V1: 2인 커플) |
| 여행 CRUD | 제목, 위치, 기간, 국내/해외, 통화(해외) |
| 일정 관리 | 일자별 리스트 + 지도 분할 뷰, 드래그 이동, 카테고리 |
| 경비 관리 | 날짜별, 카테고리, 통화별 합계, 결제자 선택(필수X) |
| Todo | 준비 체크리스트, 담당자 선택(필수X) |
| 기록 | 텍스트 중심 기록, 날짜 |
| 게스트 공유 | URL 토큰 조회, 호스트가 공개 항목 선택적 공개 |
| 멤버 관리 | 프로필 display_name 설정 (없으면 이메일 표시) |
| 카테고리 관리 | 기본 제공 + 사용자 추가 (일정/경비) |
| 지도 연동 | Google Maps(해외) + Naver Maps(국내) 검색 및 표시 |
| 실시간 동기 | Supabase Realtime으로 파트너 간 즉시 반영 |
| PWA | 앱 설치, 쉘 프리캐시 (Workbox) |

### Out of Scope

- 오프라인 지원
- 카카오 로그인
- 환율 변환 (통화별 합계만)
- 사진/미디어 첨부 (설계 노트: 별도 media 테이블 + polymorphic FK로 확장 예정)
- 네이티브 앱 (iOS/Android)

### V2 Scope (예정)

- 게스트 접근 로그
- 인앱 Activity Feed / Push 알림
- 여행 목록 검색
- 데이터 내보내기 (CSV/PDF)
- Day Tab 드래그로 일정 이동

---

## 3. Architecture

### Rendering Strategy — Route-Based

인증된 페이지는 SEO 불필요, 핵심 기능(지도/드래그/실시간)은 클라이언트 전용.
SSR이 필요한 건 게스트 공유 URL 하나뿐.

```
┌──────────────────────────────────────────────────┐
│                 Next.js App Router                │
├──────────────┬───────────────┬────────────────────┤
│   Static     │  App Shell    │     SSR            │
│  (빌드 시)    │+ Client Data  │  (서버 렌더)        │
├──────────────┼───────────────┼────────────────────┤
│ /            │ /trips        │ /share/[token]     │
│ /login       │ /trips/[id]   │ (게스트 공유 URL)   │
│              │ /settings/*   │                    │
│              │ /invite/[code]│                    │
├──────────────┴───────────────┴────────────────────┤
│                   Common Infra                    │
│  PWA Workbox (쉘 프리캐시 → 재방문 즉시 로드)       │
│  TanStack Query (데이터 캐시 + Optimistic Update)  │
│  Supabase Realtime (파트너 실시간 동기)             │
│  Zustand (UI 상태: 탭, 지도 토글, 드래그)           │
└──────────────────────────────────────────────────┘
```

### Shell-First Principle

이전 프로젝트(travel-manager_old)의 교훈 반영:

| Problem (Old) | Solution (New) |
|---------------|----------------|
| SSR 블로킹 — 데이터 끝나야 첫 픽셀 | 인증 페이지는 SSR 안 함. Skeleton 즉시 렌더 |
| 재방문도 풀 왕복 | PWA Workbox 쉘 캐시 |
| 탭 전환 공백 플래시 | next/dynamic lazy load + TanStack 캐시 유지 |
| 마이크로 인터랙션 부재 | 디자인 시스템에 포함 |
| 한글 폰트 미최적화 | Pretendard Variable |

렌더링 흐름:
```
[1] 앱 쉘 즉시 렌더 (PWA 프리캐시 or Skeleton)
 ↓
[2] 클라이언트에서 TanStack Query로 데이터 fetch
 ↓
[3] TanStack 캐시에 저장 (탭 이동 시 재사용, persistQueryClient)
 ↓
[4] Supabase Realtime 구독으로 실시간 갱신
```

### State Management

| Layer | Tool | Purpose |
|-------|------|---------|
| Server Data | TanStack Query | CRUD, 캐싱, optimistic updates, persistQueryClient |
| Realtime | Supabase Realtime | 파트너 간 변경사항 즉시 반영 |
| UI State | Zustand | 활성 탭, 지도 토글, 드래그 상태, 필터 |

### Code Splitting

- 여행 상세의 비활성 탭은 `next/dynamic`으로 lazy load
- 모달/피커류는 상호작용 시점에 로드
- 지도 SDK는 일정 탭 진입 시에만 로드

### Rate Limiting

Vercel Edge Middleware로 API rate limit 적용:

| 대상 | 정책 |
|------|------|
| `/invite/[code]` | IP당 분당 10회 |
| `/share/[token]` | IP당 분당 30회 |
| CRUD API 전체 | 유저당 분당 60회 |
| Google OAuth | Supabase 기본 제한에 위임 |

### Session Management

- Supabase 기본 JWT 설정 사용 (access token 1h, refresh token 자동 갱신)
- GIS + signInWithIdToken 방식이라 세션 관리는 Supabase에 위임

---

## 4. Data Model

### ER Diagram

```
profiles (from auth.users trigger)
  │
  ├─── groups
  │       │
  │       ├─── group_members
  │       │
  │       └─── trips
  │              │
  │              ├─── trip_days
  │              │       └─── schedule_items
  │              │
  │              ├─── expenses (독립 날짜)
  │              ├─── todos
  │              ├─── records
  │              └─── guest_shares
  │
  └─── categories (default + custom)
```

### Tables

#### profiles

Auth 회원가입 시 trigger로 자동 생성.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, FK → auth.users | |
| email | text | NOT NULL | |
| display_name | text | nullable | 표시명 (없으면 이메일) |
| avatar_url | text | nullable | Google 프로필 사진 |
| color | text | NOT NULL, CHECK (color IN ('orange','blue','gold','violet','green','rose')), default 'orange' | 결제자·담당자 칩 배경색. 가입 시 기본 오렌지, 설정 화면에서 팔레트 중 선택 가능 (6색). |
| created_at | timestamptz | NOT NULL, default now() | |

색상 팔레트는 DESIGN.md 토큰과 1:1 매핑:
- orange → `--color-accent-orange` (#F54E00)
- blue → `--color-ti-read` (#9FBBE0)
- gold → `--color-accent-gold` (#C08532)
- violet → `--color-ti-edit` (#C0A8DD)
- green → `--color-ti-grep` (#9FC9A2)
- rose → `--color-ti-thinking` (#DFA88F)

#### groups

커플/그룹 관리. V1에서는 max_members=2 (커플 전용).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | |
| name | text | nullable | 그룹명 (V1 커플은 불필요) |
| invite_code | text | UNIQUE, NOT NULL | UUID v4 토큰 (brute-force 방지) |
| status | text | NOT NULL, CHECK (status IN ('pending', 'active', 'dissolved')) | |
| max_members | integer | NOT NULL, default 2 | V1: 2 고정 |
| created_by | uuid | FK → profiles, NOT NULL | 초대한 사람 |
| created_at | timestamptz | NOT NULL, default now() | |

Constraints:
```sql
-- 초대 코드 검색 (pending만)
CREATE INDEX idx_groups_invite ON groups(invite_code) WHERE status = 'pending';
```

#### group_members

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | |
| group_id | uuid | FK → groups ON DELETE CASCADE, NOT NULL | |
| user_id | uuid | FK → profiles, NOT NULL | |
| role | text | NOT NULL, CHECK (role IN ('owner', 'member')) | |
| joined_at | timestamptz | NOT NULL, default now() | |

Constraints:
```sql
UNIQUE (group_id, user_id);
-- 유저당 active 그룹 1개만
CREATE UNIQUE INDEX idx_group_members_active ON group_members(user_id)
  WHERE group_id IN (SELECT id FROM groups WHERE status = 'active');
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_group_members_group ON group_members(group_id);
```

Group dissolution:
- groups.status → 'dissolved'
- 해당 group_id를 가진 trips → group_id = NULL (생성자만 유지, 파트너 접근 차단)
- 해당 group_id를 가진 categories → group_id = NULL

#### trips

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | |
| group_id | uuid | FK → groups ON DELETE SET NULL, nullable | null = 개인 여행 |
| created_by | uuid | FK → profiles, NOT NULL | |
| title | text | NOT NULL | 여행 제목 |
| destination | text | NOT NULL | 위치 |
| start_date | date | NOT NULL | |
| end_date | date | NOT NULL | |
| is_domestic | boolean | NOT NULL, default true | 국내/해외 |
| currencies | text[] | default '{}' | 해외 시 사용 통화 (예: ['USD','JPY']) |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | |

Access rule: `created_by = me` OR `group_id`의 active group에 내가 속해 있음.

파트너 공유 토글:
- 여행 관리 탭에서 ON/OFF 토글로 group_id 설정/해제
- 그룹 연결 후 신규 여행: 기본 ON (자동 group_id 설정)
- 그룹 연결 전 기존 여행: 기본 OFF (group_id = NULL)
- 생성자만 토글 가능

```sql
CREATE INDEX idx_trips_created_by ON trips(created_by);
CREATE INDEX idx_trips_group ON trips(group_id);
```

#### trip_days

여행 생성 시 앱 로직으로 bulk INSERT. 날짜 변경 시 **Supabase RPC function**으로 atomic 처리.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | |
| trip_id | uuid | FK → trips ON DELETE CASCADE, NOT NULL | |
| day_number | integer | NOT NULL | 1, 2, 3... |
| date | date | NOT NULL | 실제 날짜 |

Date change — RPC function `resize_trip_days`:
```sql
CREATE FUNCTION resize_trip_days(
  p_trip_id uuid,
  p_new_start date,
  p_new_end date
) RETURNS void
SECURITY INVOKER  -- 호출자 권한 (RLS 적용)
AS $$
BEGIN
  -- 1. 삭제 대상 day의 schedule_items → 마지막 유지 day로 이동
  -- 2. trip_days 삭제 (CASCADE로 빈 day 삭제)
  -- 3. 새 날짜 범위의 trip_days 추가 (확장 시)
  -- 4. trip.start_date, end_date 업데이트
  -- 전체가 하나의 트랜잭션
END;
$$ LANGUAGE plpgsql;
```

- 기간 늘어남 → 새 trip_days 추가 (일정 없음)
- 기간 줄어듦 → 삭제 대상 day의 schedule_items를 마지막 유지 day로 이동 후 삭제
- expenses는 trip_days와 무관 (독립 날짜) → 영향 없음
- UI: 축소 시 확인 다이얼로그 필수 ("Day 4-5의 일정 N개가 Day 3으로 이동됩니다")

```sql
CREATE INDEX idx_trip_days_trip ON trip_days(trip_id);
UNIQUE (trip_id, day_number);
```

#### schedule_items

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | |
| trip_day_id | uuid | FK → trip_days ON DELETE CASCADE, NOT NULL | |
| title | text | NOT NULL | 장소/활동명 |
| category_id | uuid | FK → categories, nullable | |
| time | time | nullable | 시간 (선택) |
| order | integer | NOT NULL | 같은 날 내 순서 |
| place_name | text | nullable | 지도 검색 결과 장소명 |
| place_address | text | nullable | 주소 |
| place_lat | double precision | nullable | 위도 |
| place_lng | double precision | nullable | 경도 |
| map_provider | text | nullable, CHECK (map_provider IN ('google', 'naver')) | trip.is_domestic 기반 자동 설정 |
| memo | text | nullable | |
| url | text | nullable | 관련 링크 (예매·리뷰·블로그). https?:// 스킴만 허용, 앱 UI에서 검증 |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | |

Drag & drop:
- 같은 날 내 순서 변경: order 재배치
- 다른 날로 이동: trip_day_id 변경 + order 재배치
- Optimistic update (TanStack Query) → 실패 시 rollback + 토스트 알림
- 동시 편집 충돌: last-write-wins (2명 사용이라 충분)

```sql
CREATE INDEX idx_schedule_items_day ON schedule_items(trip_day_id);
CREATE INDEX idx_schedule_items_order ON schedule_items(trip_day_id, "order");
```

#### expenses

trip_days와 독립. 실제 지출 날짜를 직접 기록.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | |
| trip_id | uuid | FK → trips ON DELETE CASCADE, NOT NULL | |
| expense_date | date | NOT NULL | 실제 지출 날짜 (기본값: 오늘) |
| title | text | NOT NULL | |
| amount | decimal(12,2) | NOT NULL | |
| currency | text | NOT NULL, default 'KRW' | |
| category_id | uuid | FK → categories, nullable | |
| paid_by | uuid | FK → profiles, nullable | 결제자 (앱에서 trip 접근 가능자만 표시) |
| schedule_item_id | uuid | FK → schedule_items ON DELETE SET NULL, nullable | 일정 연동 (선택). 일정 삭제 시 경비는 유지. |
| memo | text | nullable | |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | |

Aggregation (쿼리 레벨):
- 일별 합계: GROUP BY expense_date
- 통화별 합계: GROUP BY currency
- 카테고리별 합계 (통화별 중첩): GROUP BY category_id, currency — 앱 UI에서 경비 총계 카드 하단에 표시
- 전체 합계: SUM(amount) GROUP BY currency
- 카테고리별 필터/집계 지원

일정 ↔ 경비 연동:
- 일정 상세에서 "경비 연동" 버튼 → 기존 경비 선택(해당 trip 내 schedule_item_id=null 또는 동일 일정) 또는 신규 경비 생성
- 경비 상세에서 연결된 일정명 노출 + 해제 가능
- schedule_items 삭제 시 expenses.schedule_item_id → NULL (경비는 유지)

```sql
CREATE INDEX idx_expenses_trip ON expenses(trip_id);
CREATE INDEX idx_expenses_date ON expenses(trip_id, expense_date);
CREATE INDEX idx_expenses_schedule ON expenses(schedule_item_id) WHERE schedule_item_id IS NOT NULL;
```

#### todos

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | |
| trip_id | uuid | FK → trips ON DELETE CASCADE, NOT NULL | |
| title | text | NOT NULL | |
| memo | text | nullable | |
| is_completed | boolean | NOT NULL, default false | |
| assigned_to | uuid | FK → profiles, nullable | 담당자 |
| created_at | timestamptz | NOT NULL, default now() | |

#### records

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | |
| trip_id | uuid | FK → trips ON DELETE CASCADE, NOT NULL | |
| title | text | NOT NULL | |
| content | text | NOT NULL | 본문 텍스트 |
| date | date | NOT NULL | 날짜 (앱 UI에서 trip 기간으로 제한, DB 제약 없음) |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | |

#### guest_shares

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | |
| trip_id | uuid | FK → trips ON DELETE CASCADE, NOT NULL | |
| token | text | UNIQUE, NOT NULL | UUID v4 (URL 토큰) |
| show_schedule | boolean | NOT NULL, default true | |
| show_expenses | boolean | NOT NULL, default false | |
| show_todos | boolean | NOT NULL, default false | |
| show_records | boolean | NOT NULL, default false | |
| is_active | boolean | NOT NULL, default true | |
| created_at | timestamptz | NOT NULL, default now() | |
| expires_at | timestamptz | nullable | null = 무기한 |

Guest access: Supabase RPC function으로 캡슐화 (anon 유저에게 테이블 직접 접근 불허):
```sql
CREATE FUNCTION get_guest_trip_data(share_token text)
RETURNS json
SECURITY DEFINER
```

**RPC 보안 체크리스트:**
1. token은 반드시 parameterized query ($1)로 사용 — SQL injection 방지
2. 검증 순서: token 존재 → is_active = true → expires_at 체크 → 데이터 반환
3. 검증 실패 시 즉시 NULL 반환 (에러 메시지로 토큰 존재 여부 힌트 금지)
4. 반환 데이터에 user email, paid_by 등 개인정보 미포함
5. show_* 플래그에 따라 해당 데이터만 포함

```sql
CREATE INDEX idx_guest_shares_token ON guest_shares(token);
CREATE INDEX idx_guest_shares_trip ON guest_shares(trip_id);
```

#### categories

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | |
| type | text | NOT NULL, CHECK (type IN ('schedule', 'expense')) | |
| name | text | NOT NULL | |
| icon | text | nullable | 이모지 or 아이콘명 |
| is_default | boolean | NOT NULL, default false | 시스템 기본값 |
| created_by | uuid | FK → profiles, nullable | null = 시스템 기본 |
| group_id | uuid | FK → groups ON DELETE SET NULL, nullable | 그룹 커스텀 |
| created_at | timestamptz | NOT NULL, default now() | |

Default categories:
- Schedule: 교통, 관광, 식당, 숙소, 쇼핑, 기타
- Expense: 교통, 숙박, 식비, 쇼핑, 관광, 기타

그룹 형성 시: 개인 카테고리(group_id = null, created_by = 본인)의 group_id를 신규 그룹으로 업데이트.

```sql
-- 그룹 내 커스텀 카테고리 중복 방지
CREATE UNIQUE INDEX idx_categories_group ON categories(type, name, group_id) WHERE group_id IS NOT NULL;
-- 기본 카테고리 중복 방지
CREATE UNIQUE INDEX idx_categories_default ON categories(type, name) WHERE is_default = true;
-- 개인 카테고리 중복 방지 (솔로 유저)
CREATE UNIQUE INDEX idx_categories_personal ON categories(type, name, created_by) WHERE group_id IS NULL AND is_default = false;
```

### RLS Policies

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| profiles | 인증 유저: display_name, avatar_url / 본인: 전체 | trigger only | 본인만 | 불가 |
| groups | 본인 소속 | 인증 유저 | 본인 소속 | 본인 소속 |
| group_members | 본인 소속 그룹 | 인증 유저 | 본인 소속 그룹 | 본인 소속 그룹 |
| trips | created_by = me OR group_id 소속 | 인증 유저 | created_by = me OR group_id 소속 | created_by = me |
| trip_days | trip 접근 가능자 | trip 접근 가능자 | trip 접근 가능자 | trip 접근 가능자 |
| schedule_items | trip 접근 가능자 | trip 접근 가능자 | trip 접근 가능자 | trip 접근 가능자 |
| expenses | trip 접근 가능자 | trip 접근 가능자 | trip 접근 가능자 | trip 접근 가능자 |
| todos | trip 접근 가능자 | trip 접근 가능자 | trip 접근 가능자 | trip 접근 가능자 |
| records | trip 접근 가능자 | trip 접근 가능자 | trip 접근 가능자 | trip 접근 가능자 |
| guest_shares | trip 접근 가능자 (+ anon via RPC) | trip 접근 가능자 | trip 접근 가능자 | trip 접근 가능자 |
| categories | 기본(all) + 그룹 커스텀(소속자) | 인증 유저 | 생성자 | 생성자 |

"trip 접근 가능자" = `trip.created_by = auth.uid() OR trip.group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid() AND group_id IN (SELECT id FROM groups WHERE status = 'active'))`

profiles RLS 상세:
- 인증 유저: display_name, avatar_url 조회 가능 (이메일은 본인만)
- column-level security 또는 view로 분리

---

## 5. Page Structure & Routing

```
/                          → 랜딩 (비로그인) or /trips 리다이렉트 (로그인)
/login                     → Google 로그인 (Static)
/trips                     → 여행 목록 (Skeleton → Client fetch)
/trips/new                 → 여행 생성
/trips/[tripId]            → 여행 상세 — 탭 기반
  ├─ 일정 탭 (기본)         → List + Map 분할 뷰 (접기/펼치기)
  ├─ 경비 탭               → 날짜별 경비 리스트 + 카테고리 필터
  ├─ Todo 탭               → 체크리스트
  ├─ 기록 탭               → 텍스트 기록 리스트
  └─ 관리 탭               → 파트너 공유 토글, 게스트 URL 관리, 여행 편집/삭제
/settings                  → 전역 설정
  ├─ 프로필                → display_name, avatar 수정
  ├─ 커플 관리             → 초대 코드 생성/연결 해제
  └─ 카테고리 관리          → 일정/경비 커스텀 카테고리
/invite/[code]             → 초대 코드 수락 페이지 (인증 필요)
/share/[token]             → 게스트 조회 (SSR, 인증 불필요)
```

### Rendering per Route

| Route | Rendering | Reason |
|-------|-----------|--------|
| `/`, `/login` | Static (SSG) | 동적 데이터 없음 |
| `/trips`, `/trips/*` | Skeleton → Client fetch | 인증 필요, SEO 불필요, 빠른 쉘 |
| `/settings/*` | Skeleton → Client fetch | 인증 필요 |
| `/invite/[code]` | Skeleton → Client fetch | 인증 필요 |
| `/share/[token]` | SSR | OG 태그, 링크 프리뷰 (카카오톡/슬랙) |

### Navigation

Top AppBar (설정은 우상단 아이콘):
```
┌──────────────────────────┐
│  ← Title            ⚙️  │
├──────────────────────────┤
│                          │
│      메인 콘텐츠          │
│                          │
└──────────────────────────┘
```

여행 상세 내 탭 전환: 일정 | 경비 | Todo | 기록 | 관리

---

## 6. Feature Details

### 6.1 Authentication

- Google Identity Services (GIS)로 클라이언트에서 직접 인증
- Google ID Token → `supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })`
- Supabase가 토큰 검증 → 세션 생성 (Supabase OAuth rate limit 우회)
- 로그인 후 profiles 테이블에 자동 생성 (DB trigger)
- 세션: Supabase JWT (access token 1h, refresh token 자동 갱신)

### 6.2 Group Connection (V1: 커플)

Flow:
1. User A → 설정 > 커플 관리 > "초대 링크 생성" → groups 레코드 생성 (status='pending') + group_members에 A 추가 (role='owner')
2. URL: `/invite/{uuid-token}` 공유
3. User B → 링크 클릭 → 로그인 확인 → 수락
4. group_members에 B 추가 (role='member'), groups.status = 'active'

해제:
- groups.status → 'dissolved'
- trips.group_id → NULL (생성자만 유지, RLS가 자동으로 파트너 접근 차단)
- categories.group_id → NULL

### 6.3 Trip Management

생성 시 입력:
- 제목 (필수)
- 위치 (필수)
- 기간: start_date, end_date (필수)
- 국내/해외 (필수, default: 국내)
- 통화 (해외 시, 복수 선택 가능)

생성 후 자동:
- trip_days bulk INSERT (start_date ~ end_date)
- 그룹 active 상태면 group_id 자동 설정 (파트너 공유 기본 ON)

편집: 생성 항목과 동일. 날짜 변경 시 `resize_trip_days` RPC 호출.
- 축소 시: 확인 다이얼로그 ("Day N의 일정 M개가 마지막 Day로 이동됩니다")
- **편집 UI 패턴**: 관리 탭의 여행 정보 섹션은 제목/목적지/기간을 **읽기 전용 행**으로 나열하고, 섹션 하단의 단일 "여행 정보 수정" 버튼을 통해 전체 필드를 함께 편집한다 (행별 인라인 편집 금지). 필드 간 의존성(기간 축소 → 일정 이동 경고)이 있어 모달 안에서 상태를 함께 보여주어야 일관된다.

삭제: 생성자만 가능. CASCADE로 모든 하위 데이터 삭제.
- 확인 다이얼로그: "파트너의 데이터도 함께 삭제됩니다" 경고 표시

파트너 공유 토글 (관리 탭):
- ON: trips.group_id = 내 active group → 파트너 열람/편집 가능
- OFF: trips.group_id = NULL → 개인 여행 (파트너 접근 불가)
- 그룹 미연결 시 토글 숨김
- 생성자만 토글 가능
- OFF 전환 시 확인: "파트너가 더 이상 이 여행에 접근할 수 없습니다"

### 6.4 Schedule (일정)

View: List + Map 분할 뷰
- 상단: Day Tab (Day 1, Day 2, ...) — 수평 스크롤
- 중단: 지도 (접기/펼치기 가능) — 해당 날짜 일정의 마커 표시, 순서대로 번호
- 하단: 일정 리스트 — 카테고리 컬러 border, 시간, 장소명

CRUD:
- 생성: 제목, 카테고리, 시간(선택), 장소 검색(선택), 메모(선택)
- 장소 검색: 국내 → Naver Maps API, 해외 → Google Maps API
- 편집: 생성 항목과 동일
- 삭제: 확인 후 삭제

⋮ 메뉴 액션:
- 편집
- 다른 날로 이동 → Day 선택
- **경비 추가** → 경비 입력 폼 열림 (제목, 날짜 자동 채움)
- 삭제

Drag & Drop:
- 같은 날 내 순서 변경: long press → 드래그 시작 → 위/아래로 이동하여 순서 변경
- (long press 후 드래그 없이 놓으면 아무 동작 없음 — 드래그와 메뉴는 별도 트리거)
- Optimistic update: UI 즉시 반영, 서버 실패 시 rollback

지도:
- 일자별 일정 순서대로 번호 마커 표시
- 마커 클릭 시 해당 일정 항목으로 스크롤
- 접기/펼치기: 접으면 리스트 전체 화면, 펼치면 상단 지도 + 하단 리스트

### 6.5 Expenses (경비)

- 날짜 기반 기록: expense_date에 실제 지출 날짜 입력 (기본값: 오늘)
- trip_days와 독립 — 여행 날짜 변경의 영향 없음
- 입력: 제목, 금액, 날짜, 통화(해외 시), 카테고리, 결제자(선택), 메모(선택)
- 해외 여행: trips.currencies에 설정된 통화 선택 가능
- 국내 여행: KRW 고정
- 카테고리별 필터 지원

집계 (표시):
- 날짜별 합계: GROUP BY expense_date
- 전체 합계
- 통화별 합계 (해외)
- 환율 변환 없음

### 6.6 Todo

- 여행별 준비 체크리스트
- 입력: 제목, 메모(선택), 담당자(선택)
- 동작: 등록, 완료 토글, 삭제
- 정렬: 미완료 먼저, 그 다음 등록순

### 6.7 Records (기록)

- 여행별 텍스트 기록
- 입력: 제목, 본문(텍스트), 날짜 (앱 UI에서 trip 기간으로 제한)
- CRUD: 등록, 수정, 삭제
- 이번 버전은 텍스트 전용 (사진 없음)

### 6.8 Guest Sharing

- 여행 관리 탭에서 게스트 공유 URL 생성
- 설정: 공개할 항목 선택 (일정, 경비, Todo, 기록)
- URL: `/share/{uuid-token}`
- 게스트: 인증 없이 읽기 전용 조회
- 만료: expires_at 설정 가능 (default: 무기한)
- 비활성화: is_active = false로 즉시 차단
- SSR 렌더링: OG 메타 태그 포함 (링크 프리뷰)
- 데이터 조회: Supabase RPC function (SECURITY DEFINER) — 보안 체크리스트 준수
- **게스트 뷰 하단에 "나도 여행 계획 세우기 →" CTA 배너** (회원 전환 유도)

### 6.9 Member Management

- 프로필 > display_name 설정
- display_name 있으면 앱 전체에서 이름 표시
- 없으면 이메일 표시
- 그룹 파트너 정보: profiles 테이블에서 조회 (인증 유저면 display_name, avatar 접근 가능)

### 6.10 Category Management

기본 카테고리 (시스템 제공):
- 일정: 교통, 관광, 식당, 숙소, 쇼핑, 기타
- 경비: 교통, 숙박, 식비, 쇼핑, 관광, 기타

커스텀 카테고리:
- 사용자가 추가/수정/삭제 가능
- 그룹 내 공유 (group_id 설정)
- 같은 type+name 중복 불가 (유니크 제약)

### 6.11 Real-time Sync

- Supabase Realtime 채널 구독
- 파트너의 CRUD 변경사항 즉시 반영
- 대상 테이블: trips, trip_days, schedule_items, expenses, todos, records
- 동시 편집 충돌: last-write-wins (2명 사용이라 충분)
- TanStack Query 캐시를 Realtime 이벤트로 invalidate

### 6.12 Maps Integration

- 국내 여행 (is_domestic = true): Naver Maps API
- 해외 여행 (is_domestic = false): Google Maps API
- 일정 생성/편집 시: 장소 검색 → 장소 선택 → 좌표 저장
- 일정 뷰: 해당 날짜 일정의 좌표를 지도에 번호 마커로 표시
- 지도 SDK는 일정 탭 진입 시 lazy load

---

## 7. UI/UX Design Direction

### Visual Tone

Cursor 웹사이트에서 영감받은 따뜻한 크림 톤 + 모바일 앱 패턴 보강.
상세 디자인 토큰은 DESIGN.md에 정의 (별도 보강 예정).

핵심 톤:
- 따뜻한 크림 배경 (#f2f1ed 계열)
- 어둡고 따뜻한 텍스트 (#26251e 계열)
- 오렌지 액센트 (#f54e00)
- Pretendard Variable (한글 primary)

### Mobile-First Enhancements (DESIGN.md 보강 항목)

1. **터치 타겟**: 최소 44x44pt (Apple HIG)
2. **Bottom Sheet / Action Sheet**: 모바일 CRUD 입력
3. **Skeleton Loading**: 모든 데이터 로딩 구간
4. **Pull-to-Refresh**: 리스트 화면
5. **Safe Area**: Notch/Dynamic Island 대응
6. **Swipe Gesture**: 일정/경비 아이템 좌측 스와이프 → 삭제

### Micro-interactions (이전 프로젝트 교훈)

- `:active { transform: scale(0.97) }` — 전역 버튼/카드 누름감
- 3단 레이어 섀도우 — 카드 깊이감
- slideUp / fadeIn — 모달/토스트 엔트리 애니메이션
- 드래그 중 lift shadow + 약한 rotate — 들림 감각
- 전역 transition에 `transform 150ms ease` 포함

### Empty State Pattern

모든 빈 화면에 동일 구조 적용:

```
┌──────────────────────────┐
│                          │
│      (아이콘)             │
│                          │
│    안내 텍스트 1줄        │
│    보조 텍스트 1줄        │
│                          │
│    [ CTA 버튼 ]          │
│                          │
└──────────────────────────┘
```

| 화면 | 아이콘 | 안내 | CTA |
|------|--------|------|-----|
| 여행 목록 (0개) | 여행가방 | "아직 여행이 없어요" | "+ 새 여행 만들기" |
| 일정 탭 (0개) | 지도 | "일정을 추가해보세요" | "+ 일정 추가" |
| 경비 탭 (0개) | 지갑 | "경비를 기록해보세요" | "+ 경비 추가" |
| Todo 탭 (0개) | 체크 | "준비할 것을 추가해보세요" | "+ 할 일 추가" |
| 기록 탭 (0개) | 노트 | "여행 기록을 남겨보세요" | "+ 기록 추가" |
| 커플 미연결 | 하트 | "파트너와 함께 계획해보세요 / 혼자서도 모든 기능을 사용할 수 있어요" | "파트너 초대하기" |

### Trip List Grouping

여행 목록을 날짜 기반 computed 그루핑 (DB 변경 없음):

```
여행 목록
──────────────────
진행 중                    ← start_date ≤ 오늘 ≤ end_date
  🟢 Tokyo 2026  4/18-4/22

다가오는 여행               ← start_date > 오늘
  ⏳ Osaka 2026  5/10-5/14

지난 여행                   ← end_date < 오늘
  ✓ Busan 2026   3/1-3/4
──────────────────
```

지난 여행도 편집 가능 유지 (경비 정산, 기록 추가 등).

### Error Handling Pattern

- 에러 시 토스트 알림 (하단 슬라이드업, 3초 자동 닫힘)
- Optimistic update 실패 시 자동 rollback + 토스트 "변경 사항을 저장하지 못했습니다"
- 네트워크 끊김 시 상단 배너 "인터넷 연결을 확인해주세요"

### Schedule View Specifics

```
┌──────────────────────────┐
│  ← Tokyo 2026      ⚙️   │
├──────────────────────────┤
│ [Day 1] [Day 2] [Day 3] │ ← Day Tab (수평 스크롤)
├──────────────────────────┤
│  ┌────────────────────┐  │
│  │    Map (접기/펼치기) │  │ ← 번호 마커, 경로 표시
│  │    ──── handle ──── │  │
│  └────────────────────┘  │
├──────────────────────────┤
│  1. ✈️ Narita Airport    │ ← 일정 리스트
│  2. 🏨 Hotel Check-in    │    카테고리 컬러 border
│  3. 🍜 Ichiran Ramen     │    long press → 드래그 / ⋮ → 메뉴
│                          │
│     [+ Add Schedule]     │
└──────────────────────────┘
```

---

## 8. Folder Structure

Feature 기반 구조 — 기능 추가 시 해당 폴더에 파일만 추가.

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth group
│   │   ├── login/page.tsx
│   │   └── invite/[code]/page.tsx
│   ├── (app)/                    # Authenticated group
│   │   ├── layout.tsx            # AppBar + auth guard
│   │   ├── trips/
│   │   │   ├── page.tsx          # Trip list
│   │   │   ├── loading.tsx       # Skeleton
│   │   │   ├── new/page.tsx      # Trip create
│   │   │   └── [tripId]/
│   │   │       ├── page.tsx      # Trip detail (tabs)
│   │   │       └── loading.tsx   # Skeleton
│   │   └── settings/
│   │       ├── page.tsx
│   │       └── loading.tsx
│   ├── share/[token]/            # Guest (SSR)
│   │   └── page.tsx
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing / redirect
│   └── globals.css
│
├── features/                     # Feature modules
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── queries/
│   ├── trip/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── queries/
│   │   └── utils/
│   ├── schedule/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── queries/
│   │   └── utils/
│   ├── expense/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── queries/
│   │   └── utils/
│   ├── todo/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── queries/
│   ├── record/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── queries/
│   ├── guest/
│   │   ├── components/
│   │   └── queries/
│   ├── group/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── queries/
│   └── category/
│       ├── components/
│       ├── hooks/
│       └── queries/
│
├── shared/                       # Shared infrastructure
│   ├── components/               # 공통 UI (Button, Card, Modal, Skeleton, Toast...)
│   ├── hooks/                    # 공통 hooks (useAuth, useGroup...)
│   ├── lib/
│   │   ├── supabase/             # Supabase client (browser/server)
│   │   ├── query-client.ts       # TanStack Query config
│   │   └── maps/                 # Map SDK wrappers
│   ├── stores/                   # Zustand stores
│   ├── types/                    # Shared TypeScript types
│   ├── constants/                # UI 문자열, 설정값
│   │   └── messages.ts           # UI 텍스트 (i18n 확장 대비)
│   └── utils/                    # 유틸리티 함수
│
├── styles/                       # Design tokens, Tailwind config
│   └── tokens.css
│
└── public/                       # Static assets
    ├── manifest.json             # PWA manifest
    └── sw.js                     # Service worker (Workbox)
```

---

## 9. Implementation Order

기반을 먼저 잡고, 기능을 순서대로 추가. 구조 변경 없이 feature 폴더에 코드만 추가.

| Phase | Feature | Dependencies |
|-------|---------|-------------|
| 1 | 프로젝트 초기화 + 디자인 시스템 토큰 + 공통 컴포넌트 + Empty State 패턴 | - |
| 2 | 인증 (Google GIS + signInWithIdToken) + 프로필 + 레이아웃 | Phase 1 |
| 3 | 여행 CRUD + 멤버 관리 + 그룹 연결 + 파트너 공유 토글 | Phase 2 |
| 4 | 일정 (List + Map, 드래그앤드롭, 지도 연동, 경비 추가 바로가기) | Phase 3 |
| 5 | 경비 (날짜별, 통화별, 카테고리 필터) | Phase 3 |
| 6 | Todo + 기록 | Phase 3 |
| 7 | 게스트 공유 URL (SSR, CTA 배너) | Phase 4-6 |
| 8 | 실시간 동기 (Supabase Realtime) | Phase 4-6 |
| 9 | PWA + 마이크로 인터랙션 폴리시 | Phase 8 |

---

## 10. Design Notes (확장 메모)

### 미디어 확장

사진/미디어 첨부는 V2+ 스코프. 확장 시:
- 별도 `media` 테이블 + polymorphic FK (`entity_type`, `entity_id`)
- Supabase Storage 연동
- records, schedule_items 등에 미디어 연결 가능

### 그룹 확장

V1은 max_members=2 (커플). 확장 시:
- groups.max_members 값만 변경
- group_members에 추가 역할 (admin, viewer 등)
- UI에서 멤버 관리 화면 추가
- RLS policy 변경 불필요 (이미 group_members 기반)
