import { test, expect } from "@playwright/test";

// 사용자 alice (storageState alice.json) 로 settings → categories 진입 + 6+6 카테고리 노출 확인.
test("settings → 카테고리 관리 → 일정 6종 + 경비 6종 노출", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "설정" })).toBeVisible();

  await page.getByRole("button", { name: /카테고리 관리/ }).click();
  await page.waitForURL("**/settings/categories");

  await expect(page.getByRole("heading", { name: "카테고리 관리" })).toBeVisible();

  // 일정 섹션 — heading is in a sibling div; use nth(0) section for schedule items
  const scheduleSection = page.locator("section").nth(0);
  await expect(page.getByRole("heading", { name: "일정 카테고리" })).toBeVisible();
  for (const label of ["교통", "관광", "식당", "숙소", "쇼핑", "기타"]) {
    await expect(scheduleSection.getByText(label, { exact: true })).toBeVisible();
  }

  // 경비 섹션 — nth(1) section for expense items
  const expenseSection = page.locator("section").nth(1);
  await expect(page.getByRole("heading", { name: "경비 카테고리" })).toBeVisible();
  for (const label of ["식비", "교통", "숙박", "쇼핑", "관광", "기타"]) {
    await expect(expenseSection.getByText(label, { exact: true })).toBeVisible();
  }
});

test("뒤로가기 → /settings 로 복귀", async ({ page }) => {
  await page.goto("/settings/categories");
  await page.getByRole("button", { name: "뒤로" }).click();
  await page.waitForURL("**/settings");
  await expect(page.getByRole("heading", { name: "설정" })).toBeVisible();
});
