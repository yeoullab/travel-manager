# Mobile Fixed Map + Scrollable Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On mobile, fix the map at the top of the schedule area while only the schedule list scrolls, collapse the day tabs and an icon-only map toggle into one row, and make the map height drag-adjustable with localStorage persistence.

**Architecture:** Add a reusable `useResizableHeight` hook (height state + min/max clamp + localStorage + pointer/keyboard handlers). Restructure the mobile branch of `ScheduleTab` into a fixed `flex flex-col` viewport: a one-row header (scrolling day tabs + pinned `MapIcon` toggle), an open-only fixed map with a resize handle, and a `flex-1 overflow-y-auto` list that holds the selection bar and `DndContext`. Desktop (`lg`) layout is untouched.

**Tech Stack:** Next.js 16 App Router, React 19 Client Components, Tailwind CSS v4, Vitest + Testing Library.

---

## Source Documents

- Spec: `docs/superpowers/specs/2026-05-31-mobile-fixed-map-design.md`

## File Structure

### Create

- `lib/hooks/use-resizable-height.ts`: reusable height hook with localStorage persistence, clamp, pointer + keyboard handlers.
- `tests/unit/use-resizable-height.test.tsx`: unit coverage for clamp, drag delta, persistence, keyboard.

### Modify

- `components/trip/schedule-tab.tsx`: one-row header (scrolling day tabs + pinned icon toggle), mobile fixed `flex flex-col` viewport, open-only fixed map + resize handle, scrollable list owning the selection bar.

### Reuse (no change)

- `components/schedule/map-panel.tsx`: already accepts `className`.
- `components/schedule/day-tab-bar.tsx`: already accepts `className`.
- The lucide `Map` icon, already imported in `schedule-tab.tsx` as `Map as MapIcon`.

---

## Task 1: Resizable Height Hook

**Files:**
- Create: `lib/hooks/use-resizable-height.ts`
- Create: `tests/unit/use-resizable-height.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/use-resizable-height.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useResizableHeight } from "@/lib/hooks/use-resizable-height";

const KEY = "test:map-height";

function Harness() {
  const { height, handleProps } = useResizableHeight({
    storageKey: KEY,
    defaultHeight: 280,
    min: 160,
    max: 600,
  });
  return (
    <div>
      <div data-testid="height">{height}</div>
      <div data-testid="handle" {...handleProps} />
    </div>
  );
}

function startDrag(handle: HTMLElement, fromY: number) {
  fireEvent.pointerDown(handle, { clientY: fromY, button: 0 });
}

describe("useResizableHeight", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("starts at the default height when storage is empty", () => {
    render(<Harness />);
    expect(screen.getByTestId("height").textContent).toBe("280");
  });

  it("restores a saved height from localStorage on mount", () => {
    window.localStorage.setItem(KEY, "340");
    render(<Harness />);
    expect(screen.getByTestId("height").textContent).toBe("340");
  });

  it("increases height as the handle is dragged downward", () => {
    render(<Harness />);
    const handle = screen.getByTestId("handle");
    startDrag(handle, 100);
    act(() => {
      fireEvent.pointerMove(window, { clientY: 150 });
    });
    expect(screen.getByTestId("height").textContent).toBe("330");
  });

  it("clamps to min and max", () => {
    render(<Harness />);
    const handle = screen.getByTestId("handle");
    startDrag(handle, 500);
    act(() => {
      fireEvent.pointerMove(window, { clientY: 0 });
    });
    expect(screen.getByTestId("height").textContent).toBe("160");
    startDrag(handle, 0);
    act(() => {
      fireEvent.pointerMove(window, { clientY: 5000 });
    });
    expect(screen.getByTestId("height").textContent).toBe("600");
  });

  it("persists the height to localStorage on pointer up", () => {
    render(<Harness />);
    const handle = screen.getByTestId("handle");
    startDrag(handle, 100);
    act(() => {
      fireEvent.pointerMove(window, { clientY: 140 });
      fireEvent.pointerUp(window);
    });
    expect(window.localStorage.getItem(KEY)).toBe("320");
  });

  it("adjusts height with ArrowUp / ArrowDown keys", () => {
    render(<Harness />);
    const handle = screen.getByTestId("handle");
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(screen.getByTestId("height").textContent).toBe("268");
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(screen.getByTestId("height").textContent).toBe("292");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/unit/use-resizable-height.test.tsx
```

