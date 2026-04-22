import { test, expect } from "@playwright/test";
import { seedTripWithItems } from "./helpers/db-seed";

// alice storageState — playwright.config.ts "alice" project

let tripId = "";

test.beforeAll(async () => {
  const t = await seedTripWithItems({
    title: "카테고리 플로우 E2E",
    destination: "Seoul",
    startDate: "2026-11-01",
    endDate: "2026-11-02",
    isDomestic: true,
    itemsByDay: {},
  });
  tripId = t.tripId;
});

test.describe.configure({ mode: "serial" });

test.describe("카테고리 분기 폼 (Phase 3 갭 복구)", () => {
  test("기타 카테고리 → 제목 수동 입력 → 저장", async ({ page }) => {
    await page.goto(`/trips/${tripId}`);
    await page.getByLabel("일정 추가").click();

    // Stage 1: category_select
    await expect(page.getByRole("radiogroup", { name: "카테고리 선택" })).toBeVisible();
    await page.getByRole("radio", { name: "기타" }).click();

    // Stage 2: other_form — 제목 필드 노출
    await expect(page.getByLabel("제목")).toBeVisible();
    await page.getByLabel("제목").fill("기타 카테고리 일정");
    await page.getByRole("button", { name: "추가", exact: true }).click();

    await expect(page.getByText("기타 카테고리 일정")).toBeVisible({ timeout: 5_000 });
  });

  test("식당 카테고리 → 직접 입력 → 주소 + 제목 저장", async ({ page }) => {
    await page.goto(`/trips/${tripId}`);
    await page.getByLabel("일정 추가").click();

    await page.getByRole("radio", { name: "식당" }).click();

    // Stage 3: place_search — "직접 입력" 버튼 노출 (place 선택 안 함)
    const manualBtn = page.getByRole("button", { name: /직접 입력/ });
    await expect(manualBtn).toBeVisible();
    await manualBtn.click();

    // Stage 4: manual_place — 제목 + 주소 수동
    await page.getByLabel("제목").fill("이름 모를 식당");
    await page.getByLabel("주소").fill("서울시 강남구");
    await page.getByRole("button", { name: "추가", exact: true }).click();

    await expect(page.getByText("이름 모를 식당")).toBeVisible({ timeout: 5_000 });
  });

  test("편집 모드 — 식당 일정은 place_search stage 로 초기화", async ({ page }) => {
    await page.goto(`/trips/${tripId}`);
    // 앞 테스트에서 만든 "이름 모를 식당" 탭
    await page.getByText("이름 모를 식당").click();
    await expect(page.getByText(/일정 \(식당/)).toBeVisible({ timeout: 5_000 });
    // 카테고리 변경 버튼 노출 확인
    await expect(page.getByRole("button", { name: "카테고리 변경" })).toBeVisible();
  });
});
