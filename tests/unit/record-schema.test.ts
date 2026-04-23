import { describe, expect, it } from "vitest";
import {
  buildRecordDateSchema,
  recordContentSchema,
  recordTitleSchema,
} from "@/lib/record/schema";

describe("recordTitleSchema", () => {
  it("trims and enforces 1..100", () => {
    expect(recordTitleSchema.parse("  day 1  ")).toBe("day 1");
    expect(recordTitleSchema.safeParse("").success).toBe(false);
    expect(recordTitleSchema.safeParse("a".repeat(101)).success).toBe(false);
  });
});

describe("recordContentSchema", () => {
  it("enforces 1..20,000 chars", () => {
    expect(recordContentSchema.parse("hello")).toBe("hello");
    expect(recordContentSchema.safeParse("").success).toBe(false);
    expect(recordContentSchema.safeParse("a".repeat(20_001)).success).toBe(false);
  });
});

describe("buildRecordDateSchema", () => {
  const schema = buildRecordDateSchema("2026-05-01", "2026-05-05");

  it("accepts dates inside the range (inclusive)", () => {
    expect(schema.parse("2026-05-01")).toBe("2026-05-01");
    expect(schema.parse("2026-05-03")).toBe("2026-05-03");
    expect(schema.parse("2026-05-05")).toBe("2026-05-05");
  });

  it("rejects dates outside the range", () => {
    expect(schema.safeParse("2026-04-30").success).toBe(false);
    expect(schema.safeParse("2026-05-06").success).toBe(false);
  });

  it("rejects empty values", () => {
    expect(schema.safeParse("").success).toBe(false);
  });
});
