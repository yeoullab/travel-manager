import { test, expect, devices } from "@playwright/test";
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

  const map = page.getByLabel("지도", { exact: true });
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

  const map = page.getByLabel("지도", { exact: true });
  const dayTab = page.getByRole("tab", { name: /Day 1/ });
  await expect(map).toBeVisible();
  await expect(dayTab).toBeVisible();

  // Icon-only toggle, no text label.
  await expect(page.getByText("지도 펼치기")).toHaveCount(0);
  await expect(page.getByText("지도 접기")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "지도 접기" })).toBeVisible();

  const mapBox = await map.boundingBox();
  const tabBox = await dayTab.boundingBox();
  expect(mapBox?.height).toBeGreaterThan(160);
  expect(tabBox?.height).toBeLessThanOrEqual(44);

  // Map stays fixed while the schedule list scrolls.
  const scrollPanel = page.getByTestId("schedule-scroll-panel");
  const listRegion = scrollPanel.locator("> div").last();
  const mapTopBefore = (await map.boundingBox())?.y ?? 0;
  await listRegion.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const mapTopAfter = (await map.boundingBox())?.y ?? 0;
  expect(Math.round(mapTopAfter)).toBe(Math.round(mapTopBefore));

  // Resize handle adjusts the map height.
  const handle = page.getByRole("separator", { name: "지도 높이 조절" });
  await expect(handle).toBeVisible();
  const heightBefore = (await map.boundingBox())?.height ?? 0;
  const hb = await handle.boundingBox();
  await page.mouse.move((hb?.x ?? 0) + 5, (hb?.y ?? 0) + 3);
  await page.mouse.down();
  await page.mouse.move((hb?.x ?? 0) + 5, (hb?.y ?? 0) + 80);
  await page.mouse.up();
  const heightAfter = (await map.boundingBox())?.height ?? 0;
  expect(heightAfter).toBeGreaterThan(heightBefore);
});

test("long-pressing a card selects items and moves them to another day", async ({ page }) => {
  const { tripId } = await seedTripWithItems({
    title: "E2E Long Press Move",
    startDate: "2026-12-22",
    endDate: "2026-12-23",
    isDomestic: true,
    itemsByDay: { 1: ["Move-A", "Move-B"], 2: ["Move-Day2"] },
  });

  await page.goto(`/trips/${tripId}`);
  await expect(page.getByText("Move-A", { exact: true })).toBeVisible({ timeout: 10_000 });

  const firstCard = page.getByTestId(/schedule-card-/).filter({ hasText: "Move-A" });
  await firstCard.dispatchEvent("pointerdown", { clientX: 20, clientY: 20, button: 0 });
  await page.waitForTimeout(500);
  await firstCard.dispatchEvent("pointerup");

  await expect(page.getByText("1개 선택")).toBeVisible();
  await page.getByText("Move-B", { exact: true }).click();
  await expect(page.getByText("2개 선택")).toBeVisible();
  await page.getByRole("button", { name: "이동" }).click();
  await page.getByRole("button", { name: /Day 2/ }).click();

  await page.getByRole("tab", { name: /Day 2/ }).click();
  await expect(page.getByText("Move-A", { exact: true })).toBeVisible();
  await expect(page.getByText("Move-B", { exact: true })).toBeVisible();
});

test("long-pressing a card selects items and deletes them", async ({ page }) => {
  const { tripId } = await seedTripWithItems({
    title: "E2E Long Press Delete",
    startDate: "2026-12-24",
    endDate: "2026-12-24",
    isDomestic: true,
    itemsByDay: { 1: ["Delete-A", "Delete-B", "Keep-C"] },
  });

  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(`/trips/${tripId}`);
  await expect(page.getByText("Delete-A", { exact: true })).toBeVisible({ timeout: 10_000 });

  const firstCard = page.getByTestId(/schedule-card-/).filter({ hasText: "Delete-A" });
  await firstCard.dispatchEvent("pointerdown", { clientX: 20, clientY: 20, button: 0 });
  await page.waitForTimeout(500);
  await firstCard.dispatchEvent("pointerup");

  await page.getByText("Delete-B", { exact: true }).click();
  await expect(page.getByText("2개 선택")).toBeVisible();
  await page.getByRole("button", { name: "삭제" }).click();

  await expect(page.getByText("Delete-A", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Delete-B", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Keep-C", { exact: true })).toBeVisible();
});

test("desktop schedule time picker shows AM before PM and saves a 24-hour value", async ({ page }) => {
  const { tripId } = await seedTripWithItems({
    title: "E2E Desktop Time Picker",
    startDate: "2026-12-25",
    endDate: "2026-12-25",
    isDomestic: true,
    itemsByDay: {},
  });

  await page.setViewportSize({ width: 1280, height: 820 });
  await page.goto(`/trips/${tripId}`);
  await page.getByLabel("일정 추가").click();
  await page.getByRole("radio", { name: "기타" }).click();
  await page.getByLabel("제목").fill("시간 저장 테스트");

  const timeGroup = page.getByRole("group", { name: "시간" });
  await expect(timeGroup.getByRole("button", { name: "오전" })).toBeVisible();
  await expect(timeGroup.getByRole("button", { name: "오후" })).toBeVisible();
  const periodLabels = await timeGroup.getByRole("button").allTextContents();
  expect(periodLabels.indexOf("오전")).toBeLessThan(periodLabels.indexOf("오후"));

  await timeGroup.getByRole("button", { name: "오후" }).click();
  await timeGroup.getByLabel("시").selectOption("05");
  await timeGroup.getByLabel("분").selectOption("16");
  await page.getByRole("button", { name: "추가", exact: true }).click();

  await expect(page.getByText("시간 저장 테스트", { exact: true })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText("17:16", { exact: true })).toBeVisible();
});

test("mobile schedule time field keeps the native time input", async ({ browser, baseURL }) => {
  const { tripId } = await seedTripWithItems({
    title: "E2E Mobile Native Time",
    startDate: "2026-12-26",
    endDate: "2026-12-26",
    isDomestic: true,
    itemsByDay: {},
  });

  const ctx = await browser.newContext({
    ...devices["Pixel 5"],
    baseURL,
    storageState: "tests/e2e/.auth/alice.json",
  });
  const page = await ctx.newPage();
  await page.goto(`/trips/${tripId}`);
  await page.getByLabel("일정 추가").click();
  await page.getByRole("radio", { name: "기타" }).click();

  await expect(page.getByRole("button", { name: "오전" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "오후" })).toHaveCount(0);
  await expect(page.getByLabel("시간")).toHaveAttribute("type", "time");
  await ctx.close();
});
