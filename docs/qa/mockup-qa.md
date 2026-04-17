---
type: qa-checklist
project: travel-manager
phase: 0
created: 2026-04-17
scope: 목업 15화면 수동 QA
---

# Phase 0 목업 QA 체크리스트

Preview 환경에서 수동 검증. 모바일 375px(iPhone SE·15), 데스크톱 1280px 이상 두 viewport 기준.

## 0. 배포 공통

- [ ] Preview URL 응답 200
- [ ] `curl -I <url>` → `X-Robots-Tag: noindex` 존재
- [ ] CSP / X-Frame-Options / Permissions-Policy 헤더 존재
- [ ] Lighthouse(모바일) Performance ≥ 80, Accessibility ≥ 90
- [ ] Pretendard 폰트 로드 확인 (한글 렌더링 정상)

## 1. `/` 랜딩

- [ ] Compass 히어로 표시
- [ ] "시작하기" CTA → `/login`
- [ ] `/design` 링크 접근 가능

## 2. `/login`

- [ ] AppBar 뒤로 버튼 → `/`
- [ ] Google G SVG 버튼 클릭 → 750ms 스피너 → `/trips`
- [ ] "목업 모드" 고지 카드 노출

## 3. `/trips`

- [ ] 최초 진입 시 500ms 스켈레톤 연출
- [ ] 진행중 / 다가오는 / 지난 3섹션 그루핑
- [ ] TripCard 각각 tap → `/trips/[id]`
- [ ] FAB → `/trips/new`
- [ ] `?empty=1` → 빈 상태 EmptyState + "여행 추가하기" CTA
- [ ] 빈 상태에서 하단 "샘플 데이터 보기" 링크로 복원
- [ ] 데스크톱(md:) 2-column — 우측 HighlightPanel 노출

## 4. `/trips/new`

- [ ] 제목 / 목적지 입력
- [ ] 시작일 ≤ 종료일 검증 (역순 시 에러)
- [ ] 국내·해외 세그먼트 컨트롤
- [ ] 통화 멀티 칩 선택
- [ ] 저장 버튼 → 토스트 "저장되지 않습니다" 고지 → `/trips`

## 5. `/trips/[id]` — 5탭

공통:
- [ ] AppBar 제목·뒤로·공유 아이콘
- [ ] 하단 BottomTabBar 5탭, `?tab=` 쿼리 동기화
- [ ] 탭 전환 시 URL 변경(뒤로가기로 이전 탭 복원)

### 5a. Schedule (`?tab=schedule`)
- [ ] 스티키 Day 칩 가로 스크롤
- [ ] Day 탭 선택 시 리스트 스크롤 동기화
- [ ] ScheduleItem 번호 마커 ↔ 리스트 번호 일치
- [ ] `?map=open` → 지도 placeholder + 샘플 핀
- [ ] FAB → BottomSheet 추가 폼 (저장 닫힘, 데이터 변화 없음)

### 5b. Expenses (`?tab=expenses`)
- [ ] 통화별 총계 카드
- [ ] 7개 카테고리 필터 칩(단일/복수 선택)
- [ ] 날짜별 그룹 ExpenseRow
- [ ] FAB → BottomSheet 경비 추가 폼

### 5c. Todos (`?tab=todos`)
- [ ] 진행도 바 = 완료/전체
- [ ] 체크박스 tap 시 로컬 상태 반영 (새로고침 시 초기화 OK)
- [ ] 미완료/완료 2섹션 구분
- [ ] 담당자 칩 노출
- [ ] FAB → BottomSheet 할일 추가 폼

### 5d. Records (`?tab=records`)
- [ ] 기록 카드 3줄 프리뷰
- [ ] "펼쳐보기" 토글 시 전체 노출
- [ ] FAB → BottomSheet 기록 추가 폼

### 5e. Manage (`?tab=manage`)
- [ ] 제목·기간·목적지 편집 행
- [ ] 파트너 공유 Switch
- [ ] 게스트 공유 Switch → URL 노출 + "복사" 버튼
- [ ] 복사 → clipboard 확인 + 토스트
- [ ] 커플 해제 → ConfirmDialog → 토스트
- [ ] 여행 삭제 → ConfirmDialog → 토스트

## 6. `/settings`

- [ ] 프로필 카드
- [ ] 프로필 / 파트너 / 카테고리 그룹
- [ ] 로그아웃 → ConfirmDialog → 토스트 → `/`

## 7. `/invite/[code]`

- [ ] `/invite/INVITE-DEMO-CODE` — inviter 프로필 카드 + 수락 ConfirmDialog → 토스트 → `/trips`
- [ ] 무효 코드 (`/invite/abcd`) — "유효하지 않은 초대" 안내

## 8. `/share/[token]`

- [ ] `/share/share_tokyo_demo_token` — Read-only 배너 상단 고정
- [ ] 여행 hero (제목·기간·목적지)
- [ ] `show_schedule` / `show_expenses` / `show_todos` / `show_records` 플래그 섹션
- [ ] ExpenseRow에 `paidByName` **미노출** (PII 마스킹 검증)
- [ ] 하단 오렌지 CTA 배너 → `/login`

## 9. `/design`

- [ ] Color / Typography / Radius / Shadow / Motion 전 팔레트
- [ ] 17종 컴포넌트 variant 전시 정상
- [ ] BottomSheet · ConfirmDialog · Toast 실동작

## 10. 접근성 / 모바일 기본

- [ ] 모든 터치 타겟 44×44pt 이상
- [ ] AppBar · BottomTabBar safe-area 반영 (iOS 노치)
- [ ] 키보드 포커스 이동 자연스러움
- [ ] 본문 대비 WCAG AA (Pretendard 렌더 기준)
- [ ] 다크 모드 렌더 미검증(Phase 0 skip)

## 11. 크로스 브라우저

- [ ] iOS Safari 최신
- [ ] Android Chrome 최신
- [ ] macOS Safari
- [ ] macOS/Windows Chrome

---

## 알려진 허용 오차 (Phase 1에서 해결)

- layout body `env(safe-area-inset-top)` + AppBar safe-area 이중 적용 가능 — 실기기 확인 대기
- Todos 체크 상태 새로고침 시 초기화 (목업 로컬 상태)
- 모든 BottomSheet "저장" = 닫힘만 (mock write 없음)