Expected: FAIL because `lib/hooks/use-resizable-height.ts` does not exist.

- [ ] **Step 3: Implement the hook**

Create `lib/hooks/use-resizable-height.ts`:

```ts
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

type UseResizableHeightOptions = {
  storageKey: string;
  defaultHeight: number;
  min: number;
  max: number;
  step?: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function useResizableHeight({
  storageKey,
  defaultHeight,
  min,
  max,
  step = 12,
}: UseResizableHeightOptions) {
  const [height, setHeightState] = useState(() => clamp(defaultHeight, min, max));
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  // Restore persisted height after mount (SSR-safe: never read storage during render).
  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    if (raw == null) return;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) setHeightState(clamp(parsed, min, max));
  }, [storageKey, min, max]);

  const persist = useCallback(
    (value: number) => {
      window.localStorage.setItem(storageKey, String(value));
    },
    [storageKey],
  );

  const setHeight = useCallback(
    (value: number) => {
      const next = clamp(value, min, max);
      setHeightState(next);
      return next;
    },
    [min, max],
  );

  const onPointerMove = useCallback(
    (event: globalThis.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = event.clientY - drag.startY;
      setHeight(drag.startHeight + delta);
    },
    [setHeight],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    setHeightState((current) => {
      persist(current);
      return current;
    });
  }, [onPointerMove, persist]);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      dragRef.current = { startY: event.clientY, startHeight: height };
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [height, onPointerMove, onPointerUp],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHeightState((current) => {
          const next = clamp(current - step, min, max);
          persist(next);
          return next;
        });
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setHeightState((current) => {
          const next = clamp(current + step, min, max);
          persist(next);
          return next;
        });
      }
    },
    [step, min, max, persist],
  );

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  return {
    height,
    setHeight,
    handleProps: {
      onPointerDown,
      onKeyDown,
      role: "separator" as const,
      "aria-orientation": "horizontal" as const,
      tabIndex: 0,
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npm test -- tests/unit/use-resizable-height.test.tsx
```

Expected: PASS (6 tests).

- [ ] **Step 5: Lint and commit**

Run:

```bash
npm run lint -- lib/hooks/use-resizable-height.ts tests/unit/use-resizable-height.test.tsx
git add -- lib/hooks/use-resizable-height.ts tests/unit/use-resizable-height.test.tsx
git commit -m "feat(ui): add resizable height hook"
```

Expected: lint has no new errors; tests pass.

---

## Task 2: One-Row Header (Scrolling Day Tabs + Pinned Icon Toggle)

**Files:**
- Modify: `components/trip/schedule-tab.tsx`

This task replaces the current two-row arrangement (the `DayTabBar` block at
`schedule-tab.tsx:391-396` followed by the separate mobile toggle row at
`schedule-tab.tsx:398-412`) with a single row. The pinned toggle uses the existing
`MapIcon` and drops the text label and `ChevronDown`.

- [ ] **Step 1: Replace the header block**

In `components/trip/schedule-tab.tsx`, replace this block:

```tsx
        <DayTabBar
          days={days}
          activeDayId={activeDayId}
          onSelect={setActiveDayId}
          className="lg:top-0"
        />

        <div className="mt-2 flex items-center justify-end lg:hidden">
          <button
            type="button"
            onClick={toggleMap}
            aria-pressed={mapOpen}
            className="text-ink-700 hover:text-error flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors"
          >
            <MapIcon size={14} />
            {mapOpen ? "지도 접기" : "지도 펼치기"}
            <ChevronDown
              size={14}
              className={cn("transition-transform duration-200", mapOpen && "rotate-180")}
            />
          </button>
        </div>

        <div className="lg:hidden">{mapOpen && mapPanel}</div>
```

with:

```tsx
        <div className="flex items-stretch gap-2">
          <DayTabBar
            days={days}
            activeDayId={activeDayId}
            onSelect={setActiveDayId}
            className="min-w-0 flex-1 lg:top-0"
          />
          <button
            type="button"
            onClick={toggleMap}
            aria-pressed={mapOpen}
            aria-label={mapOpen ? "지도 접기" : "지도 펼치기"}
            className={cn(
              "mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] transition-colors lg:hidden",
              mapOpen
                ? "bg-accent-orange text-cream"
                : "bg-surface-400 text-ink-700 hover:text-ink-900",
            )}
          >
            <MapIcon size={18} />
          </button>
        </div>

        <div className="lg:hidden">{mapOpen && mapPanel}</div>
```

