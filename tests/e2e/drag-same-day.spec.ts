import { test, expect } from "@playwright/test";
import { seedTripWithItems } from "./helpers/db-seed";

// alice storageState — playwright.config.ts "alice" project

let tripId = "";

test.beforeAll(async () => {
  const result = await seedTripWithItems({
    title: "E2E Drag Same Day",
    startDate: "2026-07-01",
    endDate: "2026-07-03",
    isDomestic: true,
    itemsByDay: { 1: ["A항목", "B항목", "C항목"] },
  });
  tripId = result.tripId;
});

test("같은 day 내 3번째 카드를 1번 위로 드래그 → 순서 반영 + persist (Spec §3.1)", async ({
  page,
}) => {
  await page.goto(`/trips/${tripId}`);

  const items = page.locator('[data-testid^="schedule-card-"]');
  await expect(items).toHaveCount(3, { timeout: 10_000 });

  // 드래그 핸들은 각 카드 왼쪽 번호 버튼(dnd-kit listeners). 카드 본문엔 리스너 없음.
  const handles = page.getByRole("button", { name: /번 일정 지도에서 보기/ });
  const [box0, handle2] = await Promise.all([items.nth(0).boundingBox(), handles.nth(2).boundingBox()]);
  expect(box0 && handle2).toBeTruthy();

  // PointerSensor delay: 400ms → hold 450ms before move. 3번 핸들을 잡고 1번 위치로.
  await page.mouse.move(handle2!.x + handle2!.width / 2, handle2!.y + handle2!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(450);
  await page.mouse.move(box0!.x + box0!.width / 2, box0!.y + 10, { steps: 15 });
  await page.mouse.up();

  // Optimistic update: [C항목, A항목, B항목]
  await expect(items.nth(0)).toContainText("C항목", { timeout: 5_000 });
  await expect(items.nth(1)).toContainText("A항목");
  await expect(items.nth(2)).toContainText("B항목");

  // persist
  await page.reload();
  await expect(items.nth(0)).toContainText("C항목");
});
