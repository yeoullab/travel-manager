import { describe, expect, it } from "vitest";
import { generateNonce, sha256Base64Url } from "@/lib/auth/nonce";

describe("nonce", () => {
  it("generateNonce는 32바이트 base64url 문자열을 만든다", () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("같은 입력에 대해 sha256Base64Url은 결정적이다", async () => {
    const a = await sha256Base64Url("hello");
    const b = await sha256Base64Url("hello");
    expect(a).toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