- [ ] **Step 2: Remove the now-unused `ChevronDown` import**

In `components/trip/schedule-tab.tsx`, change:

```ts
import { CalendarX, ChevronDown, Map as MapIcon } from "lucide-react";
```

to:

```ts
import { CalendarX, Map as MapIcon } from "lucide-react";
```

- [ ] **Step 3: Typecheck and lint**

Run:

```bash
./node_modules/.bin/tsc --noEmit
npm run lint -- components/trip/schedule-tab.tsx
```

Expected: tsc exits 0; lint has no new errors (in particular, no "ChevronDown is defined but never used").

- [ ] **Step 4: Commit**

Run:

```bash
git add -- components/trip/schedule-tab.tsx
git commit -m "feat(schedule): collapse mobile day tabs and map toggle into one row"
```

---

## Task 3: Mobile Fixed Map + Scrollable List + Resize Handle

**Files:**
- Modify: `components/trip/schedule-tab.tsx`

This task restructures the mobile branch into a fixed `flex flex-col` viewport so that,
when the map is open, the map (and its resize handle) stay fixed and only the schedule
list scrolls. Desktop (`lg`) classes are preserved exactly.

After Task 2 the relevant return region looks like:

```tsx
  return (
    <div className="px-4 pb-28 lg:grid lg:h-[calc(100dvh-56px-80px)] lg:grid-cols-[minmax(0,560px)_minmax(420px,1fr)] lg:gap-4 lg:overflow-hidden lg:pb-4">
      <section
        data-testid="schedule-scroll-panel"
        className="min-w-0 lg:overflow-y-auto lg:pr-1"
      >
        <div className="flex items-stretch gap-2"> ... header ... </div>

        <div className="lg:hidden">{mapOpen && mapPanel}</div>

        {selectionMode && ( ... selection bar ... )}

        <DndContext ...> ... list / empty state ... </DndContext>
      </section>

      <aside className="hidden min-h-0 lg:block">
        <div className="sticky top-16 h-full">{mapPanel}</div>
      </aside>

      <Fab aria-label="일정 추가" onClick={openCreate} />
      ... modals / sheets ...
    </div>
  );
```

- [ ] **Step 1: Add the resize hook call**

In `components/trip/schedule-tab.tsx`, add the import near the other `@/lib` imports:

```ts
import { useResizableHeight } from "@/lib/hooks/use-resizable-height";
```

Inside the component body, near the other hooks (e.g. just after the `move`/`moveMany`
mutation hooks around line 68), add:

```ts
  const mapResize = useResizableHeight({
    storageKey: "travel-manager:map-height",
    defaultHeight: 280,
    min: 160,
    max: 520,
  });
```

- [ ] **Step 2: Make the mobile map use the resizable height**

The shared `mapPanel` node (around `schedule-tab.tsx:375-383`) hardcodes a mobile height
via `className="h-[clamp(280px,34dvh,380px)] lg:mt-0 lg:h-full"`. Desktop must keep
`lg:h-full`, but mobile height now comes from the hook applied on the wrapping element, so
remove the fixed mobile height from the panel and let it fill its wrapper.

Replace:

```tsx
  const mapPanel = trip ? (
    <MapPanel
      isDomestic={trip.is_domestic}
      items={mapItems}
      onMarkerClick={handleMarkerClick}
      focusItemId={focusMapItemId}
      className="h-[clamp(280px,34dvh,380px)] lg:mt-0 lg:h-full"
    />
  ) : null;
```

with:

```tsx
  const mapPanel = trip ? (
    <MapPanel
      isDomestic={trip.is_domestic}
      items={mapItems}
      onMarkerClick={handleMarkerClick}
      focusItemId={focusMapItemId}
      className="mt-0 h-full"
    />
  ) : null;
```

- [ ] **Step 3: Restructure the mobile section into a fixed flex column**

Replace the entire `<section data-testid="schedule-scroll-panel" ...> ... </section>`
block (from `<section` through its closing `</section>`) with:

