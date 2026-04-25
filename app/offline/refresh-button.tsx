"use client";

export function RefreshButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="rounded-full bg-ink-900 px-6 py-3 text-sm font-medium text-surface-200 transition-opacity hover:opacity-90"
    >
      다시 시도
    </button>
  );
}
