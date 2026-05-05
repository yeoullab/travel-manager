import { describe, expect, it } from "vitest";
import {
  buildAuthCallbackUrl,
  sanitizeAuthRedirectPath,
} from "@/lib/auth/oauth-redirect";

describe("oauth redirect helpers", () => {
  it("buildAuthCallbackUrl 은 안전한 next 경로를 콜백 URL에 담는다", () => {
    expect(
      buildAuthCallbackUrl("http://localhost:3001", "/trips/abc?tab=schedule"),
    ).toBe("http://localhost:3001/auth/callback?next=%2Ftrips%2Fabc%3Ftab%3Dschedule");
  });

  it("sanitizeAuthRedirectPath 는 앱 내부 경로만 허용한다", () => {
    expect(sanitizeAuthRedirectPath("/settings")).toBe("/settings");
    expect(sanitizeAuthRedirectPath("https://evil.example/phish")).toBe("/trips");
    expect(sanitizeAuthRedirectPath("//evil.example/phish")).toBe("/trips");
    expect(sanitizeAuthRedirectPath(null)).toBe("/trips");
  });
});
