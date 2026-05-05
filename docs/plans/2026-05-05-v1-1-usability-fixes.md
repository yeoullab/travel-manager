# v1.1 Usability Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v1.1.0 with manual place correctness, schedule-to-expense category matching, map/list focus polish, guest-share readability fixes, visible versioning, lodging range create, and bulk schedule day move.

**Architecture:** Checkpoint A ships low-risk fixes first: manual place data model, link fallback, map/list focus, expense prefill, guest share presentation, and version display. Checkpoint B adds two bulk schedule workflows with database-level atomic RPCs and focused UI states. Existing Supabase RPC, TanStack Query hooks, and compact mobile UI patterns are preserved.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase Postgres/RLS/RPC, TanStack Query, Tailwind v4, Vitest, Playwright.

---

## Source Documents

- Spec: `docs/specs/2026-05-05-v1-1-usability-fixes.md`
- Raw wiki source: `/Users/sohyun/Library/CloudStorage/SynologyDrive-home/앱/MY_AI_WIKI/projects/travel-manager/raw/ver1.v1 요구사항.md`
- Current schedule RPC source: `supabase/migrations/0020_schedule_rpc_place_external_url.sql`
- Current place CHECK source: `supabase/migrations/0005_schedule_items.sql`

## Checkpoint Order

1. Checkpoint A: Tasks 1-7. Ship-safe bug and UX fixes.
2. Run Checkpoint A verification.
3. Checkpoint B: Tasks 8-10. Bulk schedule creation and move.
4. Run full release verification.

## Files

### Create

- `supabase/migrations/0021_schedule_manual_place_and_bulk.sql`
- `lib/schedule/category-map.ts`
- `lib/schedule/use-create-lodging-schedule-items-for-range.ts`
- `lib/schedule/use-move-schedule-items-to-day.ts`
- `lib/version.ts`
- `tests/unit/schedule-expense-category-map.test.ts`
- `tests/integration/schedule-manual-place.test.ts`
- `tests/integration/schedule-bulk-rpc.test.ts`
- `tests/e2e/manual-place-edit.spec.ts`
- `tests/e2e/guest-share-readability.spec.ts`
- `tests/e2e/lodging-range-and-bulk-move.spec.ts`

### Modify

- `package.json`
- `lib/maps/place-link.ts`
- `lib/maps/types.ts`
- `lib/schedule/use-create-schedule-item.ts`
- `lib/schedule/use-update-schedule-item.ts`
- `components/schedule/schedule-item-modal.tsx`
- `components/schedule/sortable-schedule-item.tsx`
- `components/schedule/schedule-list.tsx`
- `components/schedule/map-panel.tsx`
- `components/trip/schedule-tab.tsx`
- `components/trip/expenses-tab.tsx`
- `components/ui/schedule-item.tsx`
- `components/ui/expense-row.tsx`
- `app/share/[token]/page.tsx`
- `app/settings/page.tsx`
- `types/database.ts`

---

## Task 1: Manual Place Link And Category Mapping Unit Layer

**Files:**
- Modify: `lib/maps/place-link.ts`
- Modify: `lib/maps/types.ts`
- Create: `lib/schedule/category-map.ts`
- Test: `tests/unit/place-link.test.ts`
- Test: `tests/unit/schedule-expense-category-map.test.ts`

- [ ] **Step 1: Add failing tests for manual address fallback**

Add these cases to `tests/unit/place-link.test.ts`:

```ts
it("국내 수기 장소는 주소 기반 Naver 검색 URL을 반환한다", () => {
  const url = resolvePlaceLink({
    placeExternalUrl: null,
    placeLat: null,
    placeLng: null,
    placeName: "이름 모를 식당",
    placeAddress: "서울특별시 종로구 세종대로 175",
    isDomestic: true,
  });
  expect(url).toBe(
    `https://map.naver.com/v5/search/${encodeURIComponent("서울특별시 종로구 세종대로 175")}`,
  );
});

