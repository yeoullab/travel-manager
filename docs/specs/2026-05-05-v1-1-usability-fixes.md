---
type: design-spec
project: travel-manager
date: 2026-05-05
status: implemented
source: MY_AI_WIKI/projects/travel-manager/raw/ver1.v1 요구사항.md
target-version: v1.1.0
author: AI + human collaborative design
---

# travel-manager v1.1 Usability Fixes

## 1. Goal

v1.1 closes the first real-use friction after V1 GA. The release focuses on schedule place correctness, faster schedule/expense workflows, clearer guest sharing, and a visible product version.

## 2. Source Requirements

1. When a place search fails and the user manually enters an address, map/link display should use that entered address, not an arbitrary address.
2. Lodging schedules can be registered across a date range at once.
3. Multiple schedule items can be selected and moved to another day together.
4. When creating an expense from a schedule item, match the expense category to the schedule category.
5. Tapping a schedule list number focuses the map on the matching marker.
6. Editing a manually entered place currently loses the place name and cannot be saved.
7. Guest URL needs clearer day separation.
8. Maps should have a visible border.
9. Guest URL memo text is clipped.
10. The app should display the version.

## 3. Scope

### Checkpoint A: Low-Risk Bug And UX Fixes

Includes requirements 1, 4, 5, 6, 7, 8, 9, and 10.

This checkpoint must be shippable on its own. It should not require new complex interaction modes beyond small UI affordances and one manual-place data correction.

### Checkpoint B: Bulk Schedule Features

Includes requirements 2 and 3.

This checkpoint introduces new schedule creation/move workflows and must be verified separately from Checkpoint A.

## 4. Product Decisions

### 4.1 Manual Places Become Structured Data

Current behavior stores manual addresses by prepending `주소: ...` to `memo` because `schedule_items_place_atomic` only permits place data when lat/lng/provider exist. This makes edit mode lose structured place state and causes save failures for manual places.

v1.1 changes manual places to a first-class state:

- Search result place: `place_name`, `place_address`, `place_lat`, `place_lng`, and `place_provider` are present.
- Manual place: `place_name` and `place_address` are present; `place_lat`, `place_lng`, `place_provider`, and `place_external_id` are null.
- No place: all place fields are null.

Manual address is no longer written into `memo`.

### 4.2 Map Rendering Does Not Fake Coordinates

Manual places do not create map markers unless lat/lng exist. For manual places, "지도에서 보기" resolves to an external map search URL based on the entered address/name.

Domestic trips use Naver search URL. International trips use Google Maps search URL.

### 4.3 Lodging Range Registration

When category is `lodging` in create mode, the user can select a start day and end day inside the trip. Saving creates one lodging schedule item per selected day with the same title, manual/search place, time, memo, and URL.

The default range is the active day only. Edit mode remains single-item editing.

### 4.4 Bulk Day Move

Schedule list gets a selection mode. The user can select multiple items on the current day, choose a target day, and move them to the end of that target day in their current order.

The target day cannot be the current day. The move is atomic at the RPC level so partial moves do not leave inconsistent sort order.

### 4.5 Expense Category Mapping

When expense creation is launched from a schedule item, prefill category by this mapping:

| Schedule category | Expense category |
|---|---|
| `food` | `food` |
| `transport` | `transport` |
| `lodging` | `lodging` |
| `shopping` | `shopping` |
| `sightseeing` | `activity` |
| `other` | `other` |

Manual expense creation still defaults to `food`.

### 4.6 Guest Share Readability

Guest schedule days are rendered as clearly separated day sections. Map panels get borders, and memo text in schedule, expense, and todo rows must wrap instead of truncating.

### 4.7 Version Display

The settings footer shows `트레블매니저 · v1.1.0`. `package.json` is updated to `1.1.0`.

## 5. Technical Design

### 5.1 Database And RPC

Add migration `0021_schedule_manual_place_and_bulk.sql`.

This migration must:

- Replace `schedule_items_place_atomic` so manual places are valid without coordinates.
- Recreate `create_schedule_item` and `update_schedule_item` with the same public signature, preserving `p_place_external_url`.
- Add `create_lodging_schedule_items_for_range(...) returns uuid[]`.
- Add `move_schedule_items_to_day(p_item_ids uuid[], p_target_day_id uuid) returns void`.

All SECURITY DEFINER functions must check:

- `auth.uid()` is present.
- The current user can access the trip.
- All moved/created items belong to the same trip.
- Target days belong to the same trip.
- Provider mismatch rules still hold for coordinate-backed search places.

### 5.2 Client Data Flow

