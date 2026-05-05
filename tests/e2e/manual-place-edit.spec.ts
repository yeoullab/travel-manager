import { test, expect } from "@playwright/test";
import { seedTripWithItems } from "./helpers/db-seed";

let tripId = "";

test.beforeAll(async () => {
  const trip = await seedTripWithItems({
    title: "수기 장소 편집 E2E",
    destination: "Seoul",
    startDate: "2026-12-01",
    endDate: "2026-12-02",
    isDomestic: true,
    itemsByDay: {},
  });
  tripId = trip.tripId;
});

test.describe("수기 장소 편집", () => {
  test("수기 주소를 편집 모드에 다시 채우고 저장한다", async ({ page }) => {
    await page.goto(`/trips/${tripId}`);

    await page.getByLabel("일정 추가").click();
    await page.getByRole("radio", { name: "식당" }).click();
    await page.getByRole("button", { name: /직접 입력/ }).click();
    await page.getByLabel("제목").fill("수기 편집 식당");
    await page.getByLabel("주소").fill("서울 중구 을지로 200");
    await page.getByRole("button", { name: "추가", exact: true }).click();

    const createdItem = page.getByRole("listitem").filter({ hasText: "수기 편집 식당" });
    await expect(createdItem).toBeVisible({ timeout: 5_000 });

    await createdItem.click();
    await expect(page.getByText(/일정 \(식당 · 직접 입력\)/)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByLabel("주소")).toHaveValue("서울 중구 을지로 200");

    await page.getByLabel("제목").fill("수기 편집 식당 수정");
    await page.getByLabel("주소").fill("서울 중구 을지로 300");
    await page.getByRole("button", { name: "저장" }).click();

    const updatedItem = page.getByRole("listitem").filter({ hasText: "수기 편집 식당 수정" });
    await expect(updatedItem).toBeVisible({ timeout: 5_000 });

    await updatedItem.click();
    await expect(page.getByText(/일정 \(식당 · 직접 입력\)/)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByLabel("주소")).toHaveValue("서울 중구 을지로 300");
  });
});
