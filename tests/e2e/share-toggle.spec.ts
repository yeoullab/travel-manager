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

// Realtime UPDATE subscription (useTripDetail) 미구현 — 후속 phase 에서 추가 예정
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
      // Bob 이 해당 trip detail 을 열어둔다
      await bob.goto(`/trips/${sharedTripId}`);
      await expect(bob.getByText("공유 여행 E2E")).toBeVisible({ timeout: 7_000 });

      // Alice 가 관리 탭 → 파트너 공유 OFF
      await alice.goto(`/trips/${sharedTripId}?tab=manage`);
      await alice.getByRole("switch").click();

      // ConfirmDialog "파트너 공유를 끌까요?" → 확인
      await expect(alice.getByText("파트너 공유를 끌까요?")).toBeVisible({ timeout: 5_000 });
      await alice.getByRole("button", { name: "확인" }).click();

      // Bob: detail 에서 TripUnavailable 전환
      await expect(
        bob.getByText("파트너와의 연결이 해제되어 이 여행은 더 이상 볼 수 없어요"),
      ).toBeVisible({ timeout: 15_000 });

      // Bob: /trips 목록으로 돌아가면 사라짐
      await bob.goto("/trips");
      await expect(bob.getByText("공유 여행 E2E")).toHaveCount(0, { timeout: 5_000 });
    } finally {
      await aliceCtx.close();
      await bobCtx.close();
    }
  },
);
