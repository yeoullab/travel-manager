import { describe, expect, it } from "vitest";
import { expenseCategoryForScheduleCategory } from "@/lib/schedule/category-map";

describe("expenseCategoryForScheduleCategory", () => {
  it.each([
    ["food", "food"],
    ["transport", "transport"],
    ["lodging", "lodging"],
    ["shopping", "shopping"],
    ["sightseeing", "activity"],
    ["other", "other"],
  ] as const)("maps %s to %s", (schedule, expense) => {
    expect(expenseCategoryForScheduleCategory(schedule)).toBe(expense);
  });

  it("falls back to other for unknown or empty categories", () => {
    expect(expenseCategoryForScheduleCategory("unknown")).toBe("other");
    expect(expenseCategoryForScheduleCategory(null)).toBe("other");
  });
});
