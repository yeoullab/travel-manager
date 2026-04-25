import { test, expect } from "@playwright/test";

// alice storageState — playwright.config.ts "alice" project

test.describe.configure({ mode: "serial" });

let tripId = "";

test("일정 → 경비 추가 URL quickAdd → BottomSheet 프리필 → 저장", async ({ page }) => {
  await page.goto("/trips/new");
  await page.getByLabel("여행 제목").fill("E2E Schedule-Expense Link");
  await page.getByLabel("목적지").fill("Seoul");
  await page.getByLabel("시작일").fill("2026-11-01");
  await page.getByLabel("종료일").fill("2026-11-02");
  await page.getByRole("button", { name: "국내" }).click();
  await page.getByRole("button", { name: "여행 만들기" }).click();

  await expect(page).toHaveURL(
    /\/trips\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
    { timeout: 10_000 },
  );
  tripId = page.url().split("/trips/")[1].split("?")[0];

  // 일정 추가 (기타 카테고리)
  await page.getByLabel("일정 추가").click();
  await page.getByRole("radio", { name: "기타" }).click();
  await page.getByLabel("제목").fill("점심 식사");
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.getByText("점심 식사")).toBeVisible({ timeout: 5_000 });

  // 일정 클릭 → 편집 모달 (dialogTitle "일정 (기타)")
  await page.getByText("점심 식사").click();
  await expect(page.getByText(/일정 \(기타\)/)).toBeVisible({ timeout: 5_000 });

  // "이 일정의 경비 추가" 클릭 → URL quickAdd + expenses 탭
  await page.getByRole("button", { name: "이 일정의 경비 추가" }).click();

  // URL 이 ?tab=expenses&quickAdd=scheduleItemId:<uuid> 로 변경됨
  await expect(page).toHaveURL(/tab=expenses/, { timeout: 5_000 });
  await expect(page).toHaveURL(/quickAdd=scheduleItemId[:%][0-9a-fA-F-]+/, { timeout: 5_000 });

  // BottomSheet 가 열리고 제목이 "점심 식사" 로 프리필됨
  await expect(page.getByText("경비 추가", { exact: true })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByLabel("제목")).toHaveValue("점심 식사");

  // 금액만 채우고 저장
  await page.getByLabel("금액").fill("12000");
  await page.getByRole("button", { name: "저장" }).click();

  // 경비 탭에 "점심 식사" 노출
  await expect(page.getByText("점심 식사").first()).toBeVisible({ timeout: 5_000 });

  // URL 에서 quickAdd 제거됨
  await expect(page).not.toHaveURL(/quickAdd=/);
});
