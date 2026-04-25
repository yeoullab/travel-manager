import { describe, it, expect } from "vitest";
import { matchPolicy, RUNTIME_CACHE_POLICIES } from "@/lib/pwa/runtime-caching";

describe("runtime caching policy", () => {
  it("Supabase REST URL matches NetworkOnly", () => {
    const url = new URL("https://abc.supabase.co/rest/v1/trips?select=*");
    const policy = matchPolicy(url);
    expect(policy?.handler).toBe("NetworkOnly");
  });

  it("Supabase Realtime URL (wss) matches NetworkOnly", () => {
    const url = new URL("wss://abc.supabase.co/realtime/v1/websocket");
    const policy = matchPolicy(url);
    expect(policy?.handler).toBe("NetworkOnly");
  });

  it("Supabase auth callback matches NetworkOnly", () => {
    const url = new URL("https://abc.supabase.co/auth/v1/token");
    const policy = matchPolicy(url);
    expect(policy?.handler).toBe("NetworkOnly");
  });

  it("Naver Maps SDK matches NetworkOnly", () => {
    const url = new URL("https://oapi.map.naver.com/openapi/v3/maps.js");
    const policy = matchPolicy(url);
    expect(policy?.handler).toBe("NetworkOnly");
  });

  it("Google Maps loader matches NetworkOnly", () => {
    const url = new URL("https://maps.googleapis.com/maps/api/js");
    const policy = matchPolicy(url);
    expect(policy?.handler).toBe("NetworkOnly");
  });

  it("Pretendard font CSS matches CacheFirst", () => {
    const url = new URL("https://example.test/_next/static/media/Pretendard-Regular.woff2");
    const policy = matchPolicy(url);
    expect(policy?.handler).toBe("CacheFirst");
    expect(policy?.cacheName).toBe("static-assets");
  });

  it("HTML navigation request matches StaleWhileRevalidate", () => {
    const url = new URL("https://example.test/trips/abc");
    const policy = matchPolicy(url, "document");
    expect(policy?.handler).toBe("StaleWhileRevalidate");
    expect(policy?.cacheName).toBe("pages");
  });

  it("Unknown 3rd party returns null (default to NetworkOnly via SW config)", () => {
    const url = new URL("https://random.example.com/foo");
    const policy = matchPolicy(url);
    expect(policy).toBeNull();
  });

  it("RUNTIME_CACHE_POLICIES exports a non-empty array", () => {
    expect(RUNTIME_CACHE_POLICIES.length).toBeGreaterThan(0);
  });
});
