import { test, expect } from "@playwright/test";

// alice storageState — playwright.config.ts "alice" project

test.describe.configure({ mode: "serial" });

let tripId = "";

test.describe("할 일 CRUD (Spec §6.6)", () => {
  test("trip 생성 → 할 일 2개 추가 → 진행도 카드 노출", async ({ page }) => {
    await page.goto("/trips/new");
    await page.getByLabel("여행 제목").fill("E2E 할 일 테스트");
    await page.getByLabel("목적지").fill("Seoul");
    await page.getByLabel("시작일").fill("2026-11-05");
    await page.getByLabel("종료일").fill("2026-11-06");
    await page.getByRole("button", { name: "국내" }).click();
    await page.getByRole("button", { name: "여행 만들기" }).click();

    await expect(page).toHaveURL(
      /\/trips\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
      { timeout: 10_000 },
    );
    tripId = page.url().split("/trips/")[1].split("?")[0];

    await page.goto(`/trips/${tripId}?tab=todos`);
    // 빈 상태에서 FAB 또는 CTA 버튼
    await page.getByRole("button", { name: "할 일 추가" }).first().click();
    await expect(page.getByText("할 일 추가", { exact: true })).toBeVisible({ timeout: 5_000 });
    await page.getByLabel("제목").fill("환전하기");
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByText("환전하기")).toBeVisible({ timeout: 5_000 });

    await page.getByRole("button", { name: "할 일 추가" }).first().click();
    await page.getByLabel("제목").fill("여권 챙기기");
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByText("여권 챙기기")).toBeVisible({ timeout: 5_000 });

    // 진행도 카드 — "해야 할 일" 섹션 보임
    await expect(page.getByText("해야 할 일")).toBeVisible();
  });

  test("체크박스 토글 → 완료 섹션으로 이동 → 해제 시 복귀", async ({ page }) => {
    await page.goto(`/trips/${tripId}?tab=todos`);
    await expect(page.getByText("환전하기")).toBeVisible({ timeout: 5_000 });

    // "완료 처리" 클릭 → DB write 대기 (aria-label 이 "완료 해제" 로 바뀔 때까지)
    await page.getByRole("button", { name: "완료 처리" }).first().click();
    await expect(page.getByRole("button", { name: "완료 해제" })).toHaveCount(1, {
      timeout: 5_000,
    });

    // "완료" 섹션 노출
    await expect(page.getByText("완료", { exact: true })).toBeVisible();

    // 해제 → "완료 해제" 사라지고 "완료 처리" 만 남음
    await page.getByRole("button", { name: "완료 해제" }).first().click();
    await expect(page.getByRole("button", { name: "완료 해제" })).toHaveCount(0, {
      timeout: 5_000,
    });
    await expect(page.getByText("해야 할 일")).toBeVisible();
  });

  test("할 일 삭제 → 목록 제거", async ({ page }) => {
    await page.goto(`/trips/${tripId}?tab=todos`);
    await expect(page.getByText("환전하기")).toBeVisible({ timeout: 5_000 });

    // 행 본문 클릭으로 edit sheet 열기
    await page.getByText("환전하기").click();
    await expect(page.getByText("할 일 수정")).toBeVisible({ timeout: 5_000 });

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "삭제" }).click();

    await expect(page.getByText("환전하기")).toHaveCount(0, { timeout: 5_000 });
  });
});
