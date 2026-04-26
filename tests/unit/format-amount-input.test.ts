import { describe, it, expect } from "vitest";
import {
  formatAmountInput,
  parseAmountInput,
} from "@/lib/expense/format-amount-input";

describe("formatAmountInput", () => {
  it("groups thousands with comma", () => {
    expect(formatAmountInput("1000")).toBe("1,000");
    expect(formatAmountInput("1000000")).toBe("1,000,000");
    expect(formatAmountInput("123")).toBe("123");
  });

  it("strips non-digit characters except dot", () => {
    expect(formatAmountInput("1,000")).toBe("1,000");
    expect(formatAmountInput("$1000원")).toBe("1,000");
    expect(formatAmountInput("abc")).toBe("");
  });

  it("preserves single decimal point with fractional part", () => {
    expect(formatAmountInput("1234.56")).toBe("1,234.56");
    expect(formatAmountInput("0.5")).toBe("0.5");
  });

  it("collapses extra dots after first into nothing", () => {
    expect(formatAmountInput("1.2.3")).toBe("1.23");
  });

  it("trims leading zeros from integer part", () => {
    expect(formatAmountInput("00123")).toBe("123");
    expect(formatAmountInput("0")).toBe("0");
  });

  it("returns empty for empty input", () => {
    expect(formatAmountInput("")).toBe("");
  });
});

describe("parseAmountInput", () => {
  it("strips commas and converts to number", () => {
    expect(parseAmountInput("1,234,567")).toBe(1_234_567);
    expect(parseAmountInput("1,234.56")).toBeCloseTo(1234.56);
  });

  it("returns NaN for invalid input", () => {
    expect(parseAmountInput("abc")).toBeNaN();
  });

  it("returns 0 for empty", () => {
    expect(parseAmountInput("")).toBe(0);
  });
});
