import { describe, expect, it } from "vitest";
import { buildInviteUrl, extractInviteCode } from "@/lib/group/invite-url";

describe("invite-url", () => {
  it("buildInviteUrl 은 /invite/{code} 경로를 포함한다", () => {
    const code = "123e4567-e89b-12d3-a456-426614174000";
    const url = buildInviteUrl(code, "https://example.com");
    expect(url).toBe("https://example.com/invite/123e4567-e89b-12d3-a456-426614174000");
  });

  it("extractInviteCode 는 UUID 형식이면 그대로 반환", () => {
    const code = "123e4567-e89b-12d3-a456-426614174000";
    expect(extractInviteCode(code)).toBe(code);
  });

  it("extractInviteCode 는 비 UUID 형식이면 null 반환", () => {
    expect(extractInviteCode("not-a-uuid")).toBeNull();
  });
});
