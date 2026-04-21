---
type: qa-checklist
project: travel-manager
phase: phase-3
created: 2026-04-21
author: yeoullab
owner-account: yeoullab.biz@gmail.com
partner-account: sherryjeon@gmail.com
applies-to-tag: phase-3-schedule-map
---

# Phase 3 — Manual E2E Checklist (Schedule + Map)

**작성일:** 2026-04-21
**적용 tag:** `phase-3-schedule-map`
**수행 환경:** 로컬 `pnpm dev` 또는 Vercel preview. 실 Google 계정 2개 필요.

## 테스트 계정

| 역할 | 이메일 | 브라우저 |
|------|--------|----------|
| **Alice (Owner)** | `yeoullab.biz@gmail.com` | 일반 Chrome 창 |
| **Bob (Partner)** | `sherryjeon@gmail.com` | 시크릿 창 또는 별도 Chrome 프로필 |

두 브라우저 세션을 동시에 열어 놓고 진행한다.

## 선결 조건

- [ ] `pnpm dev` 가 `http://localhost:3000` 에서 떠 있음
- [ ] `.env.local` 에 아래 키 전부 세팅됨:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
  - `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID`
  - `NAVER_SEARCH_CLIENT_ID`, `NAVER_SEARCH_CLIENT_SECRET`
  - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_SERVER_KEY`
- [ ] Supabase 마이그레이션 0005/0006/0007 적용 완료 (`schedule_items`, RPC 5종, `trips REPLICA IDENTITY FULL`)
- [ ] Alice·Bob 두 계정이 **active 그룹**으로 연결된 상태 (Phase 2 체크리스트 시나리오 1 이미 수행)
- [ ] 국내 trip 1개 (`is_domestic = true`) — Day 3개 이상, schedule_items 3개 이상 사전 생성
- [ ] 해외 trip 1개 (`is_domestic = false`) — Day 1개 이상 사전 생성
- [ ] `/api/test/sign-in` 은 prod 빌드에서 자동 차단됨 (`ALLOW_TEST_SIGNIN != true`) — 로컬 dev 전용
- [ ] DevTools Network 탭, Console 탭 열어 두고 시작

---

## 시나리오 실행 순서

| # | 시나리오 | 핵심 검증 |
|---|---------|----------|
| 1 | Naver 지도 lazy load (국내 trip) | Maps SDK 분기 + CSP |
| 2 | Naver 장소 검색으로 일정 생성 | place-search → 저장 → 마커 |
| 3 | 같은 day 드래그 (3→1 위치) | optimistic reorder + Bob Realtime |
| 4 | 다른 day 드래그 (Day 1 → Day 3) | cross-day move + Bob Realtime |
| 5 | Share-toggle OFF → Bob 자동 전환 | Realtime trips visibility |
| 6 | 해외 trip Google 검색 ("Ichiran") | Google SDK 분기 + AdvancedMarker |
| 7 | Day 4→2 축소 with 일정 | resize v2 + items 합병 |
| 8 | DevTools Console + Network 종합 | 콘솔 에러 0 + WebSocket 4채널 |

각 시나리오는 독립 PASS/FAIL 판정한다. 한 시나리오가 FAIL 이어도 나머지는 계속 실행한다.

---

## 시나리오 1 — Naver 지도 lazy load (국내 trip)

**목적:** 국내 trip에서 Naver Maps SDK만 로드하고 Google SDK는 로드하지 않음을 확인.

- [ ] Alice로 로그인 → 국내 trip (`is_domestic = true`) 진입 → **일정 탭** 선택
- [ ] DevTools Network 탭 → 필터: `maps.js.naver.com`
  - [ ] `https://oapi.map.naver.com/openapi/v3/maps.js` (또는 유사) 스크립트 로드 확인
  - [ ] `maps.googleapis.com` 요청 **없음** 확인
- [ ] 지도 패널에 한국 영역 지도 렌더 (지도 중앙 = 서울 fallback 또는 일정 장소 좌표)
- [ ] DevTools Console → CSP violation 메시지 **0건**

**판정:** `[ ] PASS` `[ ] FAIL`
> FAIL 사유:

---

## 시나리오 2 — Naver 장소 검색으로 일정 생성

**목적:** place-search 흐름 전체 (BottomSheet → 결과 선택 → 저장 → 마커 렌더).

