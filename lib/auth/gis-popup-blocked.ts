"use client";

const GSI_POPUP_BLOCKED = "[GSI_LOGGER]: Failed to open popup window";

export function isGisPopupBlockedMessage(args: unknown[]): boolean {
  return args.some((arg) => typeof arg === "string" && arg.includes(GSI_POPUP_BLOCKED));
}

export function installGisPopupBlockedConsoleHandler(onBlocked: () => void): () => void {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (isGisPopupBlockedMessage(args)) {
      onBlocked();
      return;
    }
    originalError(...args);
  };

  return () => {
    console.error = originalError;
  };
}
