import { describe, expect, it } from "vitest";
import { APP_NAME, APP_VERSION, APP_VERSION_LABEL } from "@/lib/version";
import packageJson from "@/package.json";

describe("app version metadata", () => {
  it("exposes the package version and display label", () => {
    expect(APP_NAME).toBe("트레블매니저");
    expect(APP_VERSION).toBe(packageJson.version);
    expect(APP_VERSION_LABEL).toBe(`v${packageJson.version}`);
  });
});