it("해외 수기 장소는 주소 기반 Google Maps 검색 URL을 반환한다", () => {
  const url = resolvePlaceLink({
    placeExternalUrl: null,
    placeLat: null,
    placeLng: null,
    placeName: "Small cafe",
    placeAddress: "1 Chome Shibuya Tokyo",
    isDomestic: false,
  });
  expect(url).toBe(
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("1 Chome Shibuya Tokyo")}`,
  );
});
```

- [ ] **Step 2: Create failing category mapping tests**

Create `tests/unit/schedule-expense-category-map.test.ts`:

```ts
import { expenseCategoryForScheduleCategory } from "@/lib/schedule/category-map";

describe("expenseCategoryForScheduleCategory", () => {
  it.each([
    ["food", "food"],
    ["transport", "transport"],
    ["lodging", "lodging"],
    ["shopping", "shopping"],
    ["sightseeing", "activity"],
    ["other", "other"],
  ] as const)("maps %s to %s", (schedule, expense) => {
    expect(expenseCategoryForScheduleCategory(schedule)).toBe(expense);
  });
});
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
npm test -- tests/unit/place-link.test.ts tests/unit/schedule-expense-category-map.test.ts
```

Expected: FAIL because `placeAddress` is not accepted and `category-map.ts` does not exist.

- [ ] **Step 4: Update place link input and implementation**

Update `lib/maps/place-link.ts`:

```ts
export type PlaceLinkInput = {
  placeExternalUrl: string | null;
  placeLat: number | null;
  placeLng: number | null;
  placeName?: string | null;
  placeAddress?: string | null;
  isDomestic: boolean;
};

function cleanSearchText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function resolvePlaceLink(item: PlaceLinkInput): string | null {
  if (item.placeExternalUrl && /^https?:\/\//i.test(item.placeExternalUrl)) {
    return item.placeExternalUrl;
  }

  if (
    item.placeLat != null &&
    item.placeLng != null &&
    Number.isFinite(item.placeLat) &&
    Number.isFinite(item.placeLng)
  ) {
    if (item.isDomestic) {
      const q = encodeURIComponent(item.placeName || `${item.placeLat},${item.placeLng}`);
      return `https://map.naver.com/v5/search/${q}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${item.placeLat},${item.placeLng}`;
  }

  const query = cleanSearchText(item.placeAddress) ?? cleanSearchText(item.placeName);
  if (!query) return null;
  const encoded = encodeURIComponent(query);
  return item.isDomestic
    ? `https://map.naver.com/v5/search/${encoded}`
    : `https://www.google.com/maps/search/?api=1&query=${encoded}`;
}
```

- [ ] **Step 5: Add category mapping module**

Create `lib/schedule/category-map.ts`:

```ts
import type { ScheduleCategory } from "@/lib/types";
import type { ExpenseCategoryCode } from "@/lib/expense/constants";

const SCHEDULE_TO_EXPENSE_CATEGORY: Record<ScheduleCategory, ExpenseCategoryCode> = {
  food: "food",
  transport: "transport",
  lodging: "lodging",
  shopping: "shopping",
  sightseeing: "activity",
  other: "other",
};

export function expenseCategoryForScheduleCategory(
  category: ScheduleCategory | string | null | undefined,
): ExpenseCategoryCode {
  if (!category) return "other";
  return SCHEDULE_TO_EXPENSE_CATEGORY[category as ScheduleCategory] ?? "other";
}
```

- [ ] **Step 6: Run tests and commit**

Run:

```bash
npm test -- tests/unit/place-link.test.ts tests/unit/schedule-expense-category-map.test.ts
```

Expected: PASS.

Commit:

```bash
git add -- lib/maps/place-link.ts lib/schedule/category-map.ts tests/unit/place-link.test.ts tests/unit/schedule-expense-category-map.test.ts
git commit -m "test: cover manual place links and category mapping"
```

---

## Task 2: Manual Place Database Contract

**Files:**
- Create: `supabase/migrations/0021_schedule_manual_place_and_bulk.sql`
- Modify: `types/database.ts`
- Test: `tests/integration/schedule-manual-place.test.ts`

- [ ] **Step 1: Write failing integration tests**

Create `tests/integration/schedule-manual-place.test.ts` with owner setup matching existing integration helpers in `tests/integration/create-schedule-item.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { env } from "@/lib/env";

const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

describe("schedule manual place RPC", () => {
  it("creates a manual place without coordinates", async () => {
    const tripDayId = process.env.TEST_TRIP_DAY_ID;
    if (!tripDayId) return;

    const { data: id, error } = await (admin as any).rpc("create_schedule_item", {
      p_trip_day_id: tripDayId,
      p_title: "수기 장소",
      p_place_name: "이름 모를 식당",
      p_place_address: "서울특별시 종로구 세종대로 175",
      p_place_lat: null,
      p_place_lng: null,
      p_place_provider: null,
      p_place_external_id: null,
      p_category_code: "food",
    });

    expect(error).toBeNull();
    expect(id).toEqual(expect.any(String));
  });
});
```

Before implementation, adapt setup to the existing integration test fixture style rather than relying on `TEST_TRIP_DAY_ID`. The final test must create its own trip/day and authenticated client.

- [ ] **Step 2: Run targeted integration test and verify it fails**

Run:

```bash
npm run test:integration -- tests/integration/schedule-manual-place.test.ts
```

Expected: FAIL with `schedule_items_place_atomic` check violation.

- [ ] **Step 3: Add migration**

Create `supabase/migrations/0021_schedule_manual_place_and_bulk.sql`.

Required CHECK replacement:

```sql
alter table public.schedule_items
  drop constraint if exists schedule_items_place_atomic;

