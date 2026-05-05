import { describe, expect, it, vi } from "vitest";
import {
  installGisPopupBlockedConsoleHandler,
  isGisPopupBlockedMessage,
} from "@/lib/auth/gis-popup-blocked";

describe("gis popup blocked handling", () => {
  it("detects the Google Identity Services popup-blocked console message", () => {
    expect(
      isGisPopupBlockedMessage([
        "[GSI_LOGGER]: Failed to open popup window on url: https://accounts.google.com",
      ]),
    ).toBe(true);
    expect(isGisPopupBlockedMessage(["other error"])).toBe(false);
  });

  it("handles popup-blocked errors without forwarding them to console.error", () => {
    const original = console.error;
    const errorSpy = vi.fn();
    const onBlocked = vi.fn();
    console.error = errorSpy;

    const restore = installGisPopupBlockedConsoleHandler(onBlocked);
    console.error("[GSI_LOGGER]: Failed to open popup window on url: https://accounts.google.com");
    restore();

    expect(onBlocked).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
    console.error = original;
  });
});
