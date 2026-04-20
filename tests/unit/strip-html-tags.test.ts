import { describe, it, expect } from "vitest";
import { stripHtmlTags } from "@/lib/maps/strip-html";

describe("stripHtmlTags (Naver title 정화)", () => {
  it("<b> 강조 태그 제거", () => {
    expect(stripHtmlTags("서울역 <b>스타벅스</b>")).toBe("서울역 스타벅스");
  });
  it("HTML entity 디코드 (&amp; &quot; &#39; &lt; &gt;)", () => {
    expect(stripHtmlTags("A &amp; B &quot;X&quot; &#39;y&#39; &lt;z&gt;")).toBe(
      `A & B "X" 'y' <z>`,
    );
  });
  it("null / undefined / 빈 문자열 → 빈 문자열", () => {
    expect(stripHtmlTags(undefined)).toBe("");
    expect(stripHtmlTags(null)).toBe("");
    expect(stripHtmlTags("")).toBe("");
  });
});
