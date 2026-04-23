import { describe, expect, it } from "vitest";
import { todoMemoSchema, todoTitleSchema } from "@/lib/todo/schema";

describe("todoTitleSchema", () => {
  it("accepts 1~100 chars and trims", () => {
    expect(todoTitleSchema.parse(" pack bags ")).toBe("pack bags");
    expect(todoTitleSchema.safeParse("").success).toBe(false);
    expect(todoTitleSchema.safeParse("a".repeat(101)).success).toBe(false);
  });
});

describe("todoMemoSchema", () => {
  it("coerces empty/whitespace to null and preserves other content", () => {
    expect(todoMemoSchema.parse("")).toBe(null);
    expect(todoMemoSchema.parse("   ")).toBe(null);
    expect(todoMemoSchema.parse("details")).toBe("details");
    expect(todoMemoSchema.safeParse("a".repeat(1001)).success).toBe(false);
  });
});
