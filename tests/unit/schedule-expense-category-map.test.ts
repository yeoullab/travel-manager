import { describe, expect, it } from "vitest";
import { expenseCategoryForScheduleCategory } from "@/lib/schedule/category-map";

describe("expenseCategoryForScheduleCategory", () => {
  it.each([
    ["transport", "transport"],
    ["sightseeing", "sightseeing"],
    ["food", "food"],
    ["cafe", "cafe"],
    ["lodging", "lodging"],
    ["shopping", "shopping"],
    ["other", "other"],
  ] as const)("maps %s to %s", (schedule, expense) => {
    expect(expenseCategoryForScheduleCategory(schedule)).toBe(expense);
  });

  it("falls back to other for unknown or empty categories", () => {
    expect(expenseCategoryForScheduleCategory("unknown")).toBe("other");
    expect(expenseCategoryForScheduleCategory(null)).toBe("other");
  });
});
