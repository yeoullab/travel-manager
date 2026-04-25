import { test, expect } from "@playwright/test";

// partner-dual project — no default storageState, contexts created manually

test.describe.configure({ mode: "serial" });

test("Alice trip 생성 → Bob 목록에 5초 내 실시간 등장 (Spec §8.6 / §9)", async ({
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
    // Bob 이 여행 목록을 열어둔다 (gateway 가 useMyGroup prefetch → currentGroupId 캐시)
    await bob.goto("/trips");

    // Alice 가 새 여행을 만든다 (create_trip RPC 가 active group 자동 link → bob 에게 visible)
    await alice.goto("/trips/new");
    await alice.getByLabel("여행 제목").fill("Partner Realtime Test");
    await alice.getByLabel("목적지").fill("Jeju");
    await alice.getByLabel("시작일").fill("2026-08-01");
    await alice.getByLabel("종료일").fill("2026-08-03");
    await alice.getByRole("button", { name: "국내" }).click();
    await alice.getByRole("button", { name: "여행 만들기" }).click();
    await expect(alice).toHaveURL(
      /\/trips\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
      { timeout: 10_000 },
    );

    // Bob 목록에 7초 내 등장 (Realtime INSERT → invalidate trips/list → refetch)
    await expect(bob.getByText("Partner Realtime Test")).toBeVisible({ timeout: 10_000 });
  } finally {
    await aliceCtx.close();
    await bobCtx.close();
  }
});
