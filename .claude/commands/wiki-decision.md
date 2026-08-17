방금 논의한 기술 의사결정을 ADR로 기록하라. WIKI 루트는 `/Users/sohyun/Library/CloudStorage/SynologyDrive-home/앱/MY_AI_WIKI` 이고 프로젝트는 `travel-manager` 이다.

진행 조건: "선택지 비교 + 결정 + 트레이드오프" 가 모두 있을 때만. 그렇지 않으면 sessions/ 에 한 단락만 남기고 종료.

1. `projects/travel-manager/decisions/` 의 기존 파일을 확인해서 다음 번호를 결정하라 (`ls decisions/[0-9]*.md | tail -1` → 마지막 + 1).

2. ADR 을 생성하라.
   - 파일: `projects/travel-manager/decisions/NNN-슬러그.md`
   - 형식: `000-template.md` 참조. 맥락·선택지·결정·근거·결과를 모두 채워라.
   - 프론트매터: `status: accepted`, `tags` 채우기.

3. `projects/travel-manager/overview.md` 의 "주요 의사결정" 섹션에 한 줄 링크를 추가하라:
   `- [[decisions/NNN-슬러그|ADR-NNN]] — <한 줄 요지>`

4. 시스템 구조·기술 스택·외부 의존성에 영향이 있으면 `projects/travel-manager/architecture.md` 의 "관련 의사결정"에도 한 줄 추가하라. 코드 스타일·테스트 도구 같은 비아키텍처 결정이면 이 단계는 건너뛴다.

5. 관련 도구/기술의 `knowledge/tools/` 페이지가 있으면 갱신하라. 없는데 2+ 프로젝트에서 사용 중인 도구면 새로 만들라. 1개 프로젝트만 사용하면 만들지 말 것.

6. 이번 ADR 이 다음 세션의 구현 방향·active plan·블로커·재발 방지 제약에 영향을 주면 `projects/travel-manager/handoff.md` 의 "활성 문서" 또는 "반드시 기억할 제약" 에 한 줄만 추가하라. ADR 전체 맥락을 복사하지 말고 링크와 요지만.

7. `_meta/log.md` 의 `---` 구분선 바로 아래(가장 최신이 위)에 한 줄 추가:
   `## [YYYY-MM-DD] decision | travel-manager — ADR-NNN 제목`
