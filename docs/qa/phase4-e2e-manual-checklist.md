---
type: qa-checklist
phase: phase-4-expenses-todos-records-guest
project: travel-manager
date: 2026-04-24
depends-on:
  - docs/plans/2026-04-23-phase4-expenses-todos-records-guest.md
  - scripts/phase4-verify.sql
---

# Phase 4 — Manual QA Checklist

Plan `§26` 대응. 외부 의존 (Maps / OAuth) 은 이 phase 범위가 아니므로 전부 자동화 가능 — 그러나 Realtime 효과 확인은 실 브라우저 탭 2개가 필요.

## 0. Pre-flight

- [ ] `.env.local` Supabase URL / anon / service_role 3키 설정
- [ ] 마이그레이션 0010~0016 원격 apply 완료 (`supabase db push --include-all`)
- [ ] DB 타입 regen: `pnpm db:types` → `PostgrestVersion: "12"` 유지 확인
- [ ] `pnpm build` 성공, `/share/[token]` 이 ƒ (Dynamic) 으로 표시
- [ ] 테스트 계정 2개 준비: alice / bob (파트너 연결 완료, 공동 trip 1개 이상)

## 1. 경비 탭 CRUD + 통화 분기

### 1-a. 국내 여행 (is_domestic=true, currencies=[])

- [ ] `/trips/<domestic>?tab=expenses` 진입 → "아직 기록된 경비가 없어요"
- [ ] FAB 클릭 → BottomSheet 오픈
  - [ ] 통화 셀렉트가 **KRW 만 표시** (옵션 1개)
  - [ ] 제목 빈 상태 → "저장" 클릭 시 zod 에러 "제목을 입력해주세요"
  - [ ] 금액 음수 입력 → zod 에러
  - [ ] 금액 1234567 입력 → 포맷 OK
- [ ] 저장 → 리스트 상단에 1건 추가 + "경비를 추가했어요" 토스트
- [ ] 행 탭 → 편집 모드 + 기존 값 프리필
- [ ] 수정 후 저장 → 리스트 반영
- [ ] 편집 모드 "삭제" 버튼 → confirm → 리스트 0건

### 1-b. 해외 여행 (is_domestic=false, currencies=["KRW","JPY"])

- [ ] 통화 셀렉트에 2개 표시
- [ ] 일본 도쿄 trip 생성 후 JPY 로 경비 3건 입력
- [ ] "총 경비 (통화별)" 카드가 KRW+JPY 분리 합계 렌더
- [ ] "카테고리별" 섹션에 식비/교통/숙박/쇼핑/액티비티/기타 그룹화
- [ ] 필터 chip "교통" → 교통 항목만 필터됨
- [ ] 필터 "전체" → 모두 복원

## 2. 일정→경비 quickAdd 흐름

- [ ] 일정 탭에서 기존 일정 탭 → 편집 모달 오픈
- [ ] "이 일정의 경비 추가" 버튼 노출 (편집 모드 only, 생성 모드에는 없음)
- [ ] 클릭 → 모달 닫힘 + URL 이 `/trips/<id>?tab=expenses&quickAdd=scheduleItemId:<uuid>` 로 변경
- [ ] 경비 탭 자동 진입 + BottomSheet 오픈
- [ ] **title 이 일정 title 로 프리필** 확인
- [ ] **expenseDate 이 trip_days.date 로 프리필** 확인
- [ ] 저장 → URL 에서 `quickAdd` 제거 확인 (`router.replace` cleanup)
- [ ] 저장된 expense 의 `schedule_item_id` FK 가 원래 일정 UUID 로 세팅됐는지 Supabase SQL Editor 로 확인
- [ ] 잘못된 UUID 삽입 (`?quickAdd=scheduleItemId:bad`) → BottomSheet 열리지 않음 + URL cleanup

## 3. Todo CRUD + 토글 + 담당자 + 정렬

- [ ] todos-tab 진입 → "할 일이 없어요"
- [ ] FAB → "할 일 추가" sheet → 제목 "환전" + 메모 "500원 권" + 담당자 "공동" → 저장
- [ ] 2번째: "여권 챙기기" + alice 담당
- [ ] 3번째: "보험 가입" + bob 담당
- [ ] 체크박스 alice 항목 토글 → **즉시** 체크 상태 + line-through + "완료" 섹션 이동 (optimistic 확인)
- [ ] 네트워크 탭에서 toggle_todo RPC 호출 확인
- [ ] 정렬: 미완료 "해야 할 일" 상단 · 완료 "완료" 하단
- [ ] 행 본문 탭 → 편집 모달 (title/memo/assignee 프리필)
- [ ] 편집 모드에서 담당자 공동→alice 변경 저장 → chip 업데이트
- [ ] 편집 모드 "삭제" → confirm → 리스트에서 사라짐
- [ ] 체크박스와 행 본문이 **분리된 버튼**임 (nested `<button>` 경고 없음)

