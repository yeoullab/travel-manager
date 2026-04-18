import { describe, expect, it } from "vitest";
import { generateNonce, sha256Hex } from "@/lib/auth/nonce";

describe("nonce", () => {
  it("generateNonce는 32바이트 base64url 문자열을 만든다", () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("sha256Hex는 결정적이고 64자 hex 문자열을 만든다", async () => {
    const a = await sha256Hex("hello");
    const b = await sha256Hex("hello");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    // 공식 SHA-256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
    expect(a).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });
});
