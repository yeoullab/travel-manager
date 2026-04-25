import { test, expect } from "@playwright/test";

// alice storageState — playwright.config.ts "alice" project

test.describe.configure({ mode: "serial" });

let tripId = "";

test.describe("기록 CRUD (Spec §6.7)", () => {
  test("trip 생성 → 기록 추가 → 편집 → 삭제", async ({ page }) => {
    await page.goto("/trips/new");
    await page.getByLabel("여행 제목").fill("E2E 기록 테스트");
    await page.getByLabel("목적지").fill("Jeju");
    await page.getByLabel("시작일").fill("2026-12-01");
    await page.getByLabel("종료일").fill("2026-12-03");
    await page.getByRole("button", { name: "국내" }).click();
    await page.getByRole("button", { name: "여행 만들기" }).click();

    await expect(page).toHaveURL(
      /\/trips\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
      { timeout: 10_000 },
    );
    tripId = page.url().split("/trips/")[1].split("?")[0];

    await page.goto(`/trips/${tripId}?tab=records`);

    await page.getByRole("button", { name: "기록 추가" }).first().click();
    await expect(page.getByText("기록 추가", { exact: true })).toBeVisible({ timeout: 5_000 });
    await page.getByLabel("제목").fill("첫날 메모");
    await page.getByLabel("날짜").fill("2026-12-01");
    await page.getByLabel("내용").fill("한라산에 오름.");
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByText("첫날 메모")).toBeVisible({ timeout: 5_000 });

    // 편집
    await page.getByText("첫날 메모").click();
    await expect(page.getByText("기록 수정")).toBeVisible({ timeout: 5_000 });
    await page.getByLabel("제목").fill("첫날 메모 (수정)");
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByText("첫날 메모 (수정)")).toBeVisible({ timeout: 5_000 });

    // 삭제
    await page.getByText("첫날 메모 (수정)").click();
    await expect(page.getByText("기록 수정")).toBeVisible({ timeout: 5_000 });
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "삭제" }).click();
    await expect(page.getByText("첫날 메모 (수정)")).toHaveCount(0, { timeout: 5_000 });
  });

  test("여행 기간 외 날짜 입력 시 에러 노출 (날짜 경계)", async ({ page }) => {
    await page.goto(`/trips/${tripId}?tab=records`);

    await page.getByRole("button", { name: "기록 추가" }).first().click();
    await expect(page.getByText("기록 추가", { exact: true })).toBeVisible({ timeout: 5_000 });
    await page.getByLabel("제목").fill("범위 외 기록");
    // trip: 2026-12-01 ~ 2026-12-03 → 2026-12-04 는 out-of-range
    await page.getByLabel("날짜").fill("2026-12-04");
    await page.getByLabel("내용").fill("범위 밖");
    await page.getByRole("button", { name: "저장" }).click();

    // 에러 메시지 (zod record-schema: "날짜는 ... 사이여야 해요")
    await expect(page.getByText(/사이여야/).first()).toBeVisible({ timeout: 3_000 });
  });
});
