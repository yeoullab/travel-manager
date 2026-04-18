import { test, expect } from "@playwright/test";

test.describe("로그인 가드", () => {
  test("로그인 안 한 상태로 /trips 접근 시 /login으로 리다이렉트된다", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/trips");
    await expect(page).toHaveURL(/\/login\?redirect=%2Ftrips/);
  });

  test("로그인 화면에서 GIS 버튼 컨테이너가 렌더된다", async ({ page }) => {
    await page.goto("/login");
    const container = page.getByLabel("Google 로그인");
    await expect(container).toBeVisible();
  });
});
