import { test, expect } from "@playwright/test";
import { seedTripWithItems } from "./helpers/db-seed";

// alice storageState — playwright.config.ts "alice" project

let domesticTripId = "";
let overseasTripId = "";

test.beforeAll(async () => {
  const [d, o] = await Promise.all([
    seedTripWithItems({
      title: "국내 장소 검색 E2E",
      destination: "Seoul",
      startDate: "2026-10-01",
      endDate: "2026-10-02",
      isDomestic: true,
      itemsByDay: {},
    }),
    seedTripWithItems({
      title: "해외 장소 검색 E2E",
      destination: "Tokyo",
      startDate: "2026-10-01",
      endDate: "2026-10-02",
      isDomestic: false,
      itemsByDay: {},
    }),
  ]);
  domesticTripId = d.tripId;
  overseasTripId = o.tripId;
});

test("국내 trip — Naver 장소 검색 → 결과 선택 → place_name 저장 (Spec §6)", async ({
  page,
}) => {
  await page.goto(`/trips/${domesticTripId}`);

  await page.getByLabel("일정 추가").click();
  await page.getByRole("button", { name: /장소 검색/ }).click();

  // PlaceSearchSheet (provider=naver)
  await expect(page.getByText("장소 검색 (Naver)")).toBeVisible({ timeout: 5_000 });
  await page.getByPlaceholder("예: 성수동 카페, 시부야 라멘").fill("성수동 카페");

  // 결과 대기 (debounce 300ms + API 응답)
  const firstResult = page.locator("ul li button").first();
  await expect(firstResult).toBeVisible({ timeout: 8_000 });
  const placeName = await firstResult.locator("p").first().textContent();
  await firstResult.click();

  // 모달로 복귀 — 장소명 표시
  await expect(page.getByText("일정 추가")).toBeVisible({ timeout: 3_000 });
  if (placeName) {
    await expect(page.getByText(placeName)).toBeVisible();
  }

  // 제목 입력 후 저장
  await page.getByLabel("제목").fill("카페 방문");
  await page.getByRole("button", { name: "추가", exact: true }).click();

  // 카드에 place 정보 포함
  await expect(page.getByText("카페 방문")).toBeVisible({ timeout: 5_000 });
});

test("해외 trip — Google 장소 검색 → 결과 선택 → place_name 저장 (Spec §6)", async ({
  page,
}) => {
  await page.goto(`/trips/${overseasTripId}`);

  await page.getByLabel("일정 추가").click();
  await page.getByRole("button", { name: /장소 검색/ }).click();

  await expect(page.getByText("장소 검색 (Google)")).toBeVisible({ timeout: 5_000 });
  await page.getByPlaceholder("예: 성수동 카페, 시부야 라멘").fill("Shibuya ramen");

  const firstResult = page.locator("ul li button").first();
  await expect(firstResult).toBeVisible({ timeout: 8_000 });
  const placeName = await firstResult.locator("p").first().textContent();
  await firstResult.click();

  await expect(page.getByText("일정 추가")).toBeVisible({ timeout: 3_000 });
  if (placeName) {
    await expect(page.getByText(placeName)).toBeVisible();
  }

  await page.getByLabel("제목").fill("라멘 맛집");
  await page.getByRole("button", { name: "추가", exact: true }).click();

  await expect(page.getByText("라멘 맛집")).toBeVisible({ timeout: 5_000 });
});
