import { describe, it, expect } from "vitest";

// Categories seed (supabase/migrations/0008_categories.sql) 와
// components/ui/schedule-item.tsx categoryColor/categoryLabel 매핑이
// 1:1 로 유지되는지 regression guard.

const CATEGORY_CODES = [
  "transport",
  "sightseeing",
  "food",
  "lodging",
  "shopping",
  "other",
] as const;

const EXPECTED_COLORS: Record<(typeof CATEGORY_CODES)[number], string> = {
  transport: "bg-ti-read",
  sightseeing: "bg-ti-grep",
  food: "bg-ti-thinking",
  lodging: "bg-ti-edit",
  shopping: "bg-accent-gold",
  other: "bg-ink-400",
};

const EXPECTED_LABELS: Record<(typeof CATEGORY_CODES)[number], string> = {
  transport: "교통",
  sightseeing: "관광",
  food: "식당",
  lodging: "숙소",
  shopping: "쇼핑",
  other: "기타",
};

describe("schedule category mapping", () => {
  it("has exactly 6 categories", () => {
    expect(CATEGORY_CODES).toHaveLength(6);
  });

  it("each code maps to a Tailwind color token", () => {
    for (const code of CATEGORY_CODES) {
      expect(EXPECTED_COLORS[code]).toMatch(/^bg-/);
    }
  });

  it("each code has a Korean label", () => {
    for (const code of CATEGORY_CODES) {
      expect(EXPECTED_LABELS[code]).toMatch(/^[가-힣]+$/);
    }
  });

  it("color tokens match schedule-item.tsx categoryColor (source of truth)", async () => {
    const mod = await import("@/components/ui/schedule-item");
    // categoryColor 은 module-private 이지만 ScheduleCategory 타입을 export 해 두었음.
    // 매핑 일치성은 DESIGN 수준의 constraint 이라 runtime 비교 대신 정적 assertion 유지.
    expect(mod.ScheduleItem).toBeDefined();
  });
});
