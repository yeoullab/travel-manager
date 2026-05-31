---
type: design-spec
project: travel-manager
date: 2026-05-31
status: approved-for-planning
branch: codex-trip-map-usability
author: AI + human collaborative design
---

# Mobile Fixed Map + Scrollable Schedule Design

## 1. Background

Task 7 (`2026-05-30-trip-map-usability-design.md`) delivered a desktop layout where
the map stays fixed in a right-hand column while the schedule scrolls. On **mobile**,
the map still lives inline in the schedule flow, so it scrolls away with the list —
the original "fix the map, scroll only the schedule" request was not met on mobile.

Two additional usability problems remain on mobile:

- The day-tab bar and the `지도 펼치기/접기` text button occupy **two separate rows**,
  eating too much vertical space above the schedule.
- The map area is a fixed height the user cannot adjust.

## 2. Goals

1. On mobile, when the map is open it is **fixed** at the top of the schedule area and
   only the schedule list scrolls beneath it.
2. Collapse the top controls into **one row**: the day tabs scroll horizontally, and a
   small **icon-only** map toggle is pinned at the end of that row. Growing the number
   of days must not push or cover the pinned icon.
3. The fixed map height is **user-adjustable by dragging** a handle, and the chosen
   height **persists in localStorage**.
4. Desktop behavior is unchanged.

## 3. Scope

- **In scope:** mobile (`< lg`) schedule tab layout, a reusable resize hook, the day-tab
  bar header row, the map toggle control.
- **Out of scope:** desktop layout (keep current left/right split with an always-visible
  map), the `MapPanel` internals, any DB/RPC changes.

## 4. Design

### 4.1 Top header — one row (day tabs + pinned toggle icon)

Replace the current two-row arrangement (DayTabBar row + separate map-toggle button row)
with a single row:

```
┌─────────────────────────────────────────────┐
│ [Day1][Day2][Day3][Day4]... → scroll  │ 🗺️ │
│ └──── overflow-x-auto ────┘          └fixed┘ │
└─────────────────────────────────────────────┘
```

> Note: the `🗺️` in the diagrams above and below is **placeholder art only**. The
> actual control reuses the existing `MapIcon` (the lucide `Map` icon already imported
> as `Map as MapIcon` in `schedule-tab.tsx`). No new icon or emoji is introduced.

- The day tabs live in an `overflow-x-auto` region.
- The toggle is **icon-only** — the existing `MapIcon` (lucide `Map`), `flex-shrink-0`,
  pinned to the right of the row so day overflow never covers it.
- The current text label (`지도 펼치기` / `지도 접기`) and the `ChevronDown` chevron are
  removed. State is conveyed by `aria-pressed` plus accent color when open.
- `aria-label` ("지도 펼치기" / "지도 접기") provides the accessible name. Touch target
  ≥ 40px.
- Header structure: `DayTabBar` (overflow-x-auto) and the toggle share one flex row. On
  desktop (`lg`) only the **toggle icon** is hidden (`lg:hidden`); `DayTabBar` still
  renders, and the map remains in the right column as today.

### 4.2 Mobile fixed map + scrollable list (open state)

When the map is **open** on mobile, the schedule area becomes a fixed vertical split:

```
┌─────────────────────────────────┐
│ [Day1][Day2]... →    │ 🗺️ │  ← header (fixed, shrink-0)
├─────────────────────────────────┤
│         map (fixed)              │  ← open-only, height = user value (shrink-0)
│ ═══════ ⣿ drag handle ═══════    │  ← resize handle
├─────────────────────────────────┤
│  selection bar (if any)          │
│  1. item A                       │  ← THIS region scrolls
│  2. item B          (flex-1,     │     (flex-1 overflow-y-auto)
│  3. item C ↓↓↓       overflow)   │
└─────────────────────────────────┘
```

- Mobile container becomes `flex flex-col` with a fixed viewport height. The app bar is
  56px (the value already used as `top-14`/`56px` elsewhere in this tab); subtract it via
  `h-[calc(100dvh-56px)]`. The FAB stays `fixed` and overlays the list, so it does not
  reduce the scroll region. Verify the exact offset against the running app during
  implementation (bottom safe-area inset may need inclusion).
- Header (day tabs + icon) = `shrink-0`.
- Map (open only) = `shrink-0`, height driven by the resize hook.
- Schedule list = `flex-1 overflow-y-auto` — the only scrolling region.
- The selection bar moves **inside** the scrollable list region as its first child,
  `sticky top-0`, so it pins to the top of the scroll area (not the page) during scroll.

When the map is **closed** on mobile: no fixed split. The schedule list takes the full
height and behaves as today (normal page scroll). The fixed split is active only in the
open state.