alter table public.schedule_items
  add constraint schedule_items_place_atomic check (
    (
      place_name is null
      and place_address is null
      and place_lat is null
      and place_lng is null
      and place_provider is null
      and place_external_id is null
    )
    or
    (
      place_name is not null
      and place_address is not null
      and place_lat is null
      and place_lng is null
      and place_provider is null
      and place_external_id is null
    )
    or
    (
      place_name is not null
      and place_lat is not null
      and place_lng is not null
      and place_provider is not null
    )
  );
```

Also recreate `create_schedule_item` and `update_schedule_item` from `0020_schedule_rpc_place_external_url.sql`, preserving the 13-parameter signatures and grants. Add this provider check condition before insert/update:

```sql
if p_place_provider is not null then
  if p_place_lat is null or p_place_lng is null then
    raise exception 'place_coordinate_required';
  end if;
  if v_is_domestic and p_place_provider != 'naver' then
    raise exception 'place_provider_mismatch';
  end if;
  if not v_is_domestic and p_place_provider != 'google' then
    raise exception 'place_provider_mismatch';
  end if;
end if;
```

- [ ] **Step 4: Apply migration and regenerate types**

Run:

```bash
npx supabase db push
npm run db:types
```

Expected: migration applies and `types/database.ts` includes unchanged `schedule_items` columns.

- [ ] **Step 5: Run integration tests and commit**

Run:

```bash
npm run test:integration -- tests/integration/schedule-manual-place.test.ts
npm run test:integration -- tests/integration/schedule-rpc-with-place-external-url.test.ts
```

Expected: PASS.

Commit:

```bash
git add -- supabase/migrations/0021_schedule_manual_place_and_bulk.sql types/database.ts tests/integration/schedule-manual-place.test.ts
git commit -m "feat(db): support manual schedule places"
```

---

## Task 3: Manual Place Form Roundtrip

**Files:**
- Modify: `lib/maps/types.ts`
- Modify: `lib/schedule/use-create-schedule-item.ts`
- Modify: `lib/schedule/use-update-schedule-item.ts`
- Modify: `components/schedule/schedule-item-modal.tsx`
- Modify: `components/trip/schedule-tab.tsx`
- Modify: `components/ui/schedule-item.tsx`
- Test: `tests/unit/schedule-item-modal-stage.test.ts`
- Test: `tests/e2e/manual-place-edit.spec.ts`

- [ ] **Step 1: Extend place typing**

Add to `lib/maps/types.ts`:

```ts
export type PlaceDraft =
  | { kind: "none" }
  | { kind: "search"; place: PlaceResult }
  | { kind: "manual"; name: string; address: string };
```

- [ ] **Step 2: Update stage tests**

Extend `tests/unit/schedule-item-modal-stage.test.ts`:

```ts
it("returns manual_place for place_name + place_address without coordinates", () => {
  expect(
    initialStageFor(
      mkItem({
        category_code: "food",
        title: "수기 장소",
        place_name: "이름 모를 식당",
        place_address: "서울특별시 종로구",
        place_lat: null,
        place_lng: null,
        place_provider: null,
      }),
    ),
  ).toBe("manual_place");
});
```

- [ ] **Step 3: Run stage test and verify failure**

Run:

```bash
npm test -- tests/unit/schedule-item-modal-stage.test.ts
```

Expected: FAIL because `initialStageFor` returns `place_search`.

- [ ] **Step 4: Update modal form value**

Change `ScheduleItemFormValue` in `components/schedule/schedule-item-modal.tsx`:

```ts
export type ScheduleItemFormValue = {
  title: string;
  categoryCode: ScheduleCategory;
  timeOfDay: string | null;
  memo: string | null;
  url: string | null;
  place: PlaceDraft;
};
```

Update `initialStageFor`:

```ts
if (initial.place_name && initial.place_address && initial.place_lat == null && initial.place_lng == null) {
  return "manual_place";
}
```

Update open effect:

```ts
setTitle(initial?.title ?? "");
setAddressManual(
  initial?.place_name && initial.place_address && initial.place_lat == null
    ? initial.place_address
    : "",
);
```

Update `submit()`:

```ts
const placeDraft: PlaceDraft =
  stage === "manual_place"
    ? { kind: "manual", name: titleTrim, address: addressManual.trim() }
    : place
      ? { kind: "search", place }
      : { kind: "none" };

onSubmit({
  title: titleTrim,
  categoryCode,
  timeOfDay: timeOfDay || null,
  memo: memo.trim() || null,
  url: url.trim() || null,
  place: placeDraft,
});
```

- [ ] **Step 5: Update ScheduleTab payload mapping**

In `components/trip/schedule-tab.tsx`, replace memo-prepend logic with:

```ts
const placeFields =
  value.place.kind === "search"
    ? {
        placeName: value.place.place.name,
        placeAddress: value.place.place.address,
        placeLat: value.place.place.lat,
        placeLng: value.place.place.lng,
        placeProvider: value.place.place.provider,
        placeExternalId: value.place.place.externalId,
        placeExternalUrl: value.place.place.externalUrl ?? null,
      }
    : value.place.kind === "manual"
      ? {
          placeName: value.place.name,
          placeAddress: value.place.address,
          placeLat: null,
          placeLng: null,
          placeProvider: null,
          placeExternalId: null,
          placeExternalUrl: null,
        }
      : {
          placeName: null,
          placeAddress: null,
          placeLat: null,
          placeLng: null,
          placeProvider: null,
          placeExternalId: null,
          placeExternalUrl: null,
        };
