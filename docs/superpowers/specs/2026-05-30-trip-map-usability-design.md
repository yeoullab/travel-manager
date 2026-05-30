---
type: design-spec
project: travel-manager
date: 2026-05-30
status: approved-for-planning
branch: codex-trip-map-usability
author: AI + human collaborative design
---

# Trip Schedule Map Usability Design

## 1. Goal

Improve the schedule screen for real trip planning: make the map easier to see, keep the day schedule easy to scan, reduce header clutter, make multi-select faster, preserve mobile-native time picking, fix desktop AM/PM order, reduce repeated login friction, and remove design-system entry points from the user-facing app.

## 2. Source Requirements

1. The current map is too small. The map area should stay visible while only the schedule list scrolls. On wide screens, use a left schedule / right map layout.
2. The date/header area takes too much vertical space. Remove explanatory helper text such as item count and "long press the number..." copy.
3. Desktop time registration shows PM before AM. AM should appear first.
4. Map size should be responsive, not a fixed small block.
5. Users should not have to log in again on every visit.
6. Long-pressing a schedule card should enter selection mode.
7. Remove "design system" links from the first screen.

Additional refinement from review:

- Mobile time picking should stay native because the current Android picker is comfortable and already shows AM first.
- Desktop time picking should use an app-controlled picker so AM appears before PM.
- Multi-select should support both moving selected items to another date and deleting selected items.

## 3. Scope

### In Scope

- Schedule tab layout changes for mobile, tablet, and desktop.
- Responsive map sizing and fixed/sticky map behavior.
- Compact day tab/header treatment.
- Long-press card selection mode.
- Bulk move reuse of the existing selected-item move flow.
- Bulk delete with server-side atomic ordering repair.
- Desktop-only custom time picker.
- Mobile-native time input preservation.
- Supabase session persistence and already-signed-in login redirect polish.
- Removal or hiding of design-system links from normal user entry points.
- Focused unit and E2E coverage for the changed behavior.

### Out Of Scope

- New map providers.
- Full route optimization or multi-day map aggregation.
- Offline schedule mutation queueing.
- New custom category features.
- Redesigning expenses, todos, records, or manage tabs beyond auth/link effects.
- Changing stored schedule time format.

## 4. Product Decisions

### 4.1 Schedule And Map Layout

Wide screens use a two-column layout: schedule controls and list on the left, map on the right. The right map column remains visible while the left schedule column scrolls. The map is shown by default on wide screens because there is enough space for it.

Mobile keeps one visual column. The map sits near the top of the schedule tab with responsive height, while the day tabs and schedule list become the primary scrollable area. The map toggle remains useful on mobile because vertical space is limited.

The map height is responsive:

- Mobile: constrained by viewport height with a practical min/max so it is large enough to inspect but does not consume the whole screen.
- Tablet/desktop: fills the available right-column height below the app chrome.
- Empty-coordinate days still render an empty map state in the allocated map area instead of collapsing the layout.

### 4.2 Compact Date/Header Area

`DayTabBar` becomes shorter and denser while preserving tap targets. It keeps the day number and short date because both are useful during travel.

The separate helper row below the day tabs removes:

- item count text
- "번호를 길게 눌러 순서 변경" explanatory text
- the prominent `선택` button

The map toggle remains on mobile if the map can be collapsed. On wide screens, map visibility is part of the layout and does not need to dominate the schedule header.

### 4.3 Long-Press Selection Mode

Long-pressing a schedule card body enters selection mode and immediately selects that card. While selection mode is active:

- tapping cards toggles selection
- tapping outside action controls does not open edit
- checkboxes or selected styling make chosen cards visible
- the selection bar shows `N개 선택`, `이동`, `삭제`, and `취소`
- cancelling clears selected ids and returns normal tap-to-edit behavior

The drag handle remains separate:

- long-pressing the card body means selection
- long-pressing the number/handle means reorder
- tapping the number still focuses the matching map marker when coordinates exist

This avoids overloading one gesture with selection, reorder, and map focus.

