---
type: qa-checklist
project: travel-manager
phase: phase-2
created: 2026-04-20
author: yeoullab
owner-account: yeoullab.biz@gmail.com
partner-account: sherryjeon@gmail.com
replaces: "Task 16 E2E auto (Playwright는 Google OAuth 자동화 차단으로 보류)"
---

# Phase 2 — E2E 수동 체크리스트

Playwright E2E 자동화는 Google Identity Services가 automation-controlled 브라우저를 거절해 막혀 있다
(시스템 Chrome channel·Chrome for Testing 모두 차단). Phase 2 exit 기준을
**"5 시나리오 수동 PASS + 기존 Playwright guard 2종 자동 PASS"**로 완화하고,
자동화는 Phase 3 초 별도 세션에서 `auth.admin.createUser` + service_role 기반 storageState
인프라를 구축한 뒤 재개한다.

## 테스트 계정

| 역할 | 이메일 | 브라우저 |
|------|--------|----------|
| **Owner** | `yeoullab.biz@gmail.com` | 일반 Chrome 창 |
| **Partner** | `sherryjeon@gmail.com` | 시크릿 창 또는 별도 Chrome 프로필 |

두 브라우저 세션을 동시에 열어 놓고 진행한다. 시크릿 창은 각 시나리오 사이에 닫지 않는다
(세션 유지를 위해 Realtime 구독 타이밍에 영향).

## 전제

