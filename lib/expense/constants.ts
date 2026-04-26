export const EXPENSE_CATEGORIES = [
  { code: "food", label: "식비" },
  { code: "transport", label: "교통" },
  { code: "lodging", label: "숙박" },
  { code: "shopping", label: "쇼핑" },
  { code: "activity", label: "관광" },
  { code: "other", label: "기타" },
] as const;

export type ExpenseCategoryCode = (typeof EXPENSE_CATEGORIES)[number]["code"];

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategoryCode, string> =
  Object.fromEntries(
    EXPENSE_CATEGORIES.map((c) => [c.code, c.label]),
  ) as Record<ExpenseCategoryCode, string>;