```

Then spread `placeFields` into the mutation base.

- [ ] **Step 6: Pass placeAddress to cards**

Add `placeAddress?: string` to `ScheduleItemProps` in `components/ui/schedule-item.tsx`, and pass it to `resolvePlaceLink` at call sites.

- [ ] **Step 7: Run tests and commit**

Run:

```bash
npm test -- tests/unit/schedule-item-modal-stage.test.ts tests/unit/place-link.test.ts
npm run test:e2e -- tests/e2e/manual-place-edit.spec.ts
```

Expected: PASS.

Commit:

```bash
git add -- lib/maps/types.ts lib/schedule/use-create-schedule-item.ts lib/schedule/use-update-schedule-item.ts components/schedule/schedule-item-modal.tsx components/trip/schedule-tab.tsx components/ui/schedule-item.tsx tests/unit/schedule-item-modal-stage.test.ts tests/e2e/manual-place-edit.spec.ts
git commit -m "fix(schedule): preserve manual places through edit"
```

---

## Task 4: Map Border And List Number Focus

**Files:**
- Modify: `lib/maps/types.ts`
- Modify: `lib/maps/providers/naver-provider.ts`
- Modify: `lib/maps/providers/google-provider.ts`
- Modify: `components/schedule/map-panel.tsx`
- Modify: `components/schedule/sortable-schedule-item.tsx`
- Modify: `components/schedule/schedule-list.tsx`
- Modify: `components/trip/schedule-tab.tsx`

- [ ] **Step 1: Extend map handle**

Add to `MapHandle` in `lib/maps/types.ts`:

```ts
focusMarker?(id: string): void;
```

Add optional `id?: string` to `MarkerSpec`.

- [ ] **Step 2: Implement provider focus**

In both providers, store markers by `spec.id`.

Naver focus:

```ts
const markerById = new Map<string, { marker: NaverMarker; lat: number; lng: number }>();

focusMarker(id: string) {
  const target = markerById.get(id);
  if (!target) return;
  map.setCenter(new ns.LatLng(target.lat, target.lng));
}
```

Google focus:

```ts
const markerById = new Map<string, { marker: GoogleMarker; lat: number; lng: number }>();

