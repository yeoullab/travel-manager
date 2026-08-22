// 일정 카테고리(categories 테이블 / ScheduleCategory)와 코드·라벨·순서를 동일하게 유지한다.
export const EXPENSE_CATEGORIES = [
  { code: "transport", label: "교통" },
  { code: "sightseeing", label: "관광" },
  { code: "food", label: "식당" },
  { code: "cafe", label: "카페" },
  { code: "lodging", label: "숙소" },
  { code: "shopping", label: "쇼핑" },
  { code: "other", label: "기타" },
] as const;

export type ExpenseCategoryCode = (typeof EXPENSE_CATEGORIES)[number]["code"];

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategoryCode, string> =
  Object.fromEntries(
    EXPENSE_CATEGORIES.map((c) => [c.code, c.label]),
  ) as Record<ExpenseCategoryCode, string>;

// 일정 카테고리 색상(components/ui/schedule-item.tsx categoryColor)과 동일한 bg-* 토큰.
export const EXPENSE_CATEGORY_COLOR: Record<ExpenseCategoryCode, string> = {
  transport: "bg-ti-read",
  sightseeing: "bg-ti-grep",
  food: "bg-accent-brown",
  cafe: "bg-accent-rose",
  lodging: "bg-ti-edit",
  shopping: "bg-accent-yellow",
  other: "bg-ink-400",
};
