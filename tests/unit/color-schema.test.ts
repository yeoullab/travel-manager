import { describe, expect, it } from "vitest";
import { profileColorSchema, PROFILE_COLORS } from "@/lib/profile/color-schema";

describe("profileColorSchema", () => {
  it("6색 팔레트 모두 통과", () => {
    for (const color of PROFILE_COLORS) {
      expect(profileColorSchema.safeParse(color).success).toBe(true);
    }
  });

  it("팔레트 외 값은 거부", () => {
    expect(profileColorSchema.safeParse("red").success).toBe(false);
    expect(profileColorSchema.safeParse("").success).toBe(false);
    expect(profileColorSchema.safeParse(null).success).toBe(false);
  });

  it("PROFILE_COLORS는 정확히 6개", () => {
    expect(PROFILE_COLORS).toHaveLength(6);
  });
});
