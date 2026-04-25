import { describe, it, expect } from "vitest";
import { queryKeys } from "@/lib/query/keys";

describe("categories queryKey", () => {
  it("exposes a stable categories.all key", () => {
    expect(queryKeys.categories.all).toEqual(["categories", "all"]);
  });
});

describe("Category row shape", () => {
  it("matches the seed contract from 0008_categories.sql", async () => {
    const { CATEGORY_FALLBACK_LABEL } = await import("@/lib/category/use-categories");
    expect(CATEGORY_FALLBACK_LABEL).toEqual({
      transport: "교통",
      sightseeing: "관광",
      food: "식당",
      lodging: "숙소",
      shopping: "쇼핑",
      other: "기타",
    });
  });
});