## 4. 기록 CRUD + 날짜 경계

- [ ] records-tab 진입 → "기록이 아직 없어요"
- [ ] FAB → "기록 추가" sheet
  - [ ] 날짜 input 의 `min`/`max` 가 trip.start_date ~ trip.end_date 로 설정
  - [ ] 기간 밖 날짜 입력 후 저장 시도 → zod 에러 "날짜는 YYYY-MM-DD ~ YYYY-MM-DD 사이여야 해요"
  - [ ] 내용 빈 상태 → "내용을 입력해주세요"
  - [ ] 내용 20,000자 초과 시 zod 에러 (textarea maxLength=20000 에서 자동 차단)
  - [ ] 내용 카운터 `0 / 20,000자` 실시간 업데이트
- [ ] 유효한 값 저장 → 카드 1건 렌더
- [ ] 3줄 프리뷰 (`line-clamp-3`) + "펼쳐 보기" → 전체 텍스트 + "접기"
- [ ] 제목/날짜 영역 탭 → 편집 모드
- [ ] 삭제 flow 동일 (confirm)

## 5. 게스트 링크 생성 + anon 뷰 + show_* 토글

- [ ] manage-tab 게스트 링크 섹션 — 초기엔 "게스트 링크 생성" 버튼
- [ ] 클릭 → 토큰 생성 → URL `https://.../share/<uuid>` 표시 + 4 visibility 토글
- [ ] 복사 버튼 → "링크를 복사했어요" 토스트 + 클립보드에 URL 복사 확인
- [ ] **새 시크릿 탭 (로그아웃 상태)** 에서 URL 열기:
  - [ ] "Read-only guest view" 배너
  - [ ] trip hero (제목/목적지/기간/국내·해외 뱃지)
  - [ ] 섹션 4종 전부 렌더 (일정/경비/Todo/기록 — show_* 기본 true)
  - [ ] Invite CTA 배너 "travel-manager 시작하기 →"
  - [ ] paid_by 같은 PII 필드 **노출 안 됨** (DevTools → HTML inspect)
- [ ] 원래 탭에서 "경비 표시" 토글 OFF → 시크릿 탭 새로고침 → 경비 섹션 사라짐
- [ ] "일정 표시" OFF 도 동일하게 확인

## 6. 게스트 비활성화 → 404

- [ ] manage-tab "게스트 공유 비활성화" 버튼 클릭 → 2단 ConfirmDialog "비활성화"
- [ ] 시크릿 탭에서 **같은 URL** 새로고침 → `/share/<token>/not-found` 의
      "만료되었거나 존재하지 않는 링크" EmptyState 렌더
- [ ] manage-tab 섹션 UI 가 다시 "게스트 링크 생성" 상태로 복원
- [ ] 새로 "게스트 링크 생성" → **다른 UUID 토큰** 발급 확인 (DB audit: `SELECT token, is_active FROM guest_shares WHERE trip_id=<id>` → 2 row, active=true 1개)

## 7. Realtime — alice ↔ bob 즉시 반영

alice / bob 각각 다른 브라우저 (또는 시크릿 창) 로 동시 로그인, 같은 공유 trip 을 연다.

### 7-a. expenses
- [ ] alice 에서 경비 INSERT → bob 탭에서 **1초 이내** 자동 리스트 반영 (새로고침 없이)
- [ ] bob 에서 UPDATE → alice 반영
- [ ] DELETE 동일

### 7-b. todos
- [ ] alice 체크박스 토글 → bob 화면에 즉시 반영

### 7-c. records
- [ ] alice 기록 추가 → bob 반영

## 8. Verification SQL

`supabase db execute --file scripts/phase4-verify.sql` 실행 (또는 Dashboard SQL Editor 붙여넣기):

- [ ] (1) expenses/todos/records/guest_shares 4행 전부 `relrowsecurity = t`
- [ ] (2) CHECK 수: expenses ≥ 6, todos ≥ 2, records ≥ 2
- [ ] (3) Realtime publication 에 expenses/todos/records 3행
- [ ] (4) get_guest_trip_data 에 anon EXECUTE 1행
- [ ] (5) `expenses_schedule_item_id_fkey` 의 `confdeltype = 'n'` (SET NULL)
- [ ] (6) guest_shares partial unique index 1행 (`WHERE is_active`)

## 9. 자동 게이트 (연속 3회 통과 권장)

```bash
pnpm tsc --noEmit                            # 0 error
pnpm lint                                    # 0 error (기존 warning 유지)
pnpm build                                   # 14+ routes, /share/[token] = ƒ
pnpm vitest run tests/unit                   # all pass
pnpm audit --audit-level=high                # 0 vulnerability
```

> Integration / E2E 는 Phase 4 follow-up 에서 정식화 (Plan Task 21·22). 지금은 수동 체크리스트 + unit + 자동 게이트로 exit.
