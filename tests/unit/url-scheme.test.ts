import { describe, expect, it } from "vitest";
import { scheduleItemUrlSchema } from "@/lib/schedule/schema";

describe("scheduleItemUrlSchema", () => {
  it("https:// URL 은 통과", () => {
    expect(scheduleItemUrlSchema.parse("https://example.com")).toBe("https://example.com");
  });

  it("http:// URL 은 통과", () => {
    expect(scheduleItemUrlSchema.parse("http://example.com/path?q=1")).toBe(
      "http://example.com/path?q=1",
    );
  });

  it("빈 문자열은 null 로 normalize", () => {
    expect(scheduleItemUrlSchema.parse("")).toBeNull();
    expect(scheduleItemUrlSchema.parse("   ")).toBeNull();
  });

  it("javascript: 는 거부", () => {
    expect(() => scheduleItemUrlSchema.parse("javascript:alert(1)")).toThrow();
  });

  it("data: 는 거부", () => {
    expect(() =>
      scheduleItemUrlSchema.parse("data:text/html,<script>1</script>"),
    ).toThrow();
  });

  it("file: 는 거부", () => {
    expect(() => scheduleItemUrlSchema.parse("file:///etc/passwd")).toThrow();
  });

  it("501자 초과 거부", () => {
    const long = "https://a.com/" + "x".repeat(490);
    expect(() => scheduleItemUrlSchema.parse(long)).toThrow();
  });

  it("도메인만 있고 scheme 없음 거부", () => {
    expect(() => scheduleItemUrlSchema.parse("example.com")).toThrow();
  });
});