- [ ] 국내 trip 일정 탭에서 **일정 추가** FAB (➕) 탭
- [ ] `ScheduleItemModal` 열림 확인 (타이틀 "일정 추가")
- [ ] **장소 선택** 버튼 탭 → `PlaceSearchSheet` BottomSheet 열림
  - [ ] 검색창에 **"성수동 카페"** 입력
  - [ ] 약 300ms 후 결과 목록 표시 (debounce 동작)
  - [ ] 결과 항목 중 하나 탭
- [ ] BottomSheet 닫히고 모달로 복귀
  - [ ] `place_name` 필드 자동 채워짐
  - [ ] `place_address` 필드 자동 채워짐
  - [ ] (개발자 도구) 모달 내부 hidden input 또는 state에 `lat`, `lng` 값 확인
- [ ] (DevTools Elements) 결과 텍스트에 `<b>`, `<em>` HTML 태그 **없음** 확인 (strip 완료)
- [ ] **저장** 버튼 탭 → 모달 닫힘
- [ ] 일정 목록에 새 카드 렌더
- [ ] 지도 패널에 **"1"** 번 커스텀 마커 표시
- [ ] DevTools Network → `POST /api/maps/search` 응답 200 확인

**판정:** `[ ] PASS` `[ ] FAIL`
> FAIL 사유:

---

## 시나리오 3 — 같은 day 드래그 (3→1 위치)

**목적:** optimistic reorder + Realtime으로 Bob 브라우저에 즉시 반영.

**사전:** 국내 trip의 Day 1에 일정 3개 이상 있어야 함.

- [ ] Alice: Day 1 탭 선택 → 일정 카드 3개 이상 확인
- [ ] Bob: 동일 trip 일정 탭 열어 두기 (두 브라우저 동시 열람)
- [ ] Alice: **3번째 카드**를 약 400ms long-press → 드래그 시작 시각 피드백(카드 transform/shadow 변화) 확인
- [ ] Alice: 1번 위치까지 드래그 → drop
  - [ ] 즉시 [3번, 1번, 2번] 순서로 렌더 (optimistic)
  - [ ] DevTools Network → `reorder_schedule_items_in_day` RPC 호출, 응답 200
- [ ] Bob: 5초 내 동일 순서로 자동 반영 (reload 없이)

**판정:** `[ ] PASS` `[ ] FAIL`
> FAIL 사유:

---

## 시나리오 4 — 다른 day 드래그 (Day 1 → Day 3)

**목적:** cross-day move + 두 day sort_order 재정렬 + Bob Realtime 반영.

**사전:** 국내 trip Day 1에 일정 2개 이상, Day 3 존재.

- [ ] Alice: Day 1 탭 → 첫 번째 카드 long-press → 드래그 시작
- [ ] Alice: Day 3 탭 영역으로 drag (Day tab auto-switch) 또는 Day 3 선택 후 목록 drop
  - [ ] Day 1에서 해당 카드 **제거** 확인
  - [ ] Day 3에 해당 카드 **추가** 확인 (sort_order 연속)
- [ ] DevTools Network → `move_schedule_item_across_days` RPC 호출, 응답 200
- [ ] Bob: 5초 내 Day 1 + Day 3 변경 자동 반영

**판정:** `[ ] PASS` `[ ] FAIL`
> FAIL 사유:

---

## 시나리오 5 — Share-toggle OFF → Bob 자동 전환

**목적:** `trips REPLICA IDENTITY FULL`로 share_with_partner 전이가 Realtime으로 전파됨 확인.

**사전:** 해당 trip이 `share_with_partner = true` (공유 상태).

- [ ] Bob: `/trips` 목록에서 해당 trip 보임 확인
- [ ] Bob: 해당 trip 상세 페이지(`/trips/{id}`) 열어 두기
- [ ] Alice: 해당 trip의 **manage 탭** → **파트너 공유** 토글 OFF
- [ ] Bob `/trips` 목록: 해당 trip이 **5초 내 사라짐** (reload 없이)
- [ ] Bob `/trips/{id}` 상세 화면: `<TripUnavailable />` 컴포넌트로 전환 (URL 유지)
- [ ] Alice: 파트너 공유 토글 **ON** 복원
- [ ] Bob: 목록에 해당 trip 자동 복구, 상세 화면 정상 복귀

**판정:** `[ ] PASS` `[ ] FAIL`
> FAIL 사유:

---

## 시나리오 6 — 해외 trip Google 검색 ("Ichiran")

**목적:** 해외 trip에서 Google Maps SDK만 로드하고 Naver SDK는 로드하지 않음 확인.