`mapOpen` continues to be driven by the existing `?map=open` URL query — no state model
change.

### 4.3 Drag-to-resize (mobile only)

A handle bar sits between the map and the list.

- `pointerdown` on the handle starts a drag; `pointermove` adjusts map height by deltaY.
- Clamp: min ~160px, max ~60dvh, so the list is always partly visible.
- `pointerup` persists the final height to `localStorage` (`travel-manager:map-height`).
- On open, restore the saved height; fall back to a default (~280px) when absent.
- SSR-safe: localStorage is read only inside `useEffect`; initial render uses the default
  height to avoid hydration mismatch.
- Accessibility: handle is `role="separator"`, `aria-orientation="horizontal"`,
  `aria-label="지도 높이 조절"`, with keyboard ↑/↓ height adjustment as a fallback. Touch
  target height ≥ 44px.

### 4.4 Component / unit boundaries

- `lib/hooks/use-resizable-height.ts` — reusable hook returning `{ height, handleProps,
  setHeight }`. Owns: current height state, min/max clamp, localStorage persistence,
  pointer + keyboard handlers. Pure enough to unit-test without a DOM layout.
- The handle UI is a small element/component in the schedule tab using `handleProps`.
- `DayTabBar` / map-toggle changes stay within the schedule tab header.

## 5. Testing

- **Unit (`tests/unit/use-resizable-height.test.tsx`)**: drag delta applied to height,
  min/max clamp, localStorage save on release + restore on mount, keyboard ↑/↓ adjust.
- **E2E (`tests/e2e/schedule-layout-and-selection.spec.ts`)**: update the mobile test so
  that, with the map open, the map stays fixed while the list scrolls, and dragging the
  handle changes map height. (Note: E2E execution against the linked production Supabase
  is deferred — see Task 11 notes in the v1.1 spec. Specs are updated but run against a
  disposable/local project.)

## 6. Desktop impact

None. All new behavior is gated to mobile (`< lg`). The desktop left/right split with the
always-visible sticky map is unchanged.

## 7. Release Criteria

- Mobile open-map state fixes the map and scrolls only the schedule list.
- Day tabs and the map toggle share one row; the icon stays pinned as days overflow.
- Map height is drag-adjustable on mobile and persists across sessions via localStorage.
- `npm test`, `npm run lint`, `npm run build` pass.
- Desktop layout and all existing schedule flows still pass.

## 8. Implementation Notes

Implemented on 2026-05-31 on branch `mobile-fixed-map` (branched from `main`), using
subagent-driven development (5 tasks). The map toggle reuses the existing lucide `Map`
icon (`MapIcon`) — no new icon/emoji.

Static verification:

- `npm test` → passed (45 files, 190 tests), including 6 new `use-resizable-height` tests.
- `./node_modules/.bin/tsc --noEmit` → exit 0.
- `npm run lint` → 0 errors (9 pre-existing warnings in `lib/mocks/*` and
  `lib/schedule/use-schedule-list.ts`, unrelated).
- `npm run build` → passed.

Manual browser verification (Next.js dev preview on :3010, signed in as the E2E `alice`
test user against the E2E-seeded trips — no real user data touched):

- Mobile (375×812), map open: `[data-testid="schedule-scroll-panel"]` is
  `display:flex; flex-direction:column; height:756px (812−56); overflow:hidden`. Children:
  `shrink-0` header (54px), `shrink-0 lg:hidden` map block (map 280px default + handle),
  and `flex-1 overflow-y-auto` list — the only scroll region. Map top stayed fixed (122px)
  when the list region scrolled.
- Drag-resize: dragging the `role="separator"` handle increased the map height and
  persisted to `localStorage["travel-manager:map-height"]`; the value was restored on
  reload (verified 470px round-trip).
- One-row header confirmed visually: day tabs left, active orange `Map` icon pinned right.
- Mobile, map closed: panel is `display:block; overflow:visible`, list wrapper
  `overflow-y:visible` — normal page scroll, nothing clipped. Toggle label "지도 펼치기".
- Desktop (1280×820): unchanged two-column grid; map in the right `aside` (668px,
  full height); the mobile toggle icon is hidden (`display:none`). No console errors.

The Naver Maps "Open API 인증 실패" message seen in the preview is the known
maps-key-not-whitelisted-for-localhost item (tracked separately), not a layout issue.

E2E (`tests/e2e/schedule-layout-and-selection.spec.ts`) was updated but not executed: the
linked Supabase is the production database and the E2E `globalSetup` truncates all tables.
The spec is ready to run against a disposable/local project.
