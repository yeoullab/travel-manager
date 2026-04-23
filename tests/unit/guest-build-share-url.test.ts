import { describe, expect, it } from "vitest";
import { buildShareUrl } from "@/lib/guest/build-share-url";

describe("buildShareUrl", () => {
  it("joins origin + /share/<token>", () => {
    const token = "123e4567-e89b-12d3-a456-426614174000";
    expect(buildShareUrl(token, "https://travel.example")).toBe(
      `https://travel.example/share/${token}`,
    );
  });

  it("uses window.location.origin when origin is omitted (jsdom env)", () => {
    const token = "abc";
    // vitest default env is jsdom → window.location.origin = http://localhost:3000
    expect(buildShareUrl(token)).toBe(`${window.location.origin}/share/${token}`);
  });
});
