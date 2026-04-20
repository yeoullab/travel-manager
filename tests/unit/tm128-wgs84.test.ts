import { describe, it, expect } from "vitest";
import { tm128ToWgs84 } from "@/lib/maps/tm128";

describe("tm128ToWgs84", () => {
  it("Naver TM128 샘플 (서울 근처) 을 WGS84 로 변환한다 (±0.2° 허용)", () => {
    const [lng, lat] = tm128ToWgs84(320979, 552164);
    expect(lat).toBeGreaterThan(37.3);
    expect(lat).toBeLessThan(37.8);
    expect(lng).toBeGreaterThan(126.8);
    expect(lng).toBeLessThan(127.2);
  });

  it("잘못된 입력 (NaN) 은 throw", () => {
    expect(() => tm128ToWgs84(Number.NaN, 0)).toThrow(/invalid/i);
  });
});
