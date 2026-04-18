import { describe, expect, it } from "vitest";
import { chipClassForColor, CHIP_TONE_BY_COLOR } from "@/lib/profile/colors";
import { PROFILE_COLORS } from "@/lib/profile/color-schema";

describe("chipClassForColor", () => {
  it("6색 모두 bg/text 클래스를 반환", () => {
    for (const color of PROFILE_COLORS) {
      const klass = chipClassForColor(color);
      expect(klass.bg).toMatch(/^bg-/);
      expect(klass.text).toMatch(/^text-/);
    }
  });

  it("orange는 accent-orange + cream 매핑", () => {
    expect(chipClassForColor("orange")).toEqual({
      bg: "bg-accent-orange",
      text: "text-cream",
    });
  });

  it("color가 null/undefined면 neutral fallback", () => {
    expect(chipClassForColor(null)).toEqual({
      bg: "bg-surface-400",
      text: "text-ink-700",
    });
    expect(chipClassForColor(undefined)).toEqual({
      bg: "bg-surface-400",
      text: "text-ink-700",
    });
  });

  it("CHIP_TONE_BY_COLOR의 키는 PROFILE_COLORS와 일치", () => {
    expect(Object.keys(CHIP_TONE_BY_COLOR).sort()).toEqual([...PROFILE_COLORS].sort());
  });
});
