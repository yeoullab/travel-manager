import type { ExpenseCategoryCode } from "@/lib/expense/constants";
import type { ScheduleCategory } from "@/lib/types";

// 경비 카테고리가 일정과 동일 값으로 정렬된 뒤로 1:1 항등 매핑이다(0025).
const SCHEDULE_TO_EXPENSE_CATEGORY: Record<ScheduleCategory, ExpenseCategoryCode> = {
  transport: "transport",
  sightseeing: "sightseeing",
  food: "food",
  cafe: "cafe",
  lodging: "lodging",
  shopping: "shopping",
  other: "other",
};

export function expenseCategoryForScheduleCategory(
  category: ScheduleCategory | string | null | undefined,
): ExpenseCategoryCode {
  if (!category) return "other";
  return SCHEDULE_TO_EXPENSE_CATEGORY[category as ScheduleCategory] ?? "other";
}