focusMarker(id: string) {
  const target = markerById.get(id);
  if (!target) return;
  map.setCenter(new gm.LatLng(target.lat, target.lng));
}
```

- [ ] **Step 3: Add MapPanel API and border**

Update `MapPanel` props:

```ts
type Props = {
  isDomestic: boolean;
  items: MapItem[];
  onMarkerClick?: (itemId: string) => void;
  focusedItemId?: string | null;
};
```

Pass marker ids:

```ts
id: it.id,
lat: it.place_lat,
lng: it.place_lng,
label: it.label,
onClick: onMarkerClick ? () => onMarkerClick(it.id) : undefined,
```

Add focus effect:

```ts
useEffect(() => {
  if (!ready || !focusedItemId) return;
  handleRef.current?.focusMarker?.(focusedItemId);
}, [focusedItemId, ready]);
```

Change class:

```tsx
className="bg-surface-200 border-border-primary mt-3 h-[240px] w-full overflow-hidden rounded-[12px] border"
```

- [ ] **Step 4: Add list-number tap callback**

In `SortableScheduleItem`, add prop:

```ts
onNumberTap?: (item: ScheduleItem) => void;
```

Change button click:

```ts
onClick={(e) => {
  e.stopPropagation();
  onNumberTap?.(item);
}}
```

In `ScheduleList`, pass through `onNumberTap`.

- [ ] **Step 5: Wire ScheduleTab focus behavior**

Add state:

```ts
const [focusedMapItemId, setFocusedMapItemId] = useState<string | null>(null);
```

Add handler:

```ts
const handleNumberTap = useCallback(
  (item: ScheduleItem) => {
    if (item.place_lat == null || item.place_lng == null) return;
    if (!mapOpen) toggleMap();
    setFocusedMapItemId(item.id);
  },
  [mapOpen],
);
```

Pass `focusedItemId={focusedMapItemId}` to `MapPanel` and `onNumberTap={handleNumberTap}` to `ScheduleList`.

- [ ] **Step 6: Run verification and commit**

Run:

```bash
npm test -- tests/unit/provider-selector.test.ts
npm run lint
```

Expected: PASS with 0 lint errors.

Commit:

```bash
git add -- lib/maps/types.ts lib/maps/providers/naver-provider.ts lib/maps/providers/google-provider.ts components/schedule/map-panel.tsx components/schedule/sortable-schedule-item.tsx components/schedule/schedule-list.tsx components/trip/schedule-tab.tsx
git commit -m "feat(schedule): focus map from schedule numbers"
```

---

## Task 5: Expense QuickAdd Category Prefill

**Files:**
- Modify: `components/trip/expenses-tab.tsx`
- Test: `tests/e2e/expenses-from-schedule.spec.ts`

- [ ] **Step 1: Add E2E assertion**

In `tests/e2e/expenses-from-schedule.spec.ts`, seed/select a sightseeing schedule item, click "이 일정의 경비 추가", and assert the `관광` expense category radio is checked.

Expected assertion:

```ts
await expect(page.getByRole("radio", { name: "관광" })).toHaveAttribute("aria-checked", "true");
```

- [ ] **Step 2: Run E2E and verify failure**

Run:

```bash
npm run test:e2e -- tests/e2e/expenses-from-schedule.spec.ts
```

Expected: FAIL because create sheet defaults to `food`.

- [ ] **Step 3: Add prefill category**

In `components/trip/expenses-tab.tsx`, add to `Prefill`:

```ts
categoryCode?: ExpenseCategoryCode;
```

Import mapping:

```ts
import { expenseCategoryForScheduleCategory } from "@/lib/schedule/category-map";
```

Set quickAdd prefill:

```ts
categoryCode: expenseCategoryForScheduleCategory(item.category_code),
```

Update `buildInitialValues`:

```ts
categoryCode: prefill?.categoryCode ?? "food",
```

- [ ] **Step 4: Run tests and commit**

Run:

```bash
npm test -- tests/unit/schedule-expense-category-map.test.ts
npm run test:e2e -- tests/e2e/expenses-from-schedule.spec.ts
```

Expected: PASS.

Commit:

```bash
git add -- components/trip/expenses-tab.tsx tests/e2e/expenses-from-schedule.spec.ts
git commit -m "fix(expense): prefill category from schedule item"
```

---

## Task 6: Guest Share Readability

**Files:**
- Modify: `app/share/[token]/page.tsx`
- Modify: `components/ui/schedule-item.tsx`
- Modify: `components/ui/expense-row.tsx`
- Test: `tests/e2e/guest-share-readability.spec.ts`

- [ ] **Step 1: Add E2E readability test**

Create `tests/e2e/guest-share-readability.spec.ts`.

The test must:

- create a trip with two days,
- create schedule items on both days with long memo,
- create a guest share with schedule visible,
- open share URL in anonymous context,
- assert `Day 1` and `Day 2` are visible in distinct sections,
- assert the full memo text is visible.

- [ ] **Step 2: Run E2E and verify failure**

Run:

```bash
npm run test:e2e -- tests/e2e/guest-share-readability.spec.ts
```

Expected: FAIL because memo text is truncated.

- [ ] **Step 3: Update ScheduleItem wrapping behavior**

Add prop to `components/ui/schedule-item.tsx`:

```ts
compactMeta?: boolean;
```

Use existing single-line layout when `compactMeta !== false`. When `compactMeta === false`, render category, place, and memo in stacked wrapping rows:

```tsx
{compactMeta === false ? (
  <div className="text-ink-600 mt-1 flex flex-col gap-1 text-[12px]">
    <span>{categoryLabel[category]}</span>
    {placeName && <span className="break-words">{placeName}</span>}
    {memo && <p className="whitespace-pre-wrap break-words leading-[1.5]">{memo}</p>}
  </div>
) : (
  existingMetaRow
)}
```

- [ ] **Step 4: Update guest page sections**

In `app/share/[token]/page.tsx`:

- Wrap each day with `className="border-border-primary bg-surface-100 rounded-[12px] border p-3"`.
- Keep the map and list inside the day section.
- Pass `compactMeta={false}` to `ScheduleItem`.
- For todos, change memo from `truncate` to `whitespace-pre-wrap break-words`.
- For expenses, pass a new `wrapMemo` prop to `ExpenseRow`.

- [ ] **Step 5: Update ExpenseRow wrap prop**

Add to `ExpenseRowProps`:

```ts
wrapMemo?: boolean;
```

Render memo class:

```tsx
{memo && (
  <p className={cn(
    "text-ink-600 min-w-0 flex-1 text-[12px]",
    wrapMemo ? "whitespace-pre-wrap break-words leading-[1.5]" : "truncate",
  )}>
    {memo}
  </p>
)}
```

- [ ] **Step 6: Run tests and commit**

Run:

```bash
npm run test:e2e -- tests/e2e/guest-share-readability.spec.ts
npm run lint
```

Expected: PASS.

Commit:

```bash
git add -- app/share/[token]/page.tsx components/ui/schedule-item.tsx components/ui/expense-row.tsx tests/e2e/guest-share-readability.spec.ts
git commit -m "fix(share): improve guest schedule readability"
```

---

## Task 7: Version Display And Checkpoint A Verification

**Files:**
- Modify: `package.json`
- Create: `lib/version.ts`
- Modify: `app/settings/page.tsx`
- Modify: `docs/specs/2026-05-05-v1-1-usability-fixes.md`

- [ ] **Step 1: Update package version**

Change `package.json`:

```json
"version": "1.1.0"
```

- [ ] **Step 2: Create version module**

Create `lib/version.ts`:

```ts
import pkg from "@/package.json";

