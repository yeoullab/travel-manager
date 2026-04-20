import { describe, it, expect } from "vitest";
import { providerForTrip } from "@/lib/maps/provider";

describe("providerForTrip", () => {
  it("returns naver for domestic", () => {
    expect(providerForTrip(true)).toBe("naver");
  });
  it("returns google for international", () => {
    expect(providerForTrip(false)).toBe("google");
  });
});
