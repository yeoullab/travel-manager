import { test, expect } from "@playwright/test";

// alice storageState — playwright.config.ts "alice" project

test.describe.configure({ mode: "serial" });

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

  // 일정 추가 (관광 카테고리)
  await page.getByLabel("일정 추가").click();
  await page.getByRole("radio", { name: "관광" }).click();
  await page.getByRole("button", { name: "검색 결과가 없나요? 직접 입력" }).click();
  await page.getByLabel("제목").fill("남산 전망대");
  await page.getByLabel("주소").fill("서울 용산구 남산공원길 105");
  await page.getByRole("button", { name: "추가", exact: true }).click();
  const scheduleTitle = page.getByText("남산 전망대", { exact: true }).first();
  await expect(scheduleTitle).toBeVisible({ timeout: 5_000 });

  // 일정 클릭 → 편집 모달 (dialogTitle "일정 (관광 · 직접 입력)")
  await scheduleTitle.click();
  await expect(page.getByText(/일정 \(관광/)).toBeVisible({ timeout: 5_000 });

  // "이 일정의 경비 추가" 클릭 → URL quickAdd + expenses 탭
  await page.getByRole("button", { name: "이 일정의 경비 추가" }).click();

  // URL 이 ?tab=expenses&quickAdd=scheduleItemId:<uuid> 로 변경됨
  await expect(page).toHaveURL(/tab=expenses/, { timeout: 5_000 });
  await expect(page).toHaveURL(/quickAdd=scheduleItemId[:%][0-9a-fA-F-]+/, { timeout: 5_000 });

  // BottomSheet 가 열리고 제목/카테고리가 일정에서 프리필됨
  const expenseSheet = page.getByRole("dialog", { name: "경비 추가" });
  await expect(expenseSheet.getByRole("heading", { name: "경비 추가" })).toBeVisible({
    timeout: 5_000,
  });
  await expect(expenseSheet.getByLabel("제목")).toHaveValue("남산 전망대");
  await expect(expenseSheet.getByRole("radio", { name: "관광" })).toHaveAttribute(
    "aria-checked",
    "true",
  );

  // 금액만 채우고 저장
  await page.getByLabel("금액").fill("12000");
  await page.getByRole("button", { name: "저장" }).click();

  // 경비 탭에 "남산 전망대" 노출
  await expect(page.getByText("남산 전망대").first()).toBeVisible({ timeout: 5_000 });

  // URL 에서 quickAdd 제거됨
  await expect(page).not.toHaveURL(/quickAdd=/);
});
