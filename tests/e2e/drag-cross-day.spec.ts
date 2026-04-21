import { test, expect } from "@playwright/test";
import { seedTripWithItems } from "./helpers/db-seed";

// alice storageState — playwright.config.ts "alice" project
// Cross-day 이동은 "다른 날로 이동" 모달 경로를 통해 검증 (Spec §3.4 move_schedule_item_across_days)

let tripId = "";

test.beforeAll(async () => {
  const result = await seedTripWithItems({
    title: "E2E Cross Day Move",
    startDate: "2026-07-01",
    endDate: "2026-07-03",
    isDomestic: true,
    itemsByDay: {
      1: ["Day1-A", "Day1-B"],
      2: ["Day2-X"],
    },
  });
  tripId = result.tripId;
});

test.describe("다른 날로 이동 (cross-day, Spec §3.4)", () => {
  test("Day 1 첫 번째 아이템을 Day 2 로 이동 → 양 day 카운트 변경 + persist", async ({
    page,
  }) => {
    await page.goto(`/trips/${tripId}`);

    // Day 1 기본 선택 — 2개 아이템 확인
    const items = page.locator("li[role='button']");
    await expect(items).toHaveCount(2, { timeout: 10_000 });

    // Day1-A 클릭 → 일정 수정 모달
    await page.getByText("Day1-A").click();
    await expect(page.getByText("일정 수정")).toBeVisible({ timeout: 5_000 });

    // "다른 날로 이동" 버튼 클릭
    await page.getByRole("button", { name: "다른 날로 이동" }).click();

    // DayMoveSheet — Day 2 선택
    await page.getByRole("button", { name: /Day 2/ }).click();

    // Day 1 에 1개만 남음
    await expect(items).toHaveCount(1, { timeout: 5_000 });
    await expect(page.getByText("Day1-B")).toBeVisible();

    // Day 2 탭으로 이동 → 2개 (Day1-A + Day2-X)
    await page.getByRole("button", { name: /Day 2/ }).click();
    await expect(items).toHaveCount(2, { timeout: 5_000 });
    await expect(page.getByText("Day1-A")).toBeVisible();

    // persist
    await page.reload();
    await page.getByRole("button", { name: /Day 2/ }).click();
    await expect(page.getByText("Day1-A")).toBeVisible();
  });

  test("같은 trip 내 이동만 허용 — cross-trip 차단은 integration 에서 검증됨", () => {
    test.skip(true, "UI 경로 없음 — integration move-schedule-item-across-days 에서 검증");
  });
});
