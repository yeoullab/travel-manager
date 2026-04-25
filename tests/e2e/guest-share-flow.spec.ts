import { test, expect } from "@playwright/test";

// alice storageState — playwright.config.ts "alice" project
// anon 뷰는 browser.newContext({ storageState: undefined }) 로 분리

test.describe.configure({ mode: "serial" });

let tripId = "";
let shareUrl = "";

test.describe("게스트 공유 플로우 (Spec §6.8)", () => {
  test("trip 생성 + show_expenses 토글 ON → 공유 링크 발급", async ({ page }) => {
    await page.goto("/trips/new");
    await page.getByLabel("여행 제목").fill("E2E 게스트 공유");
    await page.getByLabel("목적지").fill("Seoul");
    await page.getByLabel("시작일").fill("2026-12-10");
    await page.getByLabel("종료일").fill("2026-12-11");
    await page.getByRole("button", { name: "국내" }).click();
    await page.getByRole("button", { name: "여행 만들기" }).click();

    await expect(page).toHaveURL(
      /\/trips\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
      { timeout: 10_000 },
    );
    tripId = page.url().split("/trips/")[1].split("?")[0];

    // expense 1건 미리 추가 (anon 에서 보이는지 확인용)
    await page.goto(`/trips/${tripId}?tab=expenses`);
    await page.getByRole("button", { name: "경비 추가" }).click();
    await page.getByLabel("제목").fill("숙박비");
    await page.getByLabel("금액").fill("80000");
    await page.getByLabel("날짜").fill("2026-12-10");
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByText("숙박비")).toBeVisible({ timeout: 5_000 });

    // 관리 탭 → 게스트 링크 생성
    await page.goto(`/trips/${tripId}?tab=manage`);
    await page.getByRole("button", { name: "게스트 링크 생성" }).click();

    // 링크 복사 버튼이 나타남
    const copyBtn = page.getByRole("button", { name: "링크 복사" });
    await expect(copyBtn).toBeVisible({ timeout: 5_000 });

    // 페이지 안에 share URL 이 /share/<uuid> 형태로 렌더됨 — textContent 추출
    const urlText = await page
      .locator("p.font-mono")
      .filter({ hasText: /\/share\/[0-9a-f-]{36}/ })
      .first()
      .textContent();
    expect(urlText).toMatch(/\/share\/[0-9a-f-]{36}/);
    shareUrl = urlText!.trim();

    // 경비 토글 ON — "경비 표시" 라벨과 바로 붙어있는 형제 switch (VisibilityToggle 의 justify-between 구조)
    // `border-b py-2` 로 감싸진 row 1개를 정확히 지정
    const expensesRow = page
      .locator("div.border-b")
      .filter({ hasText: "경비 표시" })
      .first();
    const expensesSwitch = expensesRow.getByRole("switch");
    await expect(expensesSwitch).toHaveAttribute("aria-checked", "false");
    await expensesSwitch.click();
    await expect(expensesSwitch).toHaveAttribute("aria-checked", "true", { timeout: 5_000 });

    // DB persist 확인 — 새로고침 후에도 true 유지
    await page.reload();
    await expect(
      page.locator("div.border-b").filter({ hasText: "경비 표시" }).first().getByRole("switch"),
    ).toHaveAttribute("aria-checked", "true", { timeout: 7_000 });
  });

  test("anon context 에서 /share/<token> 접근 → trip + expenses 노출", async ({ browser }) => {
    test.skip(!shareUrl, "share url not created in previous test");
    const anonCtx = await browser.newContext({ storageState: undefined });
    const anon = await anonCtx.newPage();
    try {
      // shareUrl 은 full url (https://localhost:3000/share/...) 또는 path — 둘 다 수용
      const path = shareUrl.replace(/^https?:\/\/[^/]+/, "");
      await anon.goto(path);

      // trip 제목 노출 (heading 3곳: AppBar·main·<title> 모두 렌더되므로 first)
      await expect(
        anon.getByRole("heading", { name: "E2E 게스트 공유" }).first(),
      ).toBeVisible({ timeout: 7_000 });

      // 경비 섹션이 토글 ON 이므로 노출됨
      await expect(anon.getByText("숙박비").first()).toBeVisible({ timeout: 5_000 });
    } finally {
      await anonCtx.close();
    }
  });

  test("비활성화 → 새 anon 탭에서 404", async ({ page, browser }) => {
    test.skip(!shareUrl, "share url not created");

    // 관리 탭에서 비활성화
    await page.goto(`/trips/${tripId}?tab=manage`);
    await page.getByRole("button", { name: "게스트 공유 비활성화" }).click();
    await expect(page.getByText("게스트 공유를 비활성화할까요?")).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: "비활성화" }).click();

    // share 섹션이 no-share 상태로 돌아감 (생성 버튼 다시 보임)
    await expect(page.getByRole("button", { name: "게스트 링크 생성" })).toBeVisible({
      timeout: 5_000,
    });

    // 새 anon 탭에서 같은 URL 접근 → notFound (404 페이지)
    const anonCtx = await browser.newContext({ storageState: undefined });
    const anon = await anonCtx.newPage();
    try {
      const path = shareUrl.replace(/^https?:\/\/[^/]+/, "");
      const resp = await anon.goto(path);
      // Next.js notFound() → 404 응답 + not-found UI
      expect(resp?.status()).toBeGreaterThanOrEqual(400);
    } finally {
      await anonCtx.close();
    }
  });
});
