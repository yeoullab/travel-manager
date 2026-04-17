# travel-manager

# 문서 저장 규칙 (중요)

**모든 설계·리뷰·QA·계획 관련 문서는 이 프로젝트의 `docs/` 디렉터리에 저장한다.**
코드와 같은 저장소에서 한 번에 찾아볼 수 있어야 한다. 위키(MY_AI_WIKI)는
**세션 로그·프로젝트 상태·ADR 목차** 같은 메타 관리 용도이고, **실제 설계 산출물
원본은 이 프로젝트의 docs/에 둔다.** 위키에서는 링크로만 참조한다.

## docs/ 폴더 구조

| 경로 | 용도 | 예시 파일 |
|------|------|-----------|
| `docs/specs/` | 요구사항·기능 스펙 | `2026-04-16-travel-manager-design.md` |
| `docs/plans/` | Phase별 구현 계획 | `phase-0-mockup.md`, `phase-1-auth.md` |
| `docs/reviews/` | 설계·코드·보안·UX 리뷰 기록 | `2026-04-17-spec-5view-review.md` |
| `docs/qa/` | QA 체크리스트·E2E 시나리오·시각 회귀 기준 | `mockup-qa.md`, `e2e-scenarios.md` |
| `docs/design/` | 디자인 시스템 (DESIGN.md 등) | `DESIGN.md`, `tokens.md` |
| `docs/decisions/` | 프로젝트 내부 ADR (위키 ADR 링크·경량 복제) | `001-monorepo.md` |
| `docs/mockup/` | 목업 산출물·스크린샷·리뷰 | `mockup-review.md` |

## 작업 원칙

- 새 설계·리뷰·QA·계획 문서를 **생성할 때는 반드시 docs/ 하위 규정 폴더에 배치한다.**
  ad-hoc 경로(프로젝트 루트, `.claude/`, 기타)에 저장 금지.
- 파일명 규칙:
  - 날짜 있는 문서: `YYYY-MM-DD-kebab-case-title.md`
  - 범용 문서: `kebab-case-title.md`
- 프로젝트 루트에는 `README.md`, `CLAUDE.md`, `package.json` 류 표준 파일만 허용.
- Plan mode 사용 시 최종 plan은 `docs/plans/`에도 사본을 저장한다.
  (Plan mode 기본 경로 `~/.claude/plans/`는 작업용 임시이며, 공식 원본은 docs/plans/)
- 기존 `DESIGN.md`(프로젝트 루트)와 `docs/superpowers/specs/` 경로는 호환 유지.
  **신규 문서는 모두 위 표 구조를 따른다.** 이후 점진적으로 신구조로 이관.

## 문서 작성 시 체크리스트

- [ ] 올바른 `docs/` 하위 폴더에 저장했는가?
- [ ] 파일명이 kebab-case이고, 날짜 문서면 `YYYY-MM-DD-` 접두사가 있는가?
- [ ] 상단에 YAML frontmatter(필요 시)로 `type`, `date`, `author` 등을 명시했는가?
- [ ] 위키에 링크가 필요한 경우, 위키의 해당 페이지에서 이 경로를 참조하도록 링크를 추가했는가?

---

# Wiki Integration

이 프로젝트의 지식은 Obsidian 위키에서 관리된다.

- **Wiki 경로:** /Users/sh/Library/CloudStorage/SynologyDrive-home/앱/MY_AI_WIKI
- **프로젝트 위키:** /Users/sh/Library/CloudStorage/SynologyDrive-home/앱/MY_AI_WIKI/projects/travel-manager
- **위키 인덱스:** /Users/sh/Library/CloudStorage/SynologyDrive-home/앱/MY_AI_WIKI/_meta/index.md
- **횡단 지식:** /Users/sh/Library/CloudStorage/SynologyDrive-home/앱/MY_AI_WIKI/knowledge/

**위키와 docs/의 역할 분담:**
- **docs/** — 설계 산출물의 **원본** (스펙·계획·리뷰·QA·디자인 시스템)
- **위키** — **메타**(세션 로그, 프로젝트 상태, ADR 목차, 횡단 지식). 설계 원본은 docs/ 링크로 참조.

## 위키 커맨드

| 커맨드 | 용도 |
|--------|------|
| `/wiki-start` | 세션 시작 — 상태 파악, 맥락 복원 |
| `/wiki-end` | 세션 종료 — 로그 작성, 상태 갱신 |
| `/wiki-decision` | 의사결정 ADR 기록 |
| `/wiki-issue` | 문제 해결 기록 |
| `/wiki-lint` | 위키 건강 점검 |

## 자동 수행 규칙

- 아키텍처 변경 시 → 위키 overview.md, architecture.md 갱신 + 원본은 docs/ 반영
- 새 기술 도입 시 → knowledge/tools/ 페이지 확인 및 갱신
- 버그 해결 시 → 범용적이면 knowledge/troubleshooting/에도 기록
- **설계·리뷰·QA·계획 문서 생성 시 → 반드시 docs/ 하위 규정 폴더에 저장**
