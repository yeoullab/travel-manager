import { describe, expect, it } from "vitest";
import {
  expenseAmountSchema,
  expenseCategorySchema,
  expenseCurrencySchema,
  expenseMemoSchema,
  expenseTitleSchema,
} from "@/lib/expense/schema";

describe("expenseTitleSchema", () => {
  it("accepts 1~100 chars after trim", () => {
    expect(expenseTitleSchema.parse(" lunch ")).toBe("lunch");
    expect(expenseTitleSchema.parse("a".repeat(100))).toBe("a".repeat(100));
  });
  it("rejects empty or over-length", () => {
    expect(expenseTitleSchema.safeParse("").success).toBe(false);
    expect(expenseTitleSchema.safeParse("   ").success).toBe(false);
    expect(expenseTitleSchema.safeParse("a".repeat(101)).success).toBe(false);
  });
});

describe("expenseAmountSchema", () => {
  it("coerces numeric strings and rejects negative", () => {
    expect(expenseAmountSchema.parse("1000")).toBe(1000);
    expect(expenseAmountSchema.parse(12.34)).toBe(12.34);
    expect(expenseAmountSchema.safeParse("-1").success).toBe(false);
    expect(expenseAmountSchema.safeParse("abc").success).toBe(false);
  });
  it("rejects amounts over the cap", () => {
    expect(expenseAmountSchema.safeParse(10_000_000_000).success).toBe(false);
  });
});

describe("expenseCurrencySchema", () => {
  it("accepts 3 uppercase letters", () => {
    expect(expenseCurrencySchema.parse("KRW")).toBe("KRW");
  });
  it("rejects lowercase or wrong length", () => {
    expect(expenseCurrencySchema.safeParse("krw").success).toBe(false);
    expect(expenseCurrencySchema.safeParse("WON").success).toBe(true);
    expect(expenseCurrencySchema.safeParse("AB").success).toBe(false);
    expect(expenseCurrencySchema.safeParse("ABCD").success).toBe(false);
  });
});

describe("expenseCategorySchema", () => {
  it("accepts all 6 known codes", () => {
    for (const code of ["food", "transport", "lodging", "shopping", "activity", "other"]) {
      expect(expenseCategorySchema.safeParse(code).success).toBe(true);
    }
  });
  it("rejects unknown codes", () => {
    expect(expenseCategorySchema.safeParse("unknown").success).toBe(false);
    expect(expenseCategorySchema.safeParse("").success).toBe(false);
  });
});

describe("expenseMemoSchema", () => {
  it("returns null for whitespace-only", () => {
    expect(expenseMemoSchema.parse("")).toBe(null);
    expect(expenseMemoSchema.parse("   ")).toBe(null);
  });
  it("preserves content otherwise", () => {
    expect(expenseMemoSchema.parse("note")).toBe("note");
  });
});
