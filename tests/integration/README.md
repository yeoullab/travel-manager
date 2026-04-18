# Integration tests

실제 Supabase와 통신하는 통합 테스트. 로컬에서는 dev 프로젝트, CI에서는 dedicated test 프로젝트 권장.

## 실행

```bash
pnpm test:integration
```

`.env.local`에 아래 키가 있어야 한다:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 주의사항

- 임시 유저는 매 실행마다 `beforeAll`에서 생성되고 `afterAll`에서 삭제된다.
  Studio에서 잔존 확인 시 수동 정리.
- `SUPABASE_SERVICE_ROLE_KEY`는 CI secret으로만 주입한다. 레포에 커밋 금지.
- 단위 테스트(`pnpm test`)와 별도 config 사용 — 단위 테스트는 더미 env,
  통합 테스트는 `.env.local`의 실 키.