```tsx
      <section
        data-testid="schedule-scroll-panel"
        className={cn(
          "min-w-0",
          // Mobile: fixed-height flex column so only the list scrolls when the map is open.
          mapOpen
            ? "flex h-[calc(100dvh-56px)] flex-col overflow-hidden"
            : "",
          // Desktop: unchanged scroll column.
          "lg:flex lg:h-auto lg:flex-col lg:overflow-y-auto lg:pr-1",
        )}
      >
        <div className="shrink-0">
          <div className="flex items-stretch gap-2">
            <DayTabBar
              days={days}
              activeDayId={activeDayId}
              onSelect={setActiveDayId}
              className="min-w-0 flex-1 lg:top-0"
            />
            <button
              type="button"
              onClick={toggleMap}
              aria-pressed={mapOpen}
              aria-label={mapOpen ? "지도 접기" : "지도 펼치기"}
              className={cn(
                "mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] transition-colors lg:hidden",
                mapOpen
                  ? "bg-accent-orange text-cream"
                  : "bg-surface-400 text-ink-700 hover:text-ink-900",
              )}
            >
              <MapIcon size={18} />
            </button>
          </div>
        </div>

        {mapOpen && mapPanel && (
          <div className="shrink-0 lg:hidden">
            <div style={{ height: mapResize.height }}>{mapPanel}</div>
            <div
              {...mapResize.handleProps}
              aria-label="지도 높이 조절"
              className="flex h-6 cursor-row-resize touch-none items-center justify-center"
            >
              <span className="bg-border-medium h-1 w-10 rounded-full" />
            </div>
          </div>
        )}

        <div
          className={cn(
            "min-w-0",
            mapOpen ? "flex-1 overflow-y-auto" : "",
          )}
        >
          {selectionMode && (
            <div className="border-border-primary bg-surface-100 sticky top-0 z-20 mt-2 flex items-center justify-between rounded-[8px] border px-3 py-2">
              <span className="text-ink-700 text-[13px] font-medium">{selectedCount}개 선택</span>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="light"
                  disabled={selectedCount === 0 || moveMany.isPending}
                  onClick={() => setBulkMoveOpen(true)}
                >
                  이동
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={selectedCount === 0 || deleteMany.isPending}
                  onClick={handleBulkDelete}
                >
                  삭제
                </Button>
                <button
                  type="button"
                  onClick={toggleSelectionMode}
                  className="text-ink-600 h-9 rounded-full px-2 text-[13px] font-medium"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {activeDayItems.length === 0 ? (
              <EmptyState
                className="py-16"
                icon={<CalendarX size={48} strokeWidth={1.5} />}
                title="아직 일정이 없어요"
                description="일정을 추가해 하루를 계획해보세요."
                cta={
                  <Button variant="primary" onClick={openCreate}>
                    + 일정 추가
                  </Button>
                }
              />
            ) : (
              <ScheduleList
                items={activeDayItems}
                isDomestic={trip?.is_domestic ?? true}
                onTapItem={selectionMode ? toggleSelected : openEdit}
                onLongPressItem={enterSelectionMode}
                onTapNumber={handleNumberTap}
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                onToggleSelected={toggleSelected}
                registerItemRef={registerItemRef}
              />
            )}
          </DndContext>
        </div>
      </section>
```

Notes for the implementer:
- The desktop `aside` block, `Fab`, modals, place sheet, and day-move sheets that follow
  the `</section>` stay exactly as they are — do not move them.
- On mobile when the map is **closed**, `mapOpen` is false: the section is not a fixed
  flex column, the list wrapper is a plain block, and the page scrolls as before.
- On desktop the map lives in the `aside`; the `lg:hidden` map block and toggle never
  render, and `lg:overflow-y-auto` keeps the existing scroll-column behavior.

- [ ] **Step 4: Run the full unit suite, typecheck, and lint**

Run:

```bash
npm test
./node_modules/.bin/tsc --noEmit
npm run lint -- components/trip/schedule-tab.tsx
```

Expected: all unit tests pass; tsc exits 0; lint has no new errors.

- [ ] **Step 5: Commit**

Run:

```bash
git add -- components/trip/schedule-tab.tsx
git commit -m "feat(schedule): fix mobile map and scroll only the schedule list"
```

---

## Task 4: E2E Coverage Update (Spec Only — Deferred Execution)

**Files:**
- Modify: `tests/e2e/schedule-layout-and-selection.spec.ts`

The existing mobile layout test asserts a compact day header and a larger map. Extend it
so that, with the map open, the map stays fixed while the list scrolls. E2E execution
against the linked production Supabase is deferred (see the v1.1 spec Task 11 notes); this
task updates the spec text so it is ready to run against a disposable/local project.

