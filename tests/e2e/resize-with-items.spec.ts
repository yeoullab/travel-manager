import { test, expect } from "@playwright/test";
import { seedTripWithItems } from "./helpers/db-seed";

// alice storageState — playwright.config.ts "alice" project

let tripId = "";

test.beforeAll(async () => {
  // 4일 trip: Day 3, Day 4 에 각 3개 아이템
  const result = await seedTripWithItems({
    title: "E2E Resize With Items",
    startDate: "2026-07-01",
    endDate: "2026-07-04",
    isDomestic: true,
    itemsByDay: {
      3: ["D3-A", "D3-B", "D3-C"],
      4: ["D4-D", "D4-E", "D4-F"],
    },
  });
  tripId = result.tripId;
});

test("종료일 Day 4→Day 2 축소 → 확인 다이얼로그 → Day 2 에 6개 아이템 합병 (Spec §4)", async ({
  page,
}) => {
    test.setTimeout(30_000);
    await page.goto(`/trips/${tripId}?tab=manage`);

    // 여행 정보 수정 버튼
    await page.getByRole("button", { name: "여행 정보 수정" }).click();

    // 종료일 수정 (Day 4 → Day 2)
    await page.getByLabel("종료일").fill("2026-07-02");
    await page.getByRole("button", { name: /저장|변경|수정/ }).click();

    // DateShrinkConfirm 다이얼로그 — 확인 버튼 클릭
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: /확인|계속/ }).click();

    // 일정 탭 → Day 2 에 6개
    await page.goto(`/trips/${tripId}`);
    const items = page.locator("li[role='button']");
    await expect(items).toHaveCount(6, { timeout: 10_000 });

    // Day 3 버튼은 사라짐
    await expect(page.getByRole("button", { name: "Day 3" })).toHaveCount(0);
  },
);
