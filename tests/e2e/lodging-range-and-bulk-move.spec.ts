import { test, expect } from "@playwright/test";
import { seedTripWithItems } from "./helpers/db-seed";

// alice storageState — playwright.config.ts "alice" project

test.describe.configure({ mode: "serial" });

test("숙소 일정을 날짜 범위 전체에 생성한다", async ({ page }) => {
  await page.goto("/trips/new");
  await page.getByLabel("여행 제목").fill("E2E 연박 숙소");
  await page.getByLabel("목적지").fill("Seoul");
  await page.getByLabel("시작일").fill("2026-12-01");
  await page.getByLabel("종료일").fill("2026-12-03");
  await page.getByRole("button", { name: "국내" }).click();
  await page.getByRole("button", { name: "여행 만들기" }).click();

  await expect(page).toHaveURL(
    /\/trips\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
    { timeout: 10_000 },
  );

  await page.getByLabel("일정 추가").click();
  await page.getByRole("radio", { name: "숙소" }).click();
  await page.getByRole("button", { name: "검색 결과가 없나요? 직접 입력" }).click();
  await page.getByLabel("제목").fill("연박 호텔");
  await page.getByLabel("주소").fill("서울 중구 세종대로 1");
  await page.getByLabel("숙소 시작일").selectOption({ label: "Day 1 · 2026-12-01" });
  await page.getByLabel("숙소 종료일").selectOption({ label: "Day 3 · 2026-12-03" });
  await page.getByRole("button", { name: "추가", exact: true }).click();

  await expect(page.getByText("연박 호텔", { exact: true }).first()).toBeVisible({
    timeout: 5_000,
  });

  await page.getByRole("tab", { name: /Day 2/ }).click();
  await expect(page.getByText("연박 호텔", { exact: true }).first()).toBeVisible({
    timeout: 5_000,
  });

  await page.getByRole("tab", { name: /Day 3/ }).click();
  await expect(page.getByText("연박 호텔", { exact: true }).first()).toBeVisible({
    timeout: 5_000,
  });
});

test("선택한 일정 여러 개를 다른 일자로 이동한다", async ({ page }) => {
  const { tripId } = await seedTripWithItems({
    title: "E2E Bulk Schedule Move",
    startDate: "2026-12-10",
    endDate: "2026-12-12",
    isDomestic: true,
    itemsByDay: {
      1: ["Bulk-A", "Bulk-B", "Bulk-C"],
      2: ["Day2-X"],
    },
  });

  await page.goto(`/trips/${tripId}`);
  await expect(page.getByText("Bulk-A", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Bulk-B", { exact: true })).toBeVisible();
  await expect(page.getByText("Bulk-C", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "선택" }).click();
  await page.getByRole("checkbox", { name: "Bulk-A 선택" }).click();
  await page.getByRole("checkbox", { name: "Bulk-B 선택" }).click();
  await page.getByRole("button", { name: "이동" }).click();
  await page.getByRole("button", { name: /Day 2/ }).click();

  await page.getByRole("tab", { name: /Day 2/ }).click();
  await expect(page.getByText("Bulk-A", { exact: true })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText("Bulk-B", { exact: true })).toBeVisible();
  await expect(page.getByText("Day2-X", { exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: /Day 2/ }).click();
  await expect(page.getByText("Bulk-A", { exact: true })).toBeVisible();
  await expect(page.getByText("Bulk-B", { exact: true })).toBeVisible();
});
