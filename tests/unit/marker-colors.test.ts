import { describe, it, expect } from "vitest";
import { CATEGORY_MARKER_COLORS, markerColorsFor } from "@/lib/maps/marker-colors";

describe("marker colors", () => {
  it("7개 카테고리 전부에 fill 이 있다", () => {
    expect(Object.keys(CATEGORY_MARKER_COLORS)).toHaveLength(7);
  });

  it("밝은 배경은 dark 텍스트, 어두운 배경은 light 텍스트", () => {
    expect(CATEGORY_MARKER_COLORS.shopping.text).toBe("dark"); // #e0b64f
    expect(CATEGORY_MARKER_COLORS.cafe.text).toBe("dark"); // #e08cab
    expect(CATEGORY_MARKER_COLORS.transport.text).toBe("dark"); // #9fbbe0
    expect(CATEGORY_MARKER_COLORS.food.text).toBe("light"); // #a5673f
  });

  it("markerColorsFor 는 미지 카테고리를 other 로 폴백한다", () => {
    expect(markerColorsFor("nonexistent")).toEqual(markerColorsFor("other"));
    expect(markerColorsFor(null)).toEqual(markerColorsFor("other"));
  });

  it("markerColorsFor 는 hex 텍스트 컬러를 돌려준다", () => {
    expect(markerColorsFor("food")).toEqual({ fill: "#a5673f", textColor: "#f2f1ed" });
    expect(markerColorsFor("shopping")).toEqual({ fill: "#e0b64f", textColor: "#26251e" });
  });
});
