세션 시작 루틴을 수행하라. WIKI 루트는 `/Users/sohyun/Library/CloudStorage/SynologyDrive-home/앱/MY_AI_WIKI` 이고 프로젝트는 `travel-manager` 이다. 아래 `projects/...`, `knowledge/...`, `_meta/...` 경로는 모두 WIKI 기준이다.

1. `projects/travel-manager/handoff.md` 를 읽어 현재 단계와 다음 할 일을 파악하라.
   handoff.md 가 없거나 비어있으면 `projects/travel-manager/status.md` 의 "현재 단계 / 진행 중 / 다음 할 일 / 블로커" 섹션만 읽어라. status.md 전체를 읽지 말 것.

2. `projects/travel-manager/sessions/` 에서 가장 최근 1개 세션 로그의 앞부분만 읽어 직전 맥락을 복원하라.
   더 거슬러 올라가야 할 이유가 있으면 사용자에게 묻고 진행하라. 무차별로 3개 이상 자동 로드하지 말 것.

3. `projects/travel-manager/issues/` 에서 미해결 이슈(`resolved: false`)가 있는지 메타만 확인하라. 본문은 관련 키워드가 맞을 때만 읽어라.

4. 사용자 첫 작업 메시지에 명시적 도구·기술·문제 키워드가 있을 때만 `_meta/index.md` 를 grep 해 관련 knowledge 페이지를 찾고, 매치된 1~2개만 읽어라. `knowledge/` 디렉토리를 무차별 탐색하지 말 것.

5. 첫 작업이 스펙·요구사항·아키텍처·ADR·plan 작업이면 `overview.md` / `architecture.md` / 관련 ADR 의 해당 섹션만 발췌하라. 코드 변경 작업이면 이 단계는 건너뛴다.

6. 현재 상태, 직전 작업 한 줄, 추천 다음 작업을 5줄 이내로 보고하라. 추측·해석 금지. 파일에 없는 정보는 보고하지 말 것.
