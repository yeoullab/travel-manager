# docs/

travel-manager 프로젝트의 **설계·계획·리뷰·QA 문서 원본**이 모여 있는 곳.

## 폴더 구조

| 폴더 | 용도 |
|------|------|
| [specs/](./specs/) | 요구사항·기능 스펙 (제품 요구 정의) |
| [plans/](./plans/) | Phase별 구현 계획 |
| [reviews/](./reviews/) | 설계·코드·보안·UX 리뷰 기록 |
| [qa/](./qa/) | QA 체크리스트·E2E 시나리오·시각 회귀 기준 |
| [design/](./design/) | 디자인 시스템 (DESIGN.md, 토큰, 컴포넌트 가이드) |
| [decisions/](./decisions/) | 프로젝트 내부 ADR |
| [mockup/](./mockup/) | 목업 산출물·피드백 리뷰 |
| [superpowers/](./superpowers/) | (legacy) superpowers 스킬 생성 문서. 신규 문서는 위 구조를 따른다. |

## 파일명 규칙

- 날짜 있는 문서: `YYYY-MM-DD-kebab-case-title.md`
  (예: `2026-04-17-implementation-plan.md`)
- 범용 문서: `kebab-case-title.md`
  (예: `mockup-qa.md`, `DESIGN.md`)

## 위키(MY_AI_WIKI)와의 관계

- **docs/** — 설계 산출물의 **원본** (단일 진실 공급원)
- **위키** — 세션 로그·프로젝트 상태·ADR 목차 등 **메타**. 설계 원본은 docs/ 링크로 참조.

자세한 규칙은 [CLAUDE.md](../CLAUDE.md#문서-저장-규칙-중요) 참고.