- [ ] Alice: 해외 trip (`is_domestic = false`) 진입 → **일정 탭**
- [ ] DevTools Network → 필터 초기화 후 확인:
  - [ ] `maps.googleapis.com/maps/api/js` 스크립트 로드 확인
  - [ ] `oapi.map.naver.com` 요청 **없음** 확인
- [ ] 일정 추가 FAB → **장소 선택** → PlaceSearchSheet
  - [ ] **"Ichiran"** 입력 → 결과 목록 표시 (Google Places New 결과)
  - [ ] 결과 항목 탭 → 모달에 place_name/address/lat/lng 채워짐
- [ ] 저장 → 지도 패널에 마커 렌더
  - [ ] DevTools Console: `google.maps.Marker` 관련 deprecation 경고 **없음** (AdvancedMarkerElement 사용)
- [ ] DevTools Console → CSP violation **0건**

**판정:** `[ ] PASS` `[ ] FAIL`
> FAIL 사유:

---

## 시나리오 7 — Day 4→2 축소 with 일정

**목적:** `resize_trip_days` v2 — Day 3/4 items가 Day 2로 합병, FK 안정, Bob Realtime 반영.

**사전:** 국내 trip Day 4까지 존재, Day 3·4에 schedule_items 각 1개 이상.

- [ ] Alice: 해당 trip의 **manage 탭** → 종료일 변경하여 Day 수를 **4→2**로 축소
- [ ] `DateShrinkConfirm` 다이얼로그 표시:
  - [ ] "일정 N개가 이동돼요" 동적 카피 (N = Day 3+4 items 합계)
  - [ ] **확인** 버튼 탭
- [ ] trip 변경 완료 후 일정 탭 → Day 2 선택:
  - [ ] 이전 Day 3/4 items가 Day 2에 **합병** (sort_order 1~N 연속)
  - [ ] (DevTools) `schedule_items.id` 값이 합병 전과 동일 (FK 안정)
- [ ] DevTools Network → `resize_trip_days` RPC 호출, 응답 200
- [ ] Bob: Day 탭 수 변경 (4→2) + Day 2 items 자동 반영

**판정:** `[ ] PASS` `[ ] FAIL`
> FAIL 사유:

---

## 시나리오 8 — DevTools Console + Network 종합

**목적:** 앱 전반 에러 부재, WebSocket 활성, SDK 분기 전체 확인.

> **이 시나리오는 위 1~7 시나리오 수행 중 및 수행 후 통합 확인이다. 별도 재현 불필요.**

- [ ] **Console 에러/경고 0건** (허용: Realtime 구독 로그, dev HMR 메시지)
- [ ] **CSP violation 0건** (시나리오 1~7 전체 통틀어)
- [ ] Network 탭 WS 필터:
  - [ ] `wss://...supabase.co/realtime/v1/websocket` 연결 **Active**
  - [ ] 채널 4개 활성: `trips`, `group_members`, `groups`, `schedule-items:{tripId}`
- [ ] 국내 trip 시나리오(1·2·3·4·7) 중 `maps.googleapis.com` 요청 **없음**
- [ ] 해외 trip 시나리오(6) 중 `oapi.map.naver.com` 요청 **없음**

**판정:** `[ ] PASS` `[ ] FAIL`
> FAIL 사유:

---

## 발견된 이슈

> 시나리오 수행 중 발견한 버그·예상 외 동작을 아래에 append.

- (수행 후 append)

---

## Verdict

| 시나리오 | 결과 |
|---------|------|
| 1. Naver 지도 lazy load | `[ ] PASS` `[ ] FAIL` |
| 2. Naver 장소 검색으로 일정 생성 | `[ ] PASS` `[ ] FAIL` |
| 3. 같은 day 드래그 | `[ ] PASS` `[ ] FAIL` |
| 4. 다른 day 드래그 | `[ ] PASS` `[ ] FAIL` |
| 5. Share-toggle OFF → Bob 전환 | `[ ] PASS` `[ ] FAIL` |
| 6. 해외 trip Google 검색 | `[ ] PASS` `[ ] FAIL` |
| 7. Day 4→2 축소 with 일정 | `[ ] PASS` `[ ] FAIL` |
| 8. Console + Network 종합 | `[ ] PASS` `[ ] FAIL` |

- [ ] **8/8 PASS → Exit gate A 통과 (Task 26 진행)**
- 담당자: ___
- 수행일: ___
