import { test, expect } from "@playwright/test";

// alice storageState — playwright.config.ts "alice" project

test.describe.configure({ mode: "serial" });

let tripId = "";

test.describe("일정 CRUD (Spec §2.5)", () => {
  test("trip 생성 → 일정 추가 (장소 없음) → 새로고침 후 persist", async ({ page }) => {
    await page.goto("/trips/new");
    await page.getByLabel("여행 제목").fill("E2E 일정 테스트");
    await page.getByLabel("목적지").fill("Seoul");
    await page.getByLabel("시작일").fill("2026-07-01");
    await page.getByLabel("종료일").fill("2026-07-03");
    await page.getByRole("button", { name: "국내" }).click();
    await page.getByRole("button", { name: "여행 만들기" }).click();

    // UUID 패턴으로 매칭 — /trips/new 상태에서 tripId="new" 로 오염 방지
    await expect(page).toHaveURL(
      /\/trips\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
      { timeout: 10_000 },
    );
    tripId = page.url().split("/trips/")[1].split("?")[0];

    await page.getByLabel("일정 추가").click();
    await page.getByLabel("제목").fill("첫 일정");
    await page.getByRole("button", { name: "추가", exact: true }).click();

    await expect(page.getByText("첫 일정")).toBeVisible({ timeout: 5_000 });

    await page.reload();
    await expect(page.getByText("첫 일정")).toBeVisible();
  });

  test("일정 편집 → 삭제 → 새로고침 후 persist", async ({ page }) => {
    await page.goto(`/trips/${tripId}`);

    await page.getByText("첫 일정").click();
    await expect(page.getByText("일정 수정")).toBeVisible({ timeout: 5_000 });
    await page.getByLabel("제목").fill("첫 일정 (수정)");
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByText("첫 일정 (수정)")).toBeVisible({ timeout: 5_000 });

    page.once("dialog", (d) => d.accept());
    await page.getByText("첫 일정 (수정)").click();
    await expect(page.getByText("일정 수정")).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: "삭제" }).click();

    await expect(page.getByText("첫 일정 (수정)")).toHaveCount(0, { timeout: 5_000 });

    await page.reload();
    await expect(page.getByText("첫 일정 (수정)")).toHaveCount(0);
  });
});