export const APP_VERSION = pkg.version;
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
```

- [ ] **Step 3: Update settings footer**

In `app/settings/page.tsx`, import:

```ts
import { APP_VERSION_LABEL } from "@/lib/version";
```

Replace stale footer:

```tsx
<p className="text-ink-500 mt-8 text-center text-[11px]">
  트레블매니저 · {APP_VERSION_LABEL}
</p>
```

- [ ] **Step 4: Run Checkpoint A verification**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: unit tests pass, lint has 0 errors, build succeeds.

- [ ] **Step 5: Commit**

Commit:

```bash
git add -- package.json lib/version.ts app/settings/page.tsx docs/specs/2026-05-05-v1-1-usability-fixes.md
git commit -m "chore: display v1.1 app version"
```

---

## Task 8: Lodging Range RPC And Hook

**Files:**
- Modify: `supabase/migrations/0021_schedule_manual_place_and_bulk.sql`
- Create: `lib/schedule/use-create-lodging-schedule-items-for-range.ts`
- Modify: `lib/query/keys.ts`
- Test: `tests/integration/schedule-bulk-rpc.test.ts`

- [ ] **Step 1: Add failing integration test for lodging range**

In `tests/integration/schedule-bulk-rpc.test.ts`, add:

```ts
it("creates lodging items for every day in range", async () => {
  const { tripId, dayIds } = await createTripWithDays(3);
  const { data, error } = await (aliceC as any).rpc("create_lodging_schedule_items_for_range", {
    p_trip_id: tripId,
    p_start_day_id: dayIds[0],
    p_end_day_id: dayIds[2],
    p_title: "호텔",
    p_time_of_day: "15:00",
    p_place_name: "호텔",
    p_place_address: "서울 중구",
    p_place_lat: null,
    p_place_lng: null,
    p_place_provider: null,
    p_place_external_id: null,
    p_memo: "체크인",
    p_url: null,
    p_place_external_url: null,
  });

  expect(error).toBeNull();
  expect(data).toHaveLength(3);
});
```

Use existing integration helper patterns to define `aliceC` and `createTripWithDays`.

- [ ] **Step 2: Add RPC to migration**

Append `create_lodging_schedule_items_for_range` to `0021_schedule_manual_place_and_bulk.sql`.

Signature:

```sql
create or replace function public.create_lodging_schedule_items_for_range(
  p_trip_id uuid,
  p_start_day_id uuid,
  p_end_day_id uuid,
  p_title text,
  p_time_of_day time without time zone default null,
  p_place_name text default null,
  p_place_address text default null,
  p_place_lat double precision default null,
  p_place_lng double precision default null,
  p_place_provider text default null,
  p_place_external_id text default null,
  p_memo text default null,
  p_url text default null,
  p_place_external_url text default null
) returns uuid[]
```

Required behavior:

- Validate both day ids are in `p_trip_id`.
- Select all `trip_days` between start/end `day_number`.
- Insert one item per day with `category_code = 'lodging'`.
- Append each item at `max(sort_order) + 1` for its day.
- Return inserted ids ordered by day number.

- [ ] **Step 3: Add hook**

Create `lib/schedule/use-create-lodging-schedule-items-for-range.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import type { CreateScheduleItemInput } from "./use-create-schedule-item";

export type CreateLodgingRangeInput = Omit<CreateScheduleItemInput, "tripDayId" | "categoryCode"> & {
  startDayId: string;
  endDayId: string;
};

