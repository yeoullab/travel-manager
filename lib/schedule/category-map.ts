import type { ExpenseCategoryCode } from "@/lib/expense/constants";
import type { ScheduleCategory } from "@/lib/types";

const SCHEDULE_TO_EXPENSE_CATEGORY: Record<ScheduleCategory, ExpenseCategoryCode> = {
  food: "food",
  transport: "transport",
  lodging: "lodging",
  shopping: "shopping",
  sightseeing: "activity",
  other: "other",
};

export function expenseCategoryForScheduleCategory(
  category: ScheduleCategory | string | null | undefined,
): ExpenseCategoryCode {
  if (!category) return "other";
  return SCHEDULE_TO_EXPENSE_CATEGORY[category as ScheduleCategory] ?? "other";
}
