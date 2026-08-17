import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

let tripId = "";

test.describe("후보 일정 플로우", () => {
  test("후보로 등록 → 후보 섹션에 표시, 본 일정 번호에는 없음", async ({ page }) => {
    await page.goto("/trips/new");
    await page.getByLabel("여행 제목").fill("E2E 후보 테스트");
    await page.getByLabel("목적지").fill("Seoul");
    await page.getByLabel("시작일").fill("2026-10-01");
    await page.getByLabel("종료일").fill("2026-10-02");
    await page.getByRole("button", { name: "국내" }).click();
    await page.getByRole("button", { name: "여행 만들기" }).click();
    await expect(page).toHaveURL(
      /\/trips\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
      { timeout: 10_000 },
    );
    tripId = page.url().split("/trips/")[1].split("?")[0];

    // 본 일정 1개
    await page.getByLabel("일정 추가").click();
    await page.getByRole("radio", { name: "기타" }).click();
    await page.getByLabel("제목").fill("본 일정 A");
    await page.getByRole("button", { name: "추가", exact: true }).click();
    await expect(page.getByText("본 일정 A", { exact: true })).toBeVisible({ timeout: 5_000 });

    // 후보 1개
    await page.getByLabel("일정 추가").click();
    await page.getByRole("radio", { name: "기타" }).click();
    await page.getByLabel("제목").fill("후보 B");
    await page.getByText("후보로 등록", { exact: false }).click();
    await page.getByRole("button", { name: "추가", exact: true }).click();

    // 접이식 후보 섹션에 카운트 표시, 펼치면 항목 노출
    const section = page.getByTestId("candidate-section");
    await expect(section.getByText("후보 (1)")).toBeVisible({ timeout: 5_000 });
    await section.getByRole("button", { name: /후보 \(1\)/ }).click();
    await expect(section.getByText("후보 B", { exact: true })).toBeVisible();
  });

  test("후보 탭 모아보기 + 풀 후보 등록", async ({ page }) => {
    await page.goto(`/trips/${tripId}`);
    await page.getByRole("tab", { name: /후보/ }).click();
    const panel = page.getByTestId("candidate-panel");
    await expect(panel.getByText("Day 1 후보 (1)")).toBeVisible({ timeout: 5_000 });
    await expect(panel.getByText("후보 B", { exact: true })).toBeVisible();

    // 후보 탭에서 등록 → 풀 후보
    await page.getByLabel("일정 추가").click();
    await page.getByRole("radio", { name: "기타" }).click();
    await page.getByLabel("제목").fill("풀 후보 C");
    await page.getByRole("button", { name: "추가", exact: true }).click();
    await expect(panel.getByText("전체 풀 후보 (1)")).toBeVisible({ timeout: 5_000 });
    await expect(panel.getByText("풀 후보 C", { exact: true })).toBeVisible();
  });

  test("승격: 후보 → 본 일정 끝 번호", async ({ page }) => {
    await page.goto(`/trips/${tripId}`);
    const section = page.getByTestId("candidate-section");
    await section.getByRole("button", { name: /후보 \(1\)/ }).click();
    await section.getByText("후보 B", { exact: true }).click();
    await page.getByRole("button", { name: "일정으로 승격" }).click();
    const promoteSheet = page.getByRole("dialog", { name: "일정으로 승격할 날짜" });
    await promoteSheet.getByRole("button", { name: /Day 1/ }).click();

    // 본 일정 리스트에 후보 B 가 2번으로 합류, 후보 섹션은 사라짐.
    // (승격 성공 토스트는 즉시 사라지므로 영속 상태로 검증한다 — Playwright 권장.)
    await expect(
      page.getByRole("button", { name: "2번 일정 지도에서 보기. 길게 눌러 순서 변경" }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("candidate-section")).toHaveCount(0);
  });
});