`ScheduleItemModal` owns form state and emits either a single-item payload or a lodging range payload. `ScheduleTab` decides which mutation to call.

Manual place fields are represented as a lightweight `PlaceDraft` instead of overloading `PlaceResult`, because a manual place has no coordinates/provider.

`resolvePlaceLink` accepts optional `placeAddress`. It resolves in this order:

1. valid `placeExternalUrl`
2. coordinate fallback
3. address/name search fallback
4. null

### 5.3 UI Changes

- `MapPanel` gets a border and optional imperative focus support.
- Schedule item number button supports two behaviors:
  - long-press drag still reorders
  - tap focuses the map marker when the map is open and the item has coordinates
- Selection mode uses checkboxes/toggles on schedule rows. It does not overload drag handles.
- Guest day sections are visually separated with bordered section bands, not nested cards.
- Version display remains in settings, not in every screen.

### 5.4 Next.js 16 Notes

The app uses Next.js 16. Route `params` remain Promise-based in server pages. Client interactivity stays inside `"use client"` components. Guest share page remains a Server Component and must only pass serializable props to client components.

## 6. Testing Strategy

### Unit Tests

- Manual place link resolution with address fallback.
- Schedule-to-expense category mapping.
- Manual place edit stage detection.
- Version constant formatting if extracted.

### Integration Tests

- Manual place can be created and updated with `place_name + place_address` and null coordinates.
- Coordinate-backed place behavior still passes provider checks.
- Lodging range RPC creates one item per day and preserves order.
- Bulk move RPC rejects mixed-trip items and moves same-trip items atomically.
- Expense RPC continues to reject cross-trip `schedule_item_id`.

### E2E Tests

- Manual place create -> edit -> save roundtrip.
- Schedule quickAdd to expense preselects mapped category.
- Guest share shows full memo and day separation.
- Bulk move selected items to another day.
- Lodging range creates multiple day entries.

## 7. Security And Privacy

- Guest share continues to expose only data already returned by `get_guest_trip_data`; no profile email or member data is added.
- Manual addresses are user-entered trip content and are visible in guest share only when schedule sharing is enabled.
- Bulk RPCs must not trust client-provided item/day relationships.
- External map links only use `https://` URLs or generated Naver/Google search URLs.

## 8. Out Of Scope

- Custom categories.
- Settlement and statistics.
- Multiple groups.
- Map geocoding for manually entered addresses.
- Full offline/background sync for v1.1 workflows.

## 9. Release Criteria

- `package.json` version is `1.1.0`.
- All Checkpoint A tests pass before Checkpoint B begins.
- Full typecheck, lint, unit, targeted integration, and targeted E2E pass before release tagging.
- Wiki `status.md`, `handoff.md`, and a new v1.1 session log are updated at `/wiki-end`.

## 10. Implementation Notes

### 10.1 Migration

- Database changes are in `supabase/migrations/0021_schedule_manual_place_and_bulk.sql`.
- The migration updates manual-place validity and schedule RPC signatures, then adds `create_lodging_schedule_items_for_range(...)` and `move_schedule_items_to_day(...)`.

### 10.2 Final Verification

Fresh Task 11 verification was run on 2026-05-05 from branch `codex/v1.1-usability-fixes`.

- `npm test` -> 40 files / 161 tests passed.
- `npm run lint` -> 0 errors, 9 existing warnings.
- `npm run build` -> passed. Existing Next warnings remain: workspace-root inference and `middleware` to `proxy` deprecation.
- `npm run test:integration -- tests/integration/schedule-v1-1-rpc.test.ts tests/integration/schedule-rpc-with-place-external-url.test.ts tests/integration/expenses-schedule-link.test.ts` -> 3 files / 11 tests passed against local Supabase `travel-manager-e2e-55321`.
- `npm run test:e2e -- tests/e2e/manual-place-edit.spec.ts tests/e2e/expenses-from-schedule.spec.ts tests/e2e/guest-share-readability.spec.ts tests/e2e/lodging-range-and-bulk-move.spec.ts` -> 5 tests passed against local Supabase `travel-manager-e2e-55321`.

The implementation plan originally referenced draft integration filenames `schedule-manual-place.test.ts` and `schedule-bulk-rpc.test.ts`. Final coverage lives in `tests/integration/schedule-v1-1-rpc.test.ts`.

### 10.3 Manual Follow-Up

- No additional v1.1 manual QA blocker was found in the local verification pass.
- Existing V1 production setup follow-up remains: add the production domain to NCP Naver Maps and Google Cloud Maps API referrer allowlists so live production map SDK calls are not referrer-blocked. Coordinate storage and generated external map links are covered separately by automated tests.
