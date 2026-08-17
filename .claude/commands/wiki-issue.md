방금 해결한 문제를 위키에 기록하라. WIKI 루트는 `/Users/sohyun/Library/CloudStorage/SynologyDrive-home/앱/MY_AI_WIKI` 이고 프로젝트는 `travel-manager` 이다.

진행 조건: "재발 가능 + 근본 원인 파악 + 해결 검증" 모두 충족. 미충족이면 sessions/ 에 한 단락만 남기고 종료.

1. 슬러그 중복 검사: `ls projects/travel-manager/issues/ | grep -i "<핵심키워드>"`. 매치 있으면 기존 페이지 갱신 (새로 만들지 말 것). 같은 문제의 새 변종은 기존 페이지 "추가 사례" 섹션에 추가.

2. `projects/travel-manager/issues/<슬러그>.md` 에 문제 해결 기록을 생성하라.
   - 형식: `000-template.md` 참조. 증상·환경·시도·근본원인·해결·예방을 모두 채워라.
   - 프론트매터: `resolved: true`, `root-cause: "<한 줄 원인>"`, `tags: [<관련 도구·기술>]`.
   - 시도한 것들은 ❌/✅ 마크로 구분.

3. 이 문제가 2+ 프로젝트에서 재발할 수 있는 범용적 문제라면 `knowledge/troubleshooting/<일반화-슬러그>.md` 에 일반화된 버전을 작성하고, 프로젝트 이슈에서 `[[knowledge/troubleshooting/일반화-슬러그]]` 백링크를 걸라. 첫 발생이면 일반화하지 말 것.

4. 관련 도구의 `knowledge/tools/` 페이지가 있으면 "주의사항 & 알려진 이슈" 섹션에 한 줄 추가하라. 도구 페이지 등록 확인은 `grep -i "<도구명>" _meta/index.md` 로. 미등록이면 만들지 말 것.

5. `_meta/log.md` 의 `---` 구분선 바로 아래(가장 최신이 위)에 한 줄 추가:
   `## [YYYY-MM-DD] issue | travel-manager — <문제 한 줄 요약>`
