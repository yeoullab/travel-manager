import { test, expect } from "@playwright/test";
import { seedTripWithItems } from "./helpers/db-seed";

test.describe.configure({ mode: "serial" });

test("desktop schedule screen keeps the map visible while the schedule scrolls", async ({ page }) => {
  const { tripId } = await seedTripWithItems({
    title: "E2E Desktop Map Layout",
    startDate: "2026-12-20",
    endDate: "2026-12-20",
    isDomestic: true,
    itemsByDay: {
      1: Array.from({ length: 14 }, (_v, i) => `Layout-${i + 1}`),
    },
  });

  await page.setViewportSize({ width: 1280, height: 820 });
  await page.goto(`/trips/${tripId}`);
  await expect(page.getByText("Layout-1", { exact: true })).toBeVisible({ timeout: 10_000 });

  const map = page.getByLabel("지도").first();
  await expect(map).toBeVisible();
  const before = await map.boundingBox();
  expect(before?.height).toBeGreaterThan(400);

  await page.getByTestId("schedule-scroll-panel").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });

  const after = await map.boundingBox();
  expect(Math.round(after?.y ?? 0)).toBe(Math.round(before?.y ?? 0));
});

test("mobile schedule screen uses a compact day header and larger map area", async ({ page }) => {
  const { tripId } = await seedTripWithItems({
    title: "E2E Mobile Map Layout",
    startDate: "2026-12-21",
    endDate: "2026-12-22",
    isDomestic: true,
    itemsByDay: { 1: ["Mobile-A"] },
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/trips/${tripId}?map=open`);
  await expect(page.getByText("Mobile-A", { exact: true })).toBeVisible({ timeout: 10_000 });

  const map = page.getByLabel("지도").first();
  const dayTab = page.getByRole("tab", { name: /Day 1/ });
  await expect(map).toBeVisible();
  await expect(dayTab).toBeVisible();
  const mapBox = await map.boundingBox();
  const tabBox = await dayTab.boundingBox();
  expect(mapBox?.height).toBeGreaterThan(260);
  expect(tabBox?.height).toBeLessThanOrEqual(44);
  await expect(page.getByText(/번호를 길게 눌러/)).toHaveCount(0);
});
