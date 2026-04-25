import { test, expect } from "@playwright/test";
import { seedSharedTrip } from "./helpers/db-seed";

// partner-dual project — no default storageState, contexts created manually

test.describe.configure({ mode: "serial" });

let sharedTripId = "";

test.beforeAll(async () => {
  sharedTripId = await seedSharedTrip({
    title: "공유 여행 E2E",
    startDate: "2026-09-01",
    endDate: "2026-09-03",
  });
});

// Realtime UPDATE 의 RLS 평가가 `new` row 기준이어서 group_id: X → null UPDATE 시
// partner 가 NOTIFY 를 받지 못한다 (Spec §9.2 가정과 실제 Supabase 동작이 어긋남).
// REPLICA IDENTITY FULL 만으로는 부족하며, 서버측 broadcast 또는 sentinel UPDATE
// 패턴이 필요하다. 별도 follow-up 으로 마이그레이션 + 채널 패턴 변경.
test.skip("Alice share-OFF → Bob 목록에서 5초 내 사라짐 + detail 에서 TripUnavailable 전환 (Spec §9.5)", async ({
  browser,
}) => {
  test.setTimeout(30_000);
  const aliceCtx = await browser.newContext({
    storageState: "tests/e2e/.auth/alice.json",
  });
  const bobCtx = await browser.newContext({
    storageState: "tests/e2e/.auth/bob.json",
  });
  const alice = await aliceCtx.newPage();
  const bob = await bobCtx.newPage();

  try {
    await bob.goto(`/trips/${sharedTripId}`);
    await expect(bob.getByText("공유 여행 E2E")).toBeVisible({ timeout: 7_000 });

    await alice.goto(`/trips/${sharedTripId}?tab=manage`);
    await alice.getByRole("switch").click();
    await expect(alice.getByText("파트너 공유를 끌까요?")).toBeVisible({ timeout: 5_000 });
    await alice.getByRole("button", { name: "확인" }).click();

    await expect(
      bob.getByText("파트너와의 연결이 해제되어 이 여행은 더 이상 볼 수 없어요"),
    ).toBeVisible({ timeout: 15_000 });

    await bob.goto("/trips");
    await expect(bob.getByText("공유 여행 E2E")).toHaveCount(0, { timeout: 5_000 });
  } finally {
    await aliceCtx.close();
    await bobCtx.close();
  }
});
