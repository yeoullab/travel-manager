import type { Page } from "@playwright/test";

export interface RealtimeSnapshot {
  table: string;
  eventType?: string;
  new?: unknown;
  old?: unknown;
}

/** dev 서버 한정. window.__realtimeEvents 에 매칭 이벤트가 push 될 때까지 대기. */
export async function waitForRealtimeEvent(
  page: Page,
  match: { table: string; predicate?: (ev: RealtimeSnapshot) => boolean },
  timeoutMs = 10_000,
): Promise<void> {
  await page.waitForFunction(
    ({ table, predicateSrc }: { table: string; predicateSrc: string | null }) => {
      const w = window as unknown as { __realtimeEvents?: RealtimeSnapshot[] };
      const events = w.__realtimeEvents ?? [];
      const fn = predicateSrc
        ? (new Function("ev", `return (${predicateSrc})(ev)`) as (ev: RealtimeSnapshot) => boolean)
        : () => true;
      return events.some((ev) => ev.table === table && fn(ev));
    },
    { table: match.table, predicateSrc: match.predicate?.toString() ?? null },
    { timeout: timeoutMs },
  );
}

/** 브라우저 컨텍스트 초기화 시점에 realtime buffer 를 리셋. */
export async function resetRealtimeBuffer(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __realtimeEvents?: unknown[] }).__realtimeEvents = [];
  });
}
