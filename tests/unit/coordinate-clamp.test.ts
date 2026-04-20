import { describe, it, expect } from "vitest";
import { clampLatLng } from "@/lib/maps/rate-limit";

describe("clampLatLng", () => {
  it("정상 WGS84 passthrough", () => {
    expect(clampLatLng(37.5, 126.9)).toEqual([37.5, 126.9]);
  });
  it("범위 밖은 null", () => {
    expect(clampLatLng(95, 0)).toBeNull();
    expect(clampLatLng(0, 200)).toBeNull();
  });
  it("NaN 은 null", () => {
    expect(clampLatLng(Number.NaN, 0)).toBeNull();
  });
});