export function useCreateLodgingScheduleItemsForRange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateLodgingRangeInput): Promise<string[]> => {
      const supabase = getBrowserClient();
      const { data, error } = await (supabase as any).rpc("create_lodging_schedule_items_for_range", {
        p_trip_id: input.tripId,
        p_start_day_id: input.startDayId,
        p_end_day_id: input.endDayId,
        p_title: input.title,
        p_time_of_day: input.timeOfDay,
        p_place_name: input.placeName ?? null,
        p_place_address: input.placeAddress ?? null,
        p_place_lat: input.placeLat ?? null,
        p_place_lng: input.placeLng ?? null,
        p_place_provider: input.placeProvider ?? null,
        p_place_external_id: input.placeExternalId ?? null,
        p_memo: input.memo ?? null,
        p_url: input.url ?? null,
        p_place_external_url: input.placeExternalUrl ?? null,
      });
      if (error) throw error;
      return data as string[];
    },
    onSuccess: (_ids, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.schedule.byTripId(vars.tripId) });
    },
  });
}
```

- [ ] **Step 4: Run integration and commit**

Run:

```bash
npm run test:integration -- tests/integration/schedule-bulk-rpc.test.ts
```

Expected: PASS for lodging range.

Commit:

```bash
git add -- supabase/migrations/0021_schedule_manual_place_and_bulk.sql lib/schedule/use-create-lodging-schedule-items-for-range.ts tests/integration/schedule-bulk-rpc.test.ts
git commit -m "feat(schedule): add lodging range creation rpc"
```

---

## Task 9: Lodging Range UI

**Files:**
- Modify: `components/schedule/schedule-item-modal.tsx`
- Modify: `components/trip/schedule-tab.tsx`
- Test: `tests/e2e/lodging-range-and-bulk-move.spec.ts`

- [ ] **Step 1: Add modal form fields**

Extend `ScheduleItemFormValue`:

```ts
lodgingRange?: { startDayId: string; endDayId: string } | null;
```

Add props to modal:

```ts
days?: Array<{ id: string; day_number: number; date: string }>;
activeDayId?: string | null;
```

Show range controls only when:

```ts
mode === "create" && categoryCode === "lodging" && stage !== "category_select"
```

Use two native selects labeled `숙소 시작일`, `숙소 종료일`.

- [ ] **Step 2: Wire mutation**

In `ScheduleTab`, import and initialize:

```ts
const createLodgingRange = useCreateLodgingScheduleItemsForRange();
```

When `value.categoryCode === "lodging"` and `value.lodgingRange` covers more than one day, call `createLodgingRange.mutate`.

- [ ] **Step 3: Add E2E lodging range case**

In `tests/e2e/lodging-range-and-bulk-move.spec.ts`:

- create a 3-day trip,
- add lodging,
- set start Day 1 and end Day 3,
- save,
- assert the lodging title appears once on each day.

- [ ] **Step 4: Run E2E and commit**

Run:

```bash
npm run test:e2e -- tests/e2e/lodging-range-and-bulk-move.spec.ts
```

Expected: lodging case passes.

Commit:

```bash
git add -- components/schedule/schedule-item-modal.tsx components/trip/schedule-tab.tsx tests/e2e/lodging-range-and-bulk-move.spec.ts
git commit -m "feat(schedule): create lodging across a date range"
```

---

## Task 10: Bulk Schedule Day Move

**Files:**
- Modify: `supabase/migrations/0021_schedule_manual_place_and_bulk.sql`
- Create: `lib/schedule/use-move-schedule-items-to-day.ts`
- Modify: `components/schedule/sortable-schedule-item.tsx`
- Modify: `components/schedule/schedule-list.tsx`
- Modify: `components/trip/schedule-tab.tsx`
- Test: `tests/integration/schedule-bulk-rpc.test.ts`
- Test: `tests/e2e/lodging-range-and-bulk-move.spec.ts`

- [ ] **Step 1: Add failing bulk move integration tests**

Add to `tests/integration/schedule-bulk-rpc.test.ts`:

```ts
it("moves selected items to target day atomically", async () => {
  const { tripId, dayIds, itemIds } = await createTripDaysAndItems();
  const { error } = await (aliceC as any).rpc("move_schedule_items_to_day", {
    p_item_ids: [itemIds[0], itemIds[1]],
    p_target_day_id: dayIds[1],
  });
  expect(error).toBeNull();

  const { data } = await aliceC
    .from("schedule_items")
    .select("id, trip_day_id, sort_order")
    .in("id", [itemIds[0], itemIds[1]])
    .order("sort_order");

  expect(data?.map((r) => r.trip_day_id)).toEqual([dayIds[1], dayIds[1]]);
});

it("rejects mixed-trip bulk moves", async () => {
  const a = await createTripDaysAndItems();
  const b = await createTripDaysAndItems();
  const { error } = await (aliceC as any).rpc("move_schedule_items_to_day", {
    p_item_ids: [a.itemIds[0], b.itemIds[0]],
    p_target_day_id: a.dayIds[1],
  });
  expect(error?.message).toMatch(/mixed_trip_items|target_day_mismatch/);
});
```

- [ ] **Step 2: Add bulk move RPC**

Append to migration:

```sql
create or replace function public.move_schedule_items_to_day(
  p_item_ids uuid[],
  p_target_day_id uuid
) returns void
```

Required behavior:

- Reject null or empty item arrays with `empty_item_ids`.
- Determine source trip from selected items.
- Reject if any item belongs to another trip.
- Reject if target day belongs to another trip.
- Require `can_access_trip(v_trip_id)`.
- Move selected items to target day, appending them after the current max sort order in the order supplied by `p_item_ids`.
- Recompact source days and target day sort_order to 1-based contiguous values.

- [ ] **Step 3: Add hook**

Create `lib/schedule/use-move-schedule-items-to-day.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export type MoveScheduleItemsToDayInput = {
  tripId: string;
  itemIds: string[];
  targetDayId: string;
};

export function useMoveScheduleItemsToDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MoveScheduleItemsToDayInput): Promise<void> => {
      const supabase = getBrowserClient();
      const { error } = await (supabase as any).rpc("move_schedule_items_to_day", {
        p_item_ids: input.itemIds,
        p_target_day_id: input.targetDayId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.schedule.byTripId(vars.tripId) });
    },
  });
}
```

- [ ] **Step 4: Add selection UI**

In `ScheduleTab`, add:

```ts
const [selectionMode, setSelectionMode] = useState(false);
const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
```

Show a small toolbar above the list when items exist:

- `선택` button toggles selection mode.
- `이동` button opens `DayMoveSheet` for selected items.
- `취소` clears selection mode.

Pass `selectionMode`, `selected`, and `onToggleSelect` to list rows. Use checkboxes in `SortableScheduleItem`; keep drag disabled for selected rows.

- [ ] **Step 5: Add E2E bulk move case**

In `tests/e2e/lodging-range-and-bulk-move.spec.ts`, add:

- create three schedule items on Day 1,
- enter selection mode,
- select first two,
- move to Day 2,
- assert Day 2 contains the two selected titles.

- [ ] **Step 6: Run tests and commit**

Run:

```bash
npm run test:integration -- tests/integration/schedule-bulk-rpc.test.ts
npm run test:e2e -- tests/e2e/lodging-range-and-bulk-move.spec.ts
```

Expected: PASS.

Commit:

```bash
git add -- supabase/migrations/0021_schedule_manual_place_and_bulk.sql lib/schedule/use-move-schedule-items-to-day.ts components/schedule/sortable-schedule-item.tsx components/schedule/schedule-list.tsx components/trip/schedule-tab.tsx tests/integration/schedule-bulk-rpc.test.ts tests/e2e/lodging-range-and-bulk-move.spec.ts
git commit -m "feat(schedule): move selected items between days"
```

---

## Task 11: Full Verification And Docs

**Files:**
- Modify: `docs/specs/2026-05-05-v1-1-usability-fixes.md`
- Modify: wiki files at `/Users/sohyun/Library/CloudStorage/SynologyDrive-home/앱/MY_AI_WIKI/projects/travel-manager/`

- [ ] **Step 1: Run full local verification**

Run:

```bash
npm test
npm run lint
npm run build
npm run test:integration -- tests/integration/schedule-manual-place.test.ts tests/integration/schedule-bulk-rpc.test.ts tests/integration/schedule-rpc-with-place-external-url.test.ts tests/integration/expenses-schedule-link.test.ts
npm run test:e2e -- tests/e2e/manual-place-edit.spec.ts tests/e2e/expenses-from-schedule.spec.ts tests/e2e/guest-share-readability.spec.ts tests/e2e/lodging-range-and-bulk-move.spec.ts
```

Expected:

- Unit tests pass.
- Lint has 0 errors.
- Build succeeds.
- Targeted integration tests pass.
- Targeted E2E tests pass.

- [ ] **Step 2: Update spec status**

In `docs/specs/2026-05-05-v1-1-usability-fixes.md`, change:

```yaml
status: implemented
```

Add a short `## 10. Implementation Notes` section with:

- migration number,
- final verification commands,
- known manual verification if any.

- [ ] **Step 3: Update wiki**

At `/wiki-end`, update:

- `projects/travel-manager/status.md`
- `projects/travel-manager/handoff.md`
- new session log `projects/travel-manager/sessions/2026-05-05-v1-1-usability-fixes.md`

Mention:

- branch `codex/v1.1-usability-fixes`,
- target release `v1.1.0`,
- completed requirements 1-10,
- any remaining Maps prod whitelist note if still unresolved.

- [ ] **Step 4: Commit final docs**

Commit:

```bash
git add -- docs/specs/2026-05-05-v1-1-usability-fixes.md
git commit -m "docs: mark v1.1 usability fixes implemented"
```

Do not commit wiki files from outside the repo.

---

## Self-Review Checklist

- Requirement 1: Task 1, Task 2, Task 3.
- Requirement 2: Task 8, Task 9.
- Requirement 3: Task 10.
- Requirement 4: Task 1, Task 5.
- Requirement 5: Task 4.
- Requirement 6: Task 2, Task 3.
- Requirement 7: Task 6.
- Requirement 8: Task 4, Task 6.
- Requirement 9: Task 6.
- Requirement 10: Task 7.

No planned task should modify unrelated auth, profile, invite, or PWA behavior.
