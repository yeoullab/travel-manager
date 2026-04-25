import { test, expect } from "@playwright/test";

test.describe("PWA static assets", () => {
  test("/manifest.webmanifest serves valid JSON", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.status()).toBe(200);
    const ct = res.headers()["content-type"] ?? "";
    expect(ct).toMatch(/manifest\+json|application\/json/);
    const body = await res.json();
    expect(body.name).toBe("travel-manager");
    expect(body.start_url).toBe("/");
    expect(Array.isArray(body.icons)).toBe(true);
  });

  test("/offline 페이지가 200 + 안내 문구 포함", async ({ page }) => {
    await page.goto("/offline");
    await expect(
      page.getByRole("heading", { name: "오프라인 상태예요" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "다시 시도" })).toBeVisible();
  });

  test("apple-touch-icon link 가 head 에 노출", async ({ page }) => {
    await page.goto("/");
    const href = await page
      .locator('link[rel="apple-touch-icon"]')
      .first()
      .getAttribute("href");
    expect(href).toBe("/icons/apple-touch-icon-180.png");
  });

  test("manifest link 가 head 에 노출", async ({ page }) => {
    await page.goto("/");
    const href = await page
      .locator('link[rel="manifest"]')
      .getAttribute("href");
    expect(href).toBe("/manifest.webmanifest");
  });

  // Turbopack pivot 후 SW 는 build 산출물이 아니라 `app/[path]/route.ts` 가 노출.
  // dev 서버에서도 라우트로 200 응답해야 정상 wiring.
  test("/sw.js 가 라우트 핸들러로 노출", async ({ request }) => {
    const res = await request.get("/sw.js");
    expect(res.status()).toBe(200);
    const ct = res.headers()["content-type"] ?? "";
    expect(ct).toMatch(/javascript/);
    const body = await res.text();
    expect(body.length).toBeGreaterThan(10_000);
  });
});
