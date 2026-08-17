import { test, expect } from "@playwright/test";

// alice storageState — playwright.config.ts "alice" project

test.describe.configure({ mode: "serial" });

const day1Memo =
  "Day 1 긴 메모입니다. 게스트 공유 화면에서 한 줄 말줄임으로 잘리면 안 되고 카드 안에서 자연스럽게 여러 줄로 보여야 합니다.";
const day2Memo =
  "Day 2 긴 메모입니다. 날짜별 구역이 서로 분리되어야 하고 두 번째 날의 메모도 끝까지 읽을 수 있어야 합니다.";

test("게스트 공유 일정은 Day별 섹션과 긴 메모를 읽기 좋게 표시한다", async ({
  page,
  browser,
}) => {
  await page.goto("/trips/new");
  await page.getByLabel("여행 제목").fill("E2E 게스트 가독성");
  await page.getByLabel("목적지").fill("Seoul");
  await page.getByLabel("시작일").fill("2026-12-20");
  await page.getByLabel("종료일").fill("2026-12-21");
  await page.getByRole("button", { name: "국내" }).click();
  await page.getByRole("button", { name: "여행 만들기" }).click();

  await expect(page).toHaveURL(
    /\/trips\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
    { timeout: 10_000 },
  );
  const tripId = page.url().split("/trips/")[1].split("?")[0];

  await page.getByLabel("일정 추가").click();
  await page.getByRole("radio", { name: "기타" }).click();
  await page.getByLabel("제목").fill("Day 1 긴 메모 일정");
  await page.getByLabel("메모").fill(day1Memo);
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.getByText("Day 1 긴 메모 일정", { exact: true })).toBeVisible({ timeout: 5_000 });

  await page.getByRole("tab", { name: /Day 2/ }).click();
  await page.getByLabel("일정 추가").click();
  await page.getByRole("radio", { name: "기타" }).click();
  await page.getByLabel("제목").fill("Day 2 긴 메모 일정");
  await page.getByLabel("메모").fill(day2Memo);
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.getByText("Day 2 긴 메모 일정", { exact: true })).toBeVisible({ timeout: 5_000 });

  await page.goto(`/trips/${tripId}?tab=manage`);
  await page.getByRole("button", { name: "게스트 링크 생성" }).click();

  const scheduleRow = page.locator("div.border-b").filter({ hasText: "일정 표시" }).first();
  const scheduleSwitch = scheduleRow.getByRole("switch");
  await expect(scheduleSwitch).toBeVisible({ timeout: 5_000 });
  if ((await scheduleSwitch.getAttribute("aria-checked")) !== "true") {
    await scheduleSwitch.click();
  }
  await expect(scheduleSwitch).toHaveAttribute("aria-checked", "true", { timeout: 5_000 });

  const urlText = await page
    .locator("p.font-mono")
    .filter({ hasText: /\/share\/[0-9a-f-]{36}/ })
    .first()
    .textContent();
  expect(urlText).toMatch(/\/share\/[0-9a-f-]{36}/);

  const anonCtx = await browser.newContext({ storageState: undefined });
  const anon = await anonCtx.newPage();
  try {
    const path = urlText!.trim().replace(/^https?:\/\/[^/]+/, "");
    await anon.goto(path);

    await expect(
      anon.getByRole("heading", { name: "E2E 게스트 가독성" }).first(),
    ).toBeVisible({ timeout: 7_000 });

    const day1Section = anon.getByRole("region", { name: "Day 1 일정" });
    const day2Section = anon.getByRole("region", { name: "Day 2 일정" });
    await expect(day1Section).toBeVisible();
    await expect(day2Section).toBeVisible();
    await expect(day1Section.getByText(day2Memo)).toHaveCount(0);
    await expect(day2Section.getByText(day1Memo)).toHaveCount(0);

    const day1MemoText = day1Section.getByText(day1Memo);
    const day2MemoText = day2Section.getByText(day2Memo);
    await expect(day1MemoText).toBeVisible();
    await expect(day2MemoText).toBeVisible();
    await expect(day1MemoText).toHaveCSS("white-space", "pre-wrap");
    await expect(day2MemoText).toHaveCSS("white-space", "pre-wrap");
  } finally {
    await anonCtx.close();
  }
});
