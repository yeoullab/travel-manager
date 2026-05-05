import { describe, expect, it } from "vitest";
import { assertSafeResetTarget } from "@/tests/e2e/helpers/db-reset";

describe("E2E DB reset safety", () => {
  it("blocks remote Supabase projects by default", () => {
    expect(() =>
      assertSafeResetTarget({
        supabaseUrl: "https://yzbnxaphssnurbhahvkm.supabase.co",
        allowRemoteReset: false,
      }),
    ).toThrow(/Refusing to reset remote Supabase database/);
  });

  it("allows local Supabase targets", () => {
    expect(() =>
      assertSafeResetTarget({
        supabaseUrl: "http://127.0.0.1:54321",
        allowRemoteReset: false,
      }),
    ).not.toThrow();
  });

  it("allows remote reset only with an explicit override", () => {
    expect(() =>
      assertSafeResetTarget({
        supabaseUrl: "https://example.supabase.co",
        allowRemoteReset: true,
      }),
    ).not.toThrow();
  });
});