- [ ] **Step 1: Replace the mobile layout test body**

In `tests/e2e/schedule-layout-and-selection.spec.ts`, find the test titled
`mobile schedule screen uses a compact day header and larger map area`. Replace its body
(keep the `test(...)` wrapper and the `seedTripWithItems` call) so the assertions become:

```ts
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/trips/${tripId}?map=open`);
  await expect(page.getByText("Mobile-A", { exact: true })).toBeVisible({ timeout: 10_000 });

  const map = page.getByLabel("지도").first();
  const dayTab = page.getByRole("tab", { name: /Day 1/ });
  await expect(map).toBeVisible();
  await expect(dayTab).toBeVisible();

  // Icon-only toggle, no text label.
  await expect(page.getByText("지도 펼치기")).toHaveCount(0);
  await expect(page.getByText("지도 접기")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "지도 접기" })).toBeVisible();

  const mapBox = await map.boundingBox();
  const tabBox = await dayTab.boundingBox();
  expect(mapBox?.height).toBeGreaterThan(160);
  expect(tabBox?.height).toBeLessThanOrEqual(44);

  // Map stays fixed while the schedule list scrolls.
  const scrollPanel = page.getByTestId("schedule-scroll-panel");
  const listRegion = scrollPanel.locator("> div").last();
  const mapTopBefore = (await map.boundingBox())?.y ?? 0;
  await listRegion.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const mapTopAfter = (await map.boundingBox())?.y ?? 0;
  expect(Math.round(mapTopAfter)).toBe(Math.round(mapTopBefore));

  // Resize handle adjusts the map height.
  const handle = page.getByRole("separator", { name: "지도 높이 조절" });
  await expect(handle).toBeVisible();
  const heightBefore = (await map.boundingBox())?.height ?? 0;
  const hb = await handle.boundingBox();
  await page.mouse.move((hb?.x ?? 0) + 5, (hb?.y ?? 0) + 3);
  await page.mouse.down();
  await page.mouse.move((hb?.x ?? 0) + 5, (hb?.y ?? 0) + 80);
  await page.mouse.up();
  const heightAfter = (await map.boundingBox())?.height ?? 0;
  expect(heightAfter).toBeGreaterThan(heightBefore);
```

- [ ] **Step 2: Typecheck the spec**

Run:

```bash
./node_modules/.bin/tsc --noEmit
```

Expected: exits 0 (no Playwright type errors in the updated spec).

- [ ] **Step 3: Commit**

Run:

```bash
git add -- tests/e2e/schedule-layout-and-selection.spec.ts
git commit -m "test(schedule): cover mobile fixed map and resize"
```

---

## Task 5: Final Verification

**Files:**
- Read: changed files from Tasks 1-4

- [ ] **Step 1: Run unit tests**

Run:

```bash
npm test
```

Expected: PASS (includes the new `use-resizable-height` tests).

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: 0 errors. Pre-existing warnings in `lib/mocks/*` and
`lib/schedule/use-schedule-list.ts` may remain.

- [ ] **Step 3: Run typecheck**

Run:

```bash
./node_modules/.bin/tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Manual mobile verification in the running app**

Start (or reuse) the dev server, open a trip on a mobile viewport (≤ 768px), and confirm:

1. Day tabs and the map icon share one row; many days scroll horizontally without covering the icon.
2. Tapping the icon opens a fixed map; scrolling the list does not move the map.
3. Dragging the handle resizes the map; reloading the page restores the dragged height.
4. Closing the map returns to full-height list with normal page scroll.
5. Desktop (≥ 1024px) is unchanged: map sits in the right column, no icon toggle.

Record the result (pass/fail per item). If the `h-[calc(100dvh-56px)]` offset leaves a gap
or overlaps the bottom FAB/safe area, adjust the subtracted value to match the measured app
bar height and re-verify.

- [ ] **Step 6: Append a verification note to the spec**

Append to `docs/superpowers/specs/2026-05-31-mobile-fixed-map-design.md` under a new
`## 8. Implementation Notes` section recording the actual results of Steps 1-5 (real
command output and the manual checklist outcome). If a command fails, record the failing
command and reason, then fix before shipping.

- [ ] **Step 7: Commit the verification note**

Run:

```bash
git add -- docs/superpowers/specs/2026-05-31-mobile-fixed-map-design.md
git commit -m "docs: record mobile fixed map verification"
```