### 4.4 Bulk Move And Bulk Delete

Bulk move reuses the existing `move_schedule_items_to_day` workflow. Selected items move to the target day in their current visual order and append after existing target-day items.

Bulk delete should be implemented as a new atomic RPC instead of firing multiple single-delete mutations. The RPC deletes selected items that belong to one accessible trip and repairs `sort_order` for every affected day in the same transaction. This prevents gaps and partial deletes if one item is invalid.

The client shows a confirmation before deleting multiple selected schedules. A successful delete exits selection mode and invalidates the schedule query.

### 4.5 Time Input

Mobile and touch-first environments keep the native `type="time"` input. The current mobile picker is comfortable and already places `오전` before `오후`.

Desktop and pointer-first environments use an app-controlled time picker:

- `오전` appears before `오후`
- hour/minute choices are deterministic
- the visible label can use Korean AM/PM text
- the stored value remains the existing 24-hour `HH:mm` string
- clearing time remains possible

The database and schedule RPC payloads continue to use the existing `time_of_day` contract.

### 4.6 Login Persistence

Supabase browser auth should explicitly preserve sessions and refresh tokens in the browser. The app should not rely on implicit defaults for behavior users feel every visit.

The login page should check for an existing session on mount. If a valid user/session already exists, it redirects to the requested `redirect` path or `/trips` without showing another Google sign-in step.

The middleware continues to validate protected routes with `getUser()` and refresh cookies through the SSR client. If a session is truly expired or revoked, protected routes still redirect to `/login`.

The service worker runtime caching policy must keep Supabase auth/network requests network-only. Login persistence comes from Supabase session storage and cookie refresh, not from caching auth responses.

### 4.7 First-Screen Design-System Links

The landing page removes the `디자인 시스템 보기` button. The primary action remains `시작하기`.

The settings footer design-system palette link should also be removed or hidden from production-facing UI. The `/design` route can stay available for local development unless a later cleanup decides to remove it entirely.

## 5. Technical Design

### 5.1 Files And Responsibilities

- `components/trip/schedule-tab.tsx`: owns selected ids, active day, map visibility, two-column/mobile layout shell, selection actions, and mutation dispatch.
- `components/schedule/schedule-list.tsx`: passes long-press and selection props into each sortable row.
- `components/schedule/sortable-schedule-item.tsx`: separates card-body long press from drag handle interactions.
- `components/schedule/map-panel.tsx`: accepts layout sizing classes or a size variant so the parent controls responsive dimensions.
- `components/schedule/day-tab-bar.tsx`: compact day tabs and sticky behavior tuned for the new scroll container.
- `components/schedule/schedule-item-modal.tsx`: swaps the time field to a responsive `ScheduleTimeField`.
- `components/schedule/schedule-time-field.tsx`: new component that chooses native mobile input or desktop custom picker while emitting `HH:mm`.
- `lib/schedule/use-delete-schedule-items.ts`: new TanStack mutation for atomic bulk delete.
- `supabase/migrations/0022_schedule_bulk_delete.sql`: new RPC for bulk delete and order repair.
- `lib/supabase/browser-client.ts`: explicit auth persistence and refresh options.
- `app/login/page.tsx`: already-signed-in redirect before sign-in flow.
- `app/page.tsx`: remove first-screen design-system CTA.
- `app/settings/page.tsx`: remove user-facing design palette link.

### 5.2 Layout Mechanics

`ScheduleTab` should render a layout wrapper with two modes:

- Mobile: one column with a map region and a scrollable schedule content region.
- `lg` and up: CSS grid with `minmax(0, 1fr)` schedule column and a fixed-width or fractional map column. The map column uses sticky positioning below the app bar.

The scroll container should be explicit so only the schedule side scrolls on wide screens. The bottom tab bar/FAB spacing must remain accounted for.

### 5.3 Gesture Mechanics

