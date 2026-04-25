import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Phase 8 Turbopack pivot 후 SW 는 build 산출물(`public/sw.js`)이 아니라
 * `app/[path]/route.ts` Route Handler 가 런타임에 `/sw.js` 를 노출한다.
 * 따라서 본 integration 은 정적 파일 존재 + serwist wiring 소스 검증까지만 다루고,
 * 실 `/sw.js` HTTP 200 검증은 E2E (`tests/e2e/pwa.spec.ts`) 가 담당한다.
 */
describe("PWA build artifacts (turbopack route-handler 모드)", () => {
  it("public/manifest.webmanifest exists", () => {
    expect(existsSync(resolve("public/manifest.webmanifest"))).toBe(true);
  });

  it("4 icons exist and are non-trivial PNG", () => {
    for (const f of [
      "icon-192.png",
      "icon-512.png",
      "maskable-512.png",
      "apple-touch-icon-180.png",
    ]) {
      const path = resolve("public/icons", f);
      expect(existsSync(path)).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(1000);
    }
  });

  it("app/sw.ts source uses @serwist/turbopack/worker", () => {
    const src = readFileSync(resolve("app/sw.ts"), "utf-8");
    expect(src).toMatch(/@serwist\/turbopack\/worker/);
  });

  it("app/[path]/route.ts exposes serwist route handler", () => {
    const path = resolve("app/[path]/route.ts");
    expect(existsSync(path)).toBe(true);
    const src = readFileSync(path, "utf-8");
    expect(src).toMatch(/createSerwistRoute/);
    expect(src).toMatch(/swSrc/);
  });

  it("next.config.ts wraps with withSerwist", () => {
    const src = readFileSync(resolve("next.config.ts"), "utf-8");
    expect(src).toMatch(/@serwist\/turbopack/);
    expect(src).toMatch(/withSerwist/);
  });
});
