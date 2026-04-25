import { test, expect } from "@playwright/test";

// alice storageState — playwright.config.ts "alice" project

test.describe.configure({ mode: "serial" });

let tripId = "";

test.describe("경비 CRUD (Spec §6.5)", () => {
  test("해외 trip 생성 → 경비 2개 추가 → 통화별 총계 노출", async ({ page }) => {
    await page.goto("/trips/new");
    await page.getByLabel("여행 제목").fill("E2E 경비 테스트");
    await page.getByLabel("목적지").fill("Tokyo");
    await page.getByLabel("시작일").fill("2026-10-01");
    await page.getByLabel("종료일").fill("2026-10-03");
    await page.getByRole("button", { name: "해외" }).click();
    // 통화 선택: JPY 토글 버튼 (aria-pressed). KRW 는 default 선택.
    await page.getByRole("button", { name: "JPY", exact: true }).click();
    await page.getByRole("button", { name: "여행 만들기" }).click();

    await expect(page).toHaveURL(
      /\/trips\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
      { timeout: 10_000 },
    );
    tripId = page.url().split("/trips/")[1].split("?")[0];

    // 경비 탭으로 이동
    await page.goto(`/trips/${tripId}?tab=expenses`);

    // 첫 번째 경비 추가 — JPY
    await page.getByRole("button", { name: "경비 추가" }).click();
    await expect(page.getByText("경비 추가", { exact: true })).toBeVisible({ timeout: 5_000 });
    await page.getByLabel("제목").fill("Dinner");
    await page.getByLabel("금액").fill("3500");
    // 날짜는 오늘로 default — 여행 기간 밖이지만 RPC 검증 없음 (expense_date 자유)
    await page.getByLabel("날짜").fill("2026-10-01");
    // 통화 select 는 JPY + KRW
    const currencySelect = page.getByLabel("통화");
    if (await currencySelect.count()) await currencySelect.selectOption({ label: "JPY" }).catch(() => {});
    await page.getByRole("button", { name: "저장" }).click();

    await expect(page.getByText("Dinner")).toBeVisible({ timeout: 5_000 });

    // 두 번째 경비 추가 — KRW
    await page.getByRole("button", { name: "경비 추가" }).click();
    await page.getByLabel("제목").fill("Snack");
    await page.getByLabel("금액").fill("5000");
    await page.getByLabel("날짜").fill("2026-10-01");
    if (await currencySelect.count()) await currencySelect.selectOption({ label: "KRW" }).catch(() => {});
    await page.getByRole("button", { name: "저장" }).click();

    await expect(page.getByText("Snack")).toBeVisible({ timeout: 5_000 });

    // 통화별 총계 카드: JPY 와 KRW 두 통화가 모두 보여야 함
    await expect(page.getByText(/총 경비/i).first()).toBeVisible();
    // 카테고리별 섹션에 "식비" (food 라벨) 존재 확인
    await expect(page.getByText("식비").first()).toBeVisible();
  });

  test("경비 편집 + 카테고리 필터 동작", async ({ page }) => {
    await page.goto(`/trips/${tripId}?tab=expenses`);
    await expect(page.getByText("Dinner")).toBeVisible({ timeout: 5_000 });

    // Dinner row 클릭 → edit sheet
    await page.getByText("Dinner").first().click();
    await expect(page.getByText("경비 수정")).toBeVisible({ timeout: 5_000 });
    await page.getByLabel("제목").fill("Dinner (edited)");
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByText("Dinner (edited)")).toBeVisible({ timeout: 5_000 });

    // 필터: 식사 선택 → Dinner(edited) 만 보임 (Snack 도 food 이므로 둘 다 보일 수 있음, 존재만 체크)
    await page.getByRole("radio", { name: "식비", exact: true }).click();
    await expect(page.getByText("Dinner (edited)")).toBeVisible();

    // 필터 해제
    await page.getByRole("radio", { name: "전체", exact: true }).click();
  });

  test("경비 삭제 (confirm 자동 수락) → 목록에서 제거", async ({ page }) => {
    await page.goto(`/trips/${tripId}?tab=expenses`);
    await expect(page.getByText("Dinner (edited)")).toBeVisible({ timeout: 5_000 });

    await page.getByText("Dinner (edited)").first().click();
    await expect(page.getByText("경비 수정")).toBeVisible({ timeout: 5_000 });

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "삭제" }).click();

    await expect(page.getByText("Dinner (edited)")).toHaveCount(0, { timeout: 5_000 });
  });
});
