---
type: mockup-review
project: travel-manager
phase: 0
created: 2026-04-17
status: classified
preview-url: https://travel-manager-yeoullab.vercel.app/
---

# Phase 0 목업 피드백 수집

Preview 배포된 15화면을 둘러보며 느낀 점을 자유롭게 기록한다.
수집된 항목은 세션 마지막에 Step 7에서 **즉시 반영 · Phase 1 이월 · V2 이월**로 분류한다.

## 탐색 가이드

1. `/` — 랜딩
2. `/login` — Google 로그인 목업
3. `/trips` — 여행 목록 (`?empty=1`로 빈 상태 전환 가능)
4. `/trips/new` — 새 여행 생성 폼
5. `/trips/[id]` — 5탭 상세 (`?tab=schedule|expenses|todos|records|manage`, `?map=open`)
6. `/settings` — 설정
7. `/invite/INVITE-DEMO-CODE` — 초대 수락 (유효)
8. `/invite/INVALID` — 초대 수락 (무효)
9. `/share/share_tokyo_demo_token` — 게스트 공유 뷰
10. `/design` — 디자인 시스템 참조

## 피드백 항목

> 형식: `- [화면] 내용 — (선택) 심각도: Low/Med/High`

### 플로우 / 정보구조

- 일정은 관련 url, 메모 등을 넣을 수 있으면 좋겠고, 게스트에게 일정 권한이 주어지면 보도록 해야함. : Med
- 여행 세부 내역에서 여행 목록으로 돌아오는 아이콘이 '홈'이나 좀 더 눈에 띄면서 직관적이고, 심미적으로 예쁘면서 깔금하면 좋겠음: Med
- 여행 편집 화면에서 제목, 목적지, 기간 수정 버튼 누르면 각각 동일하게 세 항목을 다 편집할 수 있음. 일관성 없음 제목 클릭시 제목만 수정하거나, 여행 정보 수정 버튼을 하나만 두어야 함. : High
- 경비에 일자별, 항목별 합계도 표시: Med
- 일정 -> 경비 연동 (일정에서 경비 연동 버튼 ) 아마 스펙에 있었던 것 같은데 혹시 몰라서 작성

### 비주얼 / 톤

- 무난 한것 같으면서도 포인트 컬러가 부족함 : Low
- Dark 모드도 있으면 좋겠음. 너무 까만색이 아닌 전반적으로 라인이나 컨텐츠 식별이 용이한 밝은 검정, 회색 계역: Low
- 별칭 나타내는 부분이 컬러칩이면 좋을 듯: Low
- 여행 편집 아이콘이 '공유'로 흔히 사용되는 아이콘임. 여행 편집이나 설정을 뜻하는 아이콘으로 교체 필요: Med
- 대신 그 아이콘은 게스트 링크쪽에 사용하면 좋을 것 같음

### 인터랙션 / 모션

- 일정 눌렀을 때 수정 / 삭제 용이하게

### 카피 / 문구

-

### 접근성 / 터치 타겟 (44×44pt)

-

### 모바일 실기기 (iOS Safari / Android Chrome)

-

### 데스크톱 (md: 2-column)

-

### 기타

-

---

## 분류 (Step 7 — 2026-04-17)

### 즉시 반영 (Phase 0 내, 본 세션에서 처리)

- **#2 뒤로가기 아이콘** — AppBar `ChevronLeft` → `Home` (여행 목록 = 홈 은유, aria-label "여행 목록으로")
- **#5 별칭 컬러칩 (Phase 0 범위)** — Expenses 결제자, Todos 담당자에 profile-color 매핑 (ME=orange / PARTNER=ti-read, 하드코딩). 실제 구현은 Phase 1에서 `profiles.color` 6색 팔레트로 확장 (↓참조)
- **#6 Manage 편집 UX 불일치** — 제목/목적지/기간 행은 읽기 전용, 섹션 하단 단일 "여행 정보 수정" 버튼으로 통합
- **#7 AppBar trailing 공유→편집** — `Share2` → `SlidersHorizontal` (여행 관리 의미. aria-label "여행 관리")
- **#8 Share 아이콘 재활용** — Manage 탭 "게스트 링크" 섹션 `Globe` → `Share2`
- **#10 경비 합계 확장** — 통화별 총계 카드 하단에 **카테고리별 합계**(통화 중첩), 각 날짜 그룹 헤더에 **일자별 합계**

### 스펙 반영 (문서 업데이트 — 본 세션에서 처리)

- **#1 일정 URL 필드** — `schedule_items.url` 컬럼 추가 (https?:// only, 앱 검증). 메모(`memo`)는 이미 존재.
- **#1 게스트 일정 권한** — `guest_shares.show_schedule` 이미 `default true` 로 존재. 추가 작업 없음.
- **#11 일정 → 경비 연동** — `expenses.schedule_item_id` FK(nullable, ON DELETE SET NULL) 추가. §342, aggregation 섹션, 인덱스 갱신.
- **#6 Manage 편집 패턴** — 스펙 §6.3에 "읽기 전용 행 + 단일 수정 버튼" 규칙 명시.

### Phase 1 이월 (구현 단계에서 처리)

- **#3 포인트 컬러 부족** — 실기기에서 Pretendard 렌더 본 뒤 FAB·CTA·액티브 탭 포인트 강화 검토. (별칭 컬러칩 #5가 일부 해소)
- **#5 프로필 컬러 V1 구현** — `profiles.color` (NOT NULL, CHECK 6색, default orange) 추가. `/settings` 프로필 편집에서 팔레트 중 선택. `lib/profile-colors.ts` 하드코딩을 DB 조회로 교체.
- **#9 일정 수정/삭제 인터랙션** — SwipeAction 또는 long-press 메뉴. 실데이터 CRUD와 함께 구현.

### V2 이월 (향후 버전)

- **#4 다크 모드** — 토큰 dark variant 설계 비용 큼. Phase 1~3 우선순위 밀림. "밝은 검정 / 회색 계열" 요청 반영 시 별도 다크 팔레트 수립 필요.
- **#11 일정 ↔ 경비 UI 플로우** — 스펙에는 반영, UI는 Phase 3+ 데이터 연동 단계에서 구체화 (일정 상세의 "경비 연동" 버튼, 경비 상세의 연결 해제 등).
