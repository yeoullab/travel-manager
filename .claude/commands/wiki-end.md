세션 종료 루틴을 수행하라. WIKI 루트는 `/Users/sohyun/Library/CloudStorage/SynologyDrive-home/앱/MY_AI_WIKI` 이고 프로젝트는 `travel-manager` 이다. 아래 `projects/...`, `knowledge/...`, `_meta/...` 경로는 모두 WIKI 기준이다.

1. 오늘 작업 내용을 `projects/travel-manager/sessions/` 에 세션 로그로 기록하라.
   - 파일명: `YYYY-MM-DD-주제.md` (주제는 핵심 작업을 kebab-case로)
   - `projects/travel-manager/sessions/000-template.md` 형식을 따르라.

2. `projects/travel-manager/status.md` 를 갱신하라. 변경된 줄만 Edit 으로 수정하고 파일 전체를 덮어쓰지 말 것. 프론트매터 `updated:` 는 오늘 날짜로.
   - 완료된 작업을 체크하고 다음 할 일을 업데이트하라.
   - 스펙·요구사항·scope·phase 변경이 있었으면 `projects/travel-manager/overview.md` 의 해당 섹션도 갱신하라.
   - 아키텍처·DB·RLS·Realtime·API·배포·렌더링 전략 변경이 있었으면 `projects/travel-manager/architecture.md` 의 해당 섹션도 갱신하라.
   - status.md 가 500줄을 넘으면 사용자에게 아카이브를 권고하라 (오래된 완료 이력을 sessions/ 또는 status-archive.md 로 이동).

3. 새로운 기술 의사결정이 있었으면:
   - `projects/travel-manager/decisions/` 에 ADR을 작성하라. `000-template.md` 형식, 번호는 기존 최대값 + 1.
   - `overview.md` "주요 의사결정" 섹션에 링크를 추가하라.
   - 시스템 구조·기술 스택·외부 의존성에 영향이 있으면 `architecture.md` "관련 의사결정"에도 추가하라.
   - "선택지 비교 + 결정 + 트레이드오프" 가 모두 있을 때만 ADR. 그렇지 않으면 sessions/ 에 한 단락만 남겨라.

4. 해결한 문제가 있으면 `projects/travel-manager/issues/` 에 기록하라. `000-template.md` 형식.
   - 재발 가능 + 근본 원인 파악 + 해결 검증 된 문제만. 그렇지 않으면 sessions/ 에 한 단락.
   - 슬러그 중복 검사: `ls projects/travel-manager/issues/ | grep -i "<핵심키워드>"`. 매치 있으면 기존 페이지 갱신.

5. 범용적 지식 (다른 프로젝트에서도 쓸 수 있는 것)이 있으면:
   - 도구/기술 → `knowledge/tools/`
   - 패턴 → `knowledge/patterns/`
   - 트러블슈팅 → `knowledge/troubleshooting/`
   - 프롬프팅 팁 → `knowledge/prompting/`

6. `_meta/log.md` 의 `---` 구분선 바로 아래(가장 최신이 위)에 한 줄 추가:
   `## [YYYY-MM-DD] session | travel-manager — <핵심 주제>`

7. 새 페이지를 만들었거나 프로젝트 상태가 의미 있게 바뀌었으면 `_meta/index.md` 를 갱신하라.
   - 신규 knowledge 페이지 → 해당 카테고리 섹션에 한 줄.
   - 프로젝트 행은 "상태 한 줄 + handoff 링크" 로 짧게 유지.

8. `projects/travel-manager/handoff.md` 를 status.md 에서 발췌해 갱신하라. 80줄 이하 유지. 없으면 생성.
   - 섹션: `## 현재 단계` / `## 직전 세션` / `## 진행 중` / `## 다음 할 일` / `## 활성 문서` / `## 반드시 기억할 제약` / `## 블로커`
   - status.md 의 "다음 할 일" 첫 1~3개를 그대로 가져오라. handoff 와 status 가 어긋나지 않게 status 를 진실 소스로 본다.
   - 오래된 내용은 handoff 에 누적하지 말고 status.md 또는 sessions/ 로 이동.

원칙: 1~7 은 OLD wiki-end 와 동일한 단순 트리거다. 8 은 다음 세션 첫 30초용 압축본. status 가 진실 소스, handoff 는 발췌. "있었으면 / 했으면" 트리거에 해당하지 않으면 그 단계는 건너뛴다.