- [ ] `pnpm dev` 가 `http://localhost:3000` 에서 떠 있음
- [ ] `.env.local` 4 키 모두 세팅 (`NEXT_PUBLIC_SUPABASE_URL`, anon, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`)
- [ ] Owner 로 Chrome 일반 창에서 `/login` → Google 로그인 완료 → `/trips` 진입
- [ ] Partner 로 Chrome 시크릿 창에서 `/login` → Google 로그인 완료 → `/trips` 진입
- [ ] **초기 상태**: 두 계정 모두 그룹 미소속(`useMyGroup() == null`). 기존 테스트 데이터가 있으면 Supabase SQL editor에서 다음 쿼리로 정리:
  ```sql
  -- 두 계정의 active/pending 그룹 전부 dissolve
  update public.groups set status = 'dissolved' where created_by in (
    select id from auth.users where email in ('yeoullab.biz@gmail.com', 'sherryjeon@gmail.com')
  );
  delete from public.trips where created_by in (
    select id from auth.users where email in ('yeoullab.biz@gmail.com', 'sherryjeon@gmail.com')
  );
  ```

## 시나리오 실행 순서

1. **초대 플로우** — 두 계정 연결 수립
2. **Trip CRUD** — 생성·편집·삭제 (Owner 단독)
3. **파트너 Realtime** — Owner 생성 → Partner 목록 자동 반영
4. **공유 토글** — Owner OFF → Partner 접근 차단
5. **연결 해제** — Owner dissolve → Partner TripUnavailable (연결 종료이므로 마지막)

각 시나리오는 독립 PASS/FAIL 판정한다. 한 시나리오가 FAIL 이어도 나머지는 계속 실행한다.

---

## 시나리오 1 — 초대 플로우

**목표:** Owner가 초대를 생성하고 Partner가 수락하여 두 계정이 active 그룹으로 연결된다.

### 단계

- [x] **1-1 [Owner]** `/settings/couple` 이동. 초기 상태 "파트너와 함께 여행을 계획해보세요" + `[파트너 초대하기]` 버튼 확인.
- [x] **1-2 [Owner]** `파트너 초대하기` 클릭. invite URL (`/invite/<code>` 형식)이 화면에 표시된다.
- [x] **1-3 [Owner]** invite URL을 복사 (복사 버튼 or 수동 복사).
- [x] **1-4 [Partner]** 시크릿 창 주소창에 복사한 URL 붙여넣고 Enter. 로딩 indicator 후 **10초 이내 `/trips` 로 리다이렉트**.
- [X] **1-5 [Owner]** `/settings/couple` 새로고침. 상태가 "파트너와 연결됨" + `[파트너 연결 해제]`(빨강) 버튼으로 전환된다.
  - Realtime 가이드가 제대로 뿌려졌다면 **새로고침 없이도 8초 이내 자동 전환**돼야 한다. 자동 전환 여부 별도 체크: 
  - [X] Owner 측 Realtime 자동 반영 (8초 이내)

**기대 DB 상태:**
- `groups` row 1개 `status='active'`
- `group_members` 2 rows (owner, partner)

### 결과

- [x] **PASS** · [ ] **FAIL** — 관찰 사항:
  ```
  재시도 통과. 최초 시도에서 두 버그 발견 후 수정 재테스트 PASS:
  - useMyGroup: dissolved group_members 잔존 row 가 groups=null 로 섞여 들어옴
    → `groups!inner(*)` + `joined_at desc` (commit 57ceb46)
  - couple-section: "파트너 = role=member" 가정이 partner 관점에서 자신을 가리킴
    → `user_id !== me.id` 로 교체 (commit 57ceb46)
  Owner 측 realtime 자동 전환(8초 이내) 관찰됨.
  ```

---

## 시나리오 2 — Trip CRUD (Owner 단독)

**목표:** 생성·편집·삭제가 DB에 실제로 반영된다. 이 시나리오는 Partner 참여 없이 Owner 창에서만 진행.

### 단계

- [x] **2-1 [Owner]** `/trips/new` 진입. 폼 노출 확인.
- [ ] **2-2 [Owner]** 입력:
  - 여행 제목: `수동 E2E 여행`
  - 목적지: `서울`
  - 시작일: `2026-08-01`
  - 종료일: `2026-08-03`
  - 국내/해외: `국내` 선택
  - 통화: 기본 선택 유지
- [x] **2-3 [Owner]** `저장` 클릭. **8초 이내 `/trips/<uuid>` 로 이동**.
- [x] **2-4 [Owner]** 상세 페이지 헤더/스케줄 탭에 "수동 E2E 여행" 표시 확인.
- [x] **2-5 [Owner]** `관리` 탭 클릭 → `여행 정보 수정` 버튼 클릭 → BottomSheet 오픈.
- [x] **2-6 [Owner]** 제목을 `수정된 E2E 여행`으로 변경 후 `저장`. BottomSheet 닫히고 관리 탭 "제목" row에 변경값 5초 이내 반영.
- [x] **2-7 [Owner]** `관리` 탭 위험 영역 → `여행 삭제` 클릭. 확인 다이얼로그(`'수정된 E2E 여행'을(를) 삭제하시겠어요?`) 노출.
- [x] **2-8 [Owner]** 다이얼로그에서 `삭제` 클릭. **5초 이내 `/trips` 로 이동**하고 목록에서 해당 여행이 사라진다.

### 결과

- [x] **PASS** · [ ] **FAIL** — 관찰 사항:
  ```
  전 단계 정상. Task 12 에서 누락됐던 manage-tab 실 DB 배선을 이번 세션에 추가
  (commit bc68192: 편집/삭제 컴포넌트·usePartnerShareToggle·useDeleteTrip 연결)
  선행 없었으면 2-5~2-8 단계 FAIL 이었을 것.
  ```

---

## 시나리오 3 — 파트너 Realtime

**목표:** Owner가 여행을 생성하면 Partner의 `/trips` 목록에 **5초 이내** 자동 등장한다.

### 전제

- 시나리오 1 PASS로 그룹 연결이 active.
- 양쪽 창 모두 `/trips` 목록을 열어 둔 상태로 시작.

### 단계

- [x] **3-1 [Partner]** `/trips` 로 이동. 현재 목록 상태 기록(비어 있을 가능성).
- [x] **3-2 [Owner]** 새 탭에서 `/trips/new` 진입 → 입력:
  - 제목: `Realtime 테스트`
  - 목적지: `부산`
  - 시작일: `2026-09-01`
  - 종료일: `2026-09-02`
- [x] **3-3 [Owner]** `저장` 클릭 → `/trips/<uuid>` 이동.
- [ ] **3-4 [Partner]** `/trips` 창을 관찰(새로고침 금지). **5초 이내 "Realtime 테스트" 카드가 자동 등장**.
  - 10초 내 안 뜨면 FAIL. 단, 네트워크 지연 감안해 수동 새로고침으로 확인 후 관찰 메모에 기록.

### 결과

- [x] **PASS** (Realtime 5초 이내) · [ ] **PARTIAL** (새로고침 후 노출) · [ ] **FAIL**
  ```
  최초 시도 FAIL. Partner console 에 CSP violation:
    wss://<supabase>.co/realtime/v1/websocket 연결 차단
    ("connect-src 'self' https://<supabase>.co ..." 에 wss:// 미포함)
  next.config.ts CSP 에 wss:// 스킴 원본 추가 후 dev 재시작 → 재테스트 PASS
  (commit 3455446).
  ```

---

## 시나리오 4 — 파트너 공유 토글 (OFF)

**목표:** Owner가 특정 trip의 파트너 공유를 끄면 Partner는 해당 trip 페이지에서 `TripUnavailable` 를 본다.

### 전제

- 시나리오 1 PASS.
- 시나리오 3 에서 생성한 "Realtime 테스트" 여행(또는 새 공유 여행) 존재.

### 단계

- [x] **4-1 [Partner]** 해당 trip 을 `/trips` 목록에서 클릭 → 정상 상세 페이지 노출 확인 (TripUnavailable 아님).
- [x] **4-2 [Owner]** 동일 trip 의 `/trips/<uuid>?tab=manage` 진입.
- [x] **4-3 [Owner]** "파트너 공유" 섹션 토글 ON 상태 확인 → 클릭하여 OFF 시도 → 확인 다이얼로그 "파트너 공유를 끌까요?" 노출.
- [x] **4-4 [Owner]** `확인` 클릭. 토스트 "파트너 공유가 꺼졌어요" 노출, 토글 시각적으로 OFF.
- [x] **4-5 [Partner]** 상세 페이지 새로고침. `TripUnavailable` 화면 (`파트너와의 연결이 해제되어 이 여행은 더 이상 볼 수 없어요`) 노출.
  - Realtime 자동 반영은 현재 Phase 2 스코프 외(새로고침 필수). 자동 반영 시 보너스 ✓:
  - [ ] Partner 새로고침 없이 자동 TripUnavailable 전환 (5초 이내) — 선택

- [x] **4-6 [Partner]** `/trips` 목록에서도 해당 trip 카드가 사라졌거나 TripUnavailable 상태로 표시되는지 확인.

**기대 DB 상태:** 해당 `trips.group_id = NULL`

### 결과

- [x] **PASS** · [ ] **FAIL** — 관찰 사항:
  ```
  토글 OFF confirm → 토스트 + 시각 전환 정상.
  Partner 새로고침 후 TripUnavailable PASS. 자동 Realtime 전환은 관찰 안 함(선택 항목).
  Partner /trips 목록에서 해당 카드 제거 확인.
  ```

---

## 시나리오 5 — 파트너 연결 해제 (dissolution)

**목표:** Owner가 group dissolve를 트리거하면 Partner가 공유된 trip 들에 대해 TripUnavailable 를 본다.

**이 시나리오는 연결을 종료하므로 마지막에 실행한다.**

### 전제

- 시나리오 1 PASS.
- 공유 여행 하나 이상 존재 (시나리오 3의 "Realtime 테스트" 활용. 시나리오 4에서 OFF 했으면 새 공유 여행 하나 더 생성).

### 단계

- [x] **5-1 [Partner]** 공유 여행 URL(`/trips/<uuid>`)을 열어 둔 상태. 정상 상세 페이지 확인.
- [x] **5-2 [Owner]** `/settings/couple` 이동.
- [x] **5-3 [Owner]** `파트너 연결 해제` 클릭 → 확인 다이얼로그 노출.
- [x] **5-4 [Owner]** 다이얼로그 최종 확인 → 상태가 "파트너와 함께 여행을 계획해보세요" + `[파트너 초대하기]` 로 복귀.
- [x] **5-5 [Partner]** 열어 두었던 trip 창에서 **8초 이내** TripUnavailable 로 자동 전환 (Realtime). 안 뜨면 새로고침 후 TripUnavailable 확인.
- [x] **5-6 [Partner]** `/trips` 목록에서 이전 공유 여행들이 사라진다.

**기대 DB 상태:**
- `groups.status = 'dissolved'`
- 해당 group 연결이었던 `trips.group_id = NULL`
- `group_members` 2 rows 유지 (histor y 보존) — 또는 스펙에 따라 삭제

### 결과

- [x] **PASS** (Realtime 자동 전환) · [ ] **PARTIAL** (새로고침 후 전환) · [ ] **FAIL**
  ```
  Owner 해제 → Partner 측 trip 창이 자동으로 TripUnavailable 전환 확인.
  Partner /trips 목록에서 이전 공유 여행 전부 제거 확인.
  ```

---

## 전체 Summary

| # | 시나리오 | 결과 | 메모 |
|---|---------|------|------|
| 1 | 초대 플로우 | **PASS** | 2 버그 발견·수정 후 재테스트 통과 (useMyGroup inner join, partner 식별 로직) |
| 2 | Trip CRUD | **PASS** | manage-tab 실 DB 배선 선행 후 통과 (Task 12 누락분 보수) |
| 3 | 파트너 Realtime | **PASS** | CSP `wss://` 미허용 발견·수정 후 5초 이내 자동 반영 |
| 4 | 공유 토글 OFF | **PASS** | 새로고침 후 TripUnavailable 통과 (자동 전환은 Phase 3 후보) |
| 5 | 연결 해제 | **PASS** | Realtime 자동 TripUnavailable 전환 관찰됨 |

## Post-test Cleanup

- [x] Supabase SQL editor 에서 테스트 데이터 정리:
  ```sql
  update public.groups set status = 'dissolved' where created_by in (
    select id from auth.users where email in ('yeoullab.biz@gmail.com', 'sherryjeon@gmail.com')
  );
  delete from public.trips where created_by in (
    select id from auth.users where email in ('yeoullab.biz@gmail.com', 'sherryjeon@gmail.com')
  );
  ```

## 발견 이슈 follow-up

이번 QA 에서 surface 된 것들 (모두 이번 세션에 fix 반영됨):

- **fix**: `manage-tab` Phase 0 mock 잔존 → 실 DB 배선 (`bc68192`). Task 12 누락분.
- **fix**: `useMyGroup` embedded filter 비-inner → dissolved group_members 잔존 row 오염 (`57ceb46`).
- **fix**: `couple-section` 파트너 식별이 role 기반 → partner 관점에서 자기 자신 렌더링 (`57ceb46`).
- **fix**: next.config CSP `connect-src` 에 `wss://` 미포함 → Realtime WebSocket 전면 차단 (`3455446`). Phase 1 Task 15 때 누락, Phase 2 에서 first-use 로 드러남.

**Phase 3 후보 follow-up**:

- [ ] 시나리오 4 의 "share toggle OFF 시 partner 측 TripUnavailable 자동 전환" — 현재 새로고침 필요. trips row `UPDATE (group_id: X → null)` 이벤트가 partner RLS 상 `can_access_trip(trip_id)=false` 로 바뀌면 REPLICA IDENTITY FULL + DELETE-like semantic 필요. 설계 ADR 필요.
- [ ] `useFlashToast()` 공용 훅 도입 (settings/couple/profile/manage/invite 5 곳 중복).
- [ ] Playwright 자동 E2E 복귀 — `auth.admin.createUser` + signInWithPassword test helper 기반 storageState 인프라 구축 (Google GIS 우회). Phase 3 초 전용 세션.
