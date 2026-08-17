이 프로젝트의 위키 건강 점검을 수행하라. WIKI 루트는 `/Users/sohyun/Library/CloudStorage/SynologyDrive-home/앱/MY_AI_WIKI` 이고 프로젝트는 `travel-manager` 이다.

원칙: grep/메타 스캔 우선, 매치된 파일만 본문 읽기. 정상 파일은 다시 읽지 말 것.

1. 메타 스캔 (본문 읽기 금지):
   - 프론트매터 누락: `grep -L "^type:" projects/travel-manager/**/*.md`, `grep -L "^updated:" projects/travel-manager/**/*.md`
   - 깨진 wikilink: `grep -roh "\[\[[^]|]*" projects/travel-manager/` 결과의 각 대상 파일 존재 여부 확인. 5+ 깨짐이면 사용자에게 우선순위 묻고 진행.
   - 이슈 일관성: `grep -l "^resolved: false" projects/travel-manager/issues/*.md` 결과를 status.md "블로커" 섹션과 대조.
   - 비대화 sentinel: `wc -l` 로 `handoff.md` (80줄 초과 시 압축 권고), `status.md` (500줄 초과 시 아카이브 권고), `_meta/log.md` (5000줄 초과 시 분기/연도별 분리 권고), `_meta/index.md` (200줄 초과 시 catalog 분할 권고).
   - handoff/status 일치: handoff.md "다음 할 일" 첫 항목이 status.md "다음 할 일" 첫 항목과 일치하는지 확인. 어긋나면 보고.

2. 횡단 지식 후보 점검:
   - 직전 세션 로그(`ls -t projects/travel-manager/sessions/2*.md | head -1`)에서 발견된 패턴/문제/도구 키워드를 추출하라.
   - 각 키워드를 `_meta/index.md` 에 grep 해 다른 프로젝트에서도 재현됐는지 확인. 매치 있으면 횡단 지식화 후보로 보고 (knowledge/troubleshooting 또는 knowledge/patterns).

3. `overview.md` stack 필드 (`grep "^stack:" projects/travel-manager/overview.md`) 와 `_meta/index.md` 에 등록된 도구 페이지의 `used-in` 프론트매터를 대조하라. 누락된 프로젝트 또는 잡음(사용도 안 하는데 등록됨) 보고.

4. 1~3 에서 발견된 항목만 본문을 Read 하라. 발견 없으면 "건강함" 보고하고 끝낸다.

5. 발견 사항을 자동 적용 가능 (프론트매터 누락 채우기, 깨진 링크 오타 수정, used-in 누락 추가) 과 판단 필요 (페이지 삭제, 일반화 승격, archive 분할) 로 나누어 보고하라. 동의하면 자동 적용분만 일괄 처리하라.

6. `_meta/log.md` 의 `---` 구분선 바로 아래(가장 최신이 위)에 한 줄 추가:
   `## [YYYY-MM-DD] lint | travel-manager — 발견 N건 / 자동수정 X건 / 보류 Y건`
