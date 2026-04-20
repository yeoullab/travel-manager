import { describe, it, expect, beforeEach, vi } from "vitest";
import { tryAcquireRateSlot, __resetRateLimitForTest } from "@/lib/maps/rate-limit";

describe("rate limit — 30 req/min/user", () => {
  beforeEach(() => {
    __resetRateLimitForTest();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T00:00:00.000Z"));
  });

  it("첫 30건 허용", () => {
    for (let i = 0; i < 30; i += 1) expect(tryAcquireRateSlot("u1")).toBe(true);
  });
  it("31번째 차단", () => {
    for (let i = 0; i < 30; i += 1) tryAcquireRateSlot("u1");
    expect(tryAcquireRateSlot("u1")).toBe(false);
  });
  it("60초 지나면 리셋", () => {
    for (let i = 0; i < 30; i += 1) tryAcquireRateSlot("u1");
    vi.setSystemTime(new Date("2026-04-20T00:01:01.000Z"));
    expect(tryAcquireRateSlot("u1")).toBe(true);
  });
  it("유저 단위로 독립적", () => {
    for (let i = 0; i < 30; i += 1) tryAcquireRateSlot("u1");
    expect(tryAcquireRateSlot("u2")).toBe(true);
  });
});