Use a small long-press helper for the card body rather than reusing the dnd-kit drag sensors. The helper starts a timer on pointer/touch down and cancels on pointer up, pointer leave, scroll-like movement, or context menu. A completed long press calls `enterSelectionMode(item)`.

Because the drag sensors already live on the number/handle, their activation remains isolated from card-body long press.

Keyboard and accessibility fallback:

- The old visible `선택` button can be removed from the compact header, but a selection action must remain reachable through card controls or accessible labels.
- In selection mode, checkboxes remain accessible by screen readers.
- Escape or `취소` exits selection mode.

### 5.4 Bulk Delete RPC Contract

Add `delete_schedule_items(p_item_ids uuid[]) returns void`.

Server behavior:

- Require authenticated user.
- Reject an empty item array.
- Lock and load all requested schedule items with their trip days.
- Ensure all requested ids exist.
- Ensure the user can access the owning trip.
- Ensure all selected items belong to one trip.
- Delete the selected rows.
- Recompute `sort_order` for each affected `trip_day_id`.

The client mutation passes selected ids in current-day order. The RPC does not trust client order for authorization or repair.

### 5.5 Auth Mechanics

Configure the browser Supabase client with explicit auth options:

- `persistSession: true`
- `autoRefreshToken: true`
- `detectSessionInUrl: true`

The login page should call `supabase.auth.getSession()` or `getUser()` before initializing Google sign-in. If a valid session exists, call `router.replace(redirectPath)`.

Redirect login should avoid forcing account choice unless the user explicitly needs account switching. Removing `prompt: "select_account"` can reduce repeated account chooser friction, but the design should preserve a path to switch accounts through logout.

## 6. Error Handling

- Map SDK load failures keep the layout area visible and show the existing map fallback/loading behavior if available.
- Bulk delete failures keep selection mode active so the user does not lose context.
- Bulk move failures keep selection mode active and show the existing toast error.
- Login redirect checks must avoid an infinite redirect loop: `/login` only redirects away when a valid session is present.
- Desktop time picker rejects impossible values in the component before submit; the form still submits only valid `HH:mm` or null.

## 7. Testing Strategy

### Unit Tests

- Desktop time conversion: `오전 12:xx` -> `00:xx`, `오후 12:xx` -> `12:xx`, `오후 5:16` -> `17:16`.
- Time field environment choice keeps native input for touch/mobile and custom picker for pointer/desktop.
- Long-press helper enters selection after the configured delay and cancels on early release.
- Sortable schedule item selection mode still toggles selected rows.

### Integration Tests

- `delete_schedule_items` deletes multiple same-day items and repairs `sort_order`.
- `delete_schedule_items` deletes items across affected days and repairs each day.
- `delete_schedule_items` rejects inaccessible or missing ids atomically.

### E2E Tests

- Desktop schedule view shows left schedule and right map, and scrolling the schedule does not scroll the map away.
- Mobile schedule view keeps a larger map area and a compact day/header area.
- Long-pressing a card enters selection mode, then selected items can be moved to another day.
- Long-pressing a card enters selection mode, then selected items can be deleted after confirmation.
- Desktop time picker shows AM before PM and saves the expected time.
- Mobile time input remains native enough that the app does not render the desktop custom picker.
- Visiting `/login` with an existing authenticated storage state redirects to `/trips`.
- Landing page does not show `디자인 시스템 보기`.

## 8. Release Criteria

- New design-system links are absent from normal landing/settings UI.
- Schedule tab remains usable on mobile, tablet, and desktop.
- Map area is materially larger than the previous 240px panel and remains visible while schedule content scrolls.
- Long-press card selection supports move and delete.
- Desktop time picker always orders `오전` before `오후`.
- Existing single schedule create/edit/delete, drag reorder, marker focus, and bulk move flows still pass.
- `npm test`, `npm run lint`, `npm run build`, and targeted Playwright specs pass before shipping.

## 9. Open Follow-Up

The `/design` route itself can remain as a development-only direct URL. This spec removes normal user-facing entry points to it; deleting the route is intentionally left for a separate cleanup if desired.
