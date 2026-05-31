# Trip Map Usability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved schedule/map usability improvements: larger fixed maps, compact date controls, long-press multi-select with move/delete, desktop AM-first time picking, better login persistence, and removal of design-system entry points.

**Architecture:** Keep the existing ScheduleTab ownership model, but split new behavior into focused helpers: a bulk-delete mutation/RPC, a reusable long-press hook, and a responsive time field. Layout changes stay in the schedule tab and map/day components; auth changes stay in the Supabase browser client and login/sign-in modules.

**Tech Stack:** Next.js 16 App Router, React 19 Client Components, Supabase Postgres/RPC/RLS, TanStack Query, Tailwind CSS v4, Vitest, Playwright.

---

## Source Documents

- Spec: `docs/superpowers/specs/2026-05-30-trip-map-usability-design.md`
- Next.js 16 local docs read for this plan:
  - `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`
  - `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md`
  - `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md`
  - `node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md`

## File Structure

### Create

- `docs/superpowers/plans/2026-05-30-trip-map-usability.md`: this implementation plan.
- `supabase/migrations/0022_schedule_bulk_delete.sql`: atomic bulk delete RPC and grants.
- `lib/schedule/use-delete-schedule-items.ts`: TanStack mutation for selected schedule deletion.
- `lib/schedule/time-of-day.ts`: pure `HH:mm` <-> Korean AM/PM helpers.
- `components/schedule/schedule-time-field.tsx`: responsive native/custom schedule time input.
- `lib/hooks/use-long-press.ts`: reusable pointer long-press hook.
- `tests/unit/time-of-day.test.ts`: conversion coverage.
- `tests/unit/schedule-time-field.test.tsx`: desktop custom picker and native mode coverage.
- `tests/unit/use-long-press.test.tsx`: long-press timing/cancel coverage.
- `tests/e2e/schedule-layout-and-selection.spec.ts`: desktop/mobile map layout and card long-press selection/delete coverage.

### Modify

- `tests/integration/schedule-v1-1-rpc.test.ts`: add bulk-delete RPC tests.
- `components/schedule/schedule-item-modal.tsx`: use `ScheduleTimeField`.
- `components/schedule/sortable-schedule-item.tsx`: separate card long-press selection from drag handle.
- `components/schedule/schedule-list.tsx`: pass `onLongPressItem`.
- `components/schedule/day-tab-bar.tsx`: compact tab styling and className override.
- `components/schedule/map-panel.tsx`: accept parent sizing classes and show stable empty-map area.
- `components/trip/schedule-tab.tsx`: responsive layout, selection actions, bulk delete, mobile map toggle behavior.
- `lib/supabase/browser-client.ts`: explicit session persistence options.
- `lib/auth/sign-in.ts`: remove forced account chooser from redirect login.
- `app/login/page.tsx`: redirect away when already signed in.
- `app/page.tsx`: remove first-screen design-system CTA.
- `app/settings/page.tsx`: remove design palette footer link.
- `playwright.config.ts`: include the new E2E spec in the `alice` project.
- `tests/e2e/lodging-range-and-bulk-move.spec.ts`: replace the old top `선택` button flow with long-press selection so the existing bulk-move regression stays green.
- `tests/e2e/login.spec.ts`: add existing-session `/login` redirect coverage.

## Second Review Corrections

These corrections were added after a second pass against the current codebase and existing tests:

- The existing `tests/e2e/lodging-range-and-bulk-move.spec.ts` still clicks the removed `선택` button. Update it in the same selection task that removes the button.
- The long-press-only entry needs a keyboard/screen-reader fallback. Add a visually hidden per-card button that enters selection mode for that card.
- The bulk-delete RPC should reject duplicate ids, matching the existing bulk-move RPC contract, and should test empty, duplicate, missing, and mixed-trip inputs atomically.
- The time picker needs browser-level coverage, not only unit tests: desktop must render the custom AM-first picker, while mobile/touch must not render the custom picker.
- The authenticated `/login` redirect check should validate with `getUser()` rather than trusting a stale local `getSession()` result.
- The service worker Supabase `NetworkOnly` policy already exists; include its unit test in final auth verification so login persistence is not accidentally blamed on cached auth responses.

---

## Task 1: Bulk Delete RPC Contract

**Files:**
- Create: `supabase/migrations/0022_schedule_bulk_delete.sql`
- Modify: `tests/integration/schedule-v1-1-rpc.test.ts`

- [ ] **Step 1: Add failing bulk-delete integration tests**

At the top of `tests/integration/schedule-v1-1-rpc.test.ts`, add the `randomUUID` import:

```ts
import { randomUUID } from "crypto";
```

Inside `describe("schedule v1.1 RPCs", () => { ... })`, append:

```ts
  it("deletes selected schedule items and recompacts each affected day", async () => {
    const trip = await createTestTrip("bulk-delete", 2);
    const a = await createItem(trip.days[0].id, "A");
    const b = await createItem(trip.days[0].id, "B");
    const c = await createItem(trip.days[0].id, "C");
    const x = await createItem(trip.days[1].id, "X");
    const y = await createItem(trip.days[1].id, "Y");

    const { error } = await rpc<undefined>("delete_schedule_items", {
      p_item_ids: [b, x],
    });
    expect(error).toBeNull();

    const { data: day1Rows, error: day1Error } = await userC
      .from("schedule_items")
      .select("id, title, sort_order")
      .eq("trip_day_id", trip.days[0].id)
      .order("sort_order");
    expect(day1Error).toBeNull();
    expect(day1Rows).toEqual([
      { id: a, title: "A", sort_order: 1 },
      { id: c, title: "C", sort_order: 2 },
    ]);

    const { data: day2Rows, error: day2Error } = await userC
      .from("schedule_items")
      .select("id, title, sort_order")
      .eq("trip_day_id", trip.days[1].id)
      .order("sort_order");
    expect(day2Error).toBeNull();
    expect(day2Rows).toEqual([{ id: y, title: "Y", sort_order: 1 }]);
  });

  it("rejects bulk deletes when any selected id is missing and keeps rows unchanged", async () => {
    const trip = await createTestTrip("bulk-delete-missing", 1);
    const a = await createItem(trip.days[0].id, "A");
    const b = await createItem(trip.days[0].id, "B");

    const { error } = await rpc<undefined>("delete_schedule_items", {
      p_item_ids: [a, randomUUID()],
    });
    expect(error?.message).toMatch(/missing_schedule_items/);

    const { data: rows, error: rowsError } = await userC
      .from("schedule_items")
      .select("id, title, sort_order")
      .eq("trip_day_id", trip.days[0].id)
      .order("sort_order");
    expect(rowsError).toBeNull();
    expect(rows).toEqual([
      { id: a, title: "A", sort_order: 1 },
      { id: b, title: "B", sort_order: 2 },
    ]);
  });

  it("rejects duplicate selected ids and keeps rows unchanged", async () => {
    const trip = await createTestTrip("bulk-delete-duplicates", 1);
    const a = await createItem(trip.days[0].id, "A");
    const b = await createItem(trip.days[0].id, "B");

    const { error } = await rpc<undefined>("delete_schedule_items", {
      p_item_ids: [a, a],
    });
    expect(error?.message).toMatch(/duplicate_item_ids/);

    const { data: rows, error: rowsError } = await userC
      .from("schedule_items")
      .select("id, title, sort_order")
      .eq("trip_day_id", trip.days[0].id)
      .order("sort_order");
    expect(rowsError).toBeNull();
    expect(rows).toEqual([
      { id: a, title: "A", sort_order: 1 },
      { id: b, title: "B", sort_order: 2 },
    ]);
  });

  it("rejects empty bulk delete input", async () => {
    const { error } = await rpc<undefined>("delete_schedule_items", {
      p_item_ids: [],
    });
    expect(error?.message).toMatch(/empty_item_ids/);
  });

  it("rejects bulk deletes with items from multiple trips", async () => {
    const aTrip = await createTestTrip("bulk-delete-trip-a", 1);
    const bTrip = await createTestTrip("bulk-delete-trip-b", 1);
    const a = await createItem(aTrip.days[0].id, "A");
    const b = await createItem(bTrip.days[0].id, "B");

    const { error } = await rpc<undefined>("delete_schedule_items", {
      p_item_ids: [a, b],
    });
    expect(error?.message).toMatch(/mixed_trip_items/);
  });
```

- [ ] **Step 2: Run the new tests and verify the RPC is missing**

Run:

```bash
npm run test:integration -- tests/integration/schedule-v1-1-rpc.test.ts
```

Expected: FAIL with a Supabase/PostgREST error that `delete_schedule_items` cannot be found.

- [ ] **Step 3: Add the bulk-delete migration**

Create `supabase/migrations/0022_schedule_bulk_delete.sql`:

```sql
-- Atomic bulk deletion for selected schedule items.
-- Keeps every affected trip_day sort_order 1-based and gap-free.

create or replace function public.delete_schedule_items(p_item_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_input_count int;
  v_expected_count int;
  v_matched_count int;
  v_trip_count int;
  v_trip_id uuid;
  v_affected_days uuid[];
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  v_input_count := coalesce(array_length(p_item_ids, 1), 0);
  if v_input_count = 0 then
    raise exception 'empty_item_ids';
  end if;

  select count(*)
    into v_expected_count
  from (select distinct unnest(p_item_ids) as id) input_ids;

  if v_expected_count <> v_input_count then
    raise exception 'duplicate_item_ids';
  end if;

  perform 1
  from public.schedule_items si
  where si.id in (select distinct unnest(p_item_ids))
  for update;

  select
    count(*),
    count(distinct td.trip_id),
    min(td.trip_id),
    array_agg(distinct si.trip_day_id)
    into v_matched_count, v_trip_count, v_trip_id, v_affected_days
  from public.schedule_items si
  join public.trip_days td on td.id = si.trip_day_id
  where si.id in (select distinct unnest(p_item_ids));

  if v_matched_count <> v_expected_count then
    raise exception 'missing_schedule_items';
  end if;

  if v_trip_count <> 1 or v_trip_id is null then
    raise exception 'mixed_trip_items';
  end if;

  if not public.can_access_trip(v_trip_id) then
    raise exception 'forbidden';
  end if;

  delete from public.schedule_items si
  where si.id in (select distinct unnest(p_item_ids));

  with affected(day_id) as (
    select unnest(v_affected_days)
  ),
  ranked as (
    select
      si.id,
      row_number() over (
        partition by si.trip_day_id
        order by si.sort_order, si.created_at, si.id
      )::int as rn
    from public.schedule_items si
    join affected a on a.day_id = si.trip_day_id
  )
  update public.schedule_items si
     set sort_order = ranked.rn,
         updated_at = now()
    from ranked
   where si.id = ranked.id;
end;
$$;

revoke all on function public.delete_schedule_items(uuid[]) from public;
grant execute on function public.delete_schedule_items(uuid[]) to authenticated;
```

- [ ] **Step 4: Apply the migration locally**

Run:

```bash
npx supabase db reset
```

Expected: local Supabase database resets successfully and applies migration `0022_schedule_bulk_delete.sql`.

- [ ] **Step 5: Run integration tests again**

Run:

```bash
npm run test:integration -- tests/integration/schedule-v1-1-rpc.test.ts
```

Expected: PASS for all tests in `schedule-v1-1-rpc.test.ts`.

- [ ] **Step 6: Commit Task 1**

Run:

```bash
git add -- supabase/migrations/0022_schedule_bulk_delete.sql tests/integration/schedule-v1-1-rpc.test.ts
git commit -m "feat(schedule): add bulk delete rpc"
```

---

## Task 2: Bulk Delete Client Mutation

**Files:**
- Create: `lib/schedule/use-delete-schedule-items.ts`
- Modify: `components/trip/schedule-tab.tsx`

- [ ] **Step 1: Create the mutation hook**

Create `lib/schedule/use-delete-schedule-items.ts`:

```ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";

export type DeleteScheduleItemsInput = {
  tripId: string;
  itemIds: string[];
};

export function useDeleteScheduleItems() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: DeleteScheduleItemsInput): Promise<void> => {
      if (input.itemIds.length === 0) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("delete_schedule_items", {
        p_item_ids: input.itemIds,
      });
      if (error) throw error;
    },
    onSuccess: (_value, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.schedule.byTripId(vars.tripId) });
    },
  });
}
```

- [ ] **Step 2: Import the mutation in `ScheduleTab`**

In `components/trip/schedule-tab.tsx`, add:

```ts
import { useDeleteScheduleItems } from "@/lib/schedule/use-delete-schedule-items";
```

Near existing mutations, add:

```ts
  const deleteMany = useDeleteScheduleItems();
```

- [ ] **Step 3: Add the bulk delete handler**

In `components/trip/schedule-tab.tsx`, add this function near `handleBulkMovePick`:

```ts
  function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    const itemIds = activeDayItems
      .filter((item) => selectedIds.has(item.id))
      .map((item) => item.id);
    if (itemIds.length === 0) return;
    const ok = window.confirm(`${itemIds.length}개 일정을 삭제할까요?`);
    if (!ok) return;

    deleteMany.mutate(
      { tripId, itemIds },
      {
        onSuccess: () => {
          showToast(`${itemIds.length}개 일정을 삭제했어요`, "success");
          setSelectionMode(false);
          setSelectedIds(new Set());
        },
        onError: (e) => {
          showToast(`삭제 실패: ${e instanceof Error ? e.message : ""}`, "error");
        },
      },
    );
  }
```

- [ ] **Step 4: Commit Task 2**

Run:

```bash
npm run lint -- components/trip/schedule-tab.tsx lib/schedule/use-delete-schedule-items.ts
git add -- components/trip/schedule-tab.tsx lib/schedule/use-delete-schedule-items.ts
git commit -m "feat(schedule): wire bulk delete mutation"
```

Expected: lint completes with no new errors. Existing repository warnings can remain if unrelated.

---

## Task 3: Time Conversion Utilities

**Files:**
- Create: `lib/schedule/time-of-day.ts`
- Create: `tests/unit/time-of-day.test.ts`

- [ ] **Step 1: Write failing conversion tests**

Create `tests/unit/time-of-day.test.ts`:

```ts
import {
  buildTimeOfDay,
  parseTimeOfDay,
  type TimePeriod,
} from "@/lib/schedule/time-of-day";

describe("schedule time of day helpers", () => {
  it.each([
    ["00:00", { period: "AM", hour12: "12", minute: "00" }],
    ["05:16", { period: "AM", hour12: "05", minute: "16" }],
    ["12:00", { period: "PM", hour12: "12", minute: "00" }],
    ["17:16", { period: "PM", hour12: "05", minute: "16" }],
    ["23:59", { period: "PM", hour12: "11", minute: "59" }],
  ] as const)("parses %s", (value, expected) => {
    expect(parseTimeOfDay(value)).toEqual(expected);
  });

  it.each([
    ["AM", "12", "00", "00:00"],
    ["AM", "05", "16", "05:16"],
    ["PM", "12", "00", "12:00"],
    ["PM", "05", "16", "17:16"],
    ["PM", "11", "59", "23:59"],
  ] as const)(
    "builds %s %s:%s",
    (period: TimePeriod, hour12, minute, expected) => {
      expect(buildTimeOfDay(period, hour12, minute)).toBe(expected);
    },
  );

  it("returns null for malformed input", () => {
    expect(parseTimeOfDay("24:00")).toBeNull();
    expect(parseTimeOfDay("10:60")).toBeNull();
    expect(parseTimeOfDay("nope")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests and verify missing module failure**

Run:

```bash
npm test -- tests/unit/time-of-day.test.ts
```

Expected: FAIL because `lib/schedule/time-of-day.ts` does not exist.

- [ ] **Step 3: Implement conversion helpers**

Create `lib/schedule/time-of-day.ts`:

```ts
export type TimePeriod = "AM" | "PM";

export type ParsedTimeOfDay = {
  period: TimePeriod;
  hour12: string;
  minute: string;
};

export const HOUR_12_OPTIONS = ["12", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11"];

export const MINUTE_OPTIONS = Array.from({ length: 60 }, (_v, i) =>
  String(i).padStart(2, "0"),
);

export function parseTimeOfDay(value: string | null | undefined): ParsedTimeOfDay | null {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour24 = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour24) || !Number.isInteger(minute)) return null;
  if (hour24 < 0 || hour24 > 23 || minute < 0 || minute > 59) return null;

  const period: TimePeriod = hour24 < 12 ? "AM" : "PM";
  const rawHour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return {
    period,
    hour12: String(rawHour12).padStart(2, "0"),
    minute: String(minute).padStart(2, "0"),
  };
}

export function buildTimeOfDay(period: TimePeriod, hour12: string, minute: string): string {
  const hour = Number(hour12);
  const min = Number(minute);
  if (!HOUR_12_OPTIONS.includes(hour12) || !MINUTE_OPTIONS.includes(minute)) {
    throw new Error("invalid_time_of_day");
  }
  const hour24 =
    period === "AM"
      ? hour === 12
        ? 0
        : hour
      : hour === 12
        ? 12
        : hour + 12;
  return `${String(hour24).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
```

- [ ] **Step 4: Run tests and commit**

Run:

```bash
npm test -- tests/unit/time-of-day.test.ts
git add -- lib/schedule/time-of-day.ts tests/unit/time-of-day.test.ts
git commit -m "test(schedule): cover time of day conversion"
```

Expected: PASS.

---

## Task 4: Responsive Schedule Time Field

**Files:**
- Create: `components/schedule/schedule-time-field.tsx`
- Create: `tests/unit/schedule-time-field.test.tsx`
- Modify: `components/schedule/schedule-item-modal.tsx`

- [ ] **Step 1: Write failing component tests**

Create `tests/unit/schedule-time-field.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScheduleTimeField } from "@/components/schedule/schedule-time-field";

describe("ScheduleTimeField", () => {
  it("renders desktop AM before PM and emits 24-hour values", () => {
    const onChange = vi.fn();
    render(<ScheduleTimeField value="" onChange={onChange} mode="custom" />);

    const am = screen.getByRole("button", { name: "오전" });
    const pm = screen.getByRole("button", { name: "오후" });
    const buttons = screen.getAllByRole("button").map((button) => button.textContent);
    expect(buttons.indexOf("오전")).toBeLessThan(buttons.indexOf("오후"));

    fireEvent.click(pm);
    fireEvent.change(screen.getByLabelText("시"), { target: { value: "05" } });
    fireEvent.change(screen.getByLabelText("분"), { target: { value: "16" } });

    expect(onChange).toHaveBeenLastCalledWith("17:16");
    expect(am).toHaveAttribute("aria-pressed", "false");
    expect(pm).toHaveAttribute("aria-pressed", "true");
  });

  it("renders native time input in native mode", () => {
    const onChange = vi.fn();
    render(<ScheduleTimeField value="05:18" onChange={onChange} mode="native" />);

    const input = screen.getByLabelText("시간");
    expect(input).toHaveAttribute("type", "time");
    fireEvent.change(input, { target: { value: "06:30" } });
    expect(onChange).toHaveBeenCalledWith("06:30");
  });
});
```

- [ ] **Step 2: Run tests and verify missing component failure**

Run:

```bash
npm test -- tests/unit/schedule-time-field.test.tsx
```

Expected: FAIL because `components/schedule/schedule-time-field.tsx` does not exist.

- [ ] **Step 3: Implement `ScheduleTimeField`**

Create `components/schedule/schedule-time-field.tsx`:

```tsx
"use client";

import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/cn";
import {
  buildTimeOfDay,
  HOUR_12_OPTIONS,
  MINUTE_OPTIONS,
  parseTimeOfDay,
  type TimePeriod,
} from "@/lib/schedule/time-of-day";

type ScheduleTimeFieldMode = "auto" | "native" | "custom";

type Props = {
  value: string;
  onChange: (value: string) => void;
  mode?: ScheduleTimeFieldMode;
};

export function ScheduleTimeField({ value, onChange, mode = "auto" }: Props) {
  const id = useId();
  const useNative = useNativeTimeInput(mode);

  if (useNative) {
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-ink-700 text-[13px] font-medium">
          시간
        </label>
        <input
          id={id}
          type="time"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="border-border-primary bg-surface-100 text-ink-900 focus:border-border-medium h-11 rounded-[8px] border px-3 text-[15px] transition-colors duration-150 focus:shadow-[0_4px_12px_rgba(0,0,0,0.1)] focus:outline-none"
        />
      </div>
    );
  }

  return <DesktopTimePicker value={value} onChange={onChange} id={id} />;
}

function useNativeTimeInput(mode: ScheduleTimeFieldMode): boolean {
  const [native, setNative] = useState(mode !== "custom");

  useEffect(() => {
    if (mode === "native") {
      setNative(true);
      return;
    }
    if (mode === "custom") {
      setNative(false);
      return;
    }
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const hoverNone = window.matchMedia("(hover: none)").matches;
    setNative(coarse || hoverNone);
  }, [mode]);

  return native;
}

function DesktopTimePicker({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  id: string;
}) {
  const parsed = parseTimeOfDay(value) ?? { period: "AM" as TimePeriod, hour12: "09", minute: "00" };
  const hourId = `${id}-hour`;
  const minuteId = `${id}-minute`;

  function apply(next: Partial<typeof parsed>) {
    const merged = { ...parsed, ...next };
    onChange(buildTimeOfDay(merged.period, merged.hour12, merged.minute));
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-ink-700 text-[13px] font-medium">시간</legend>
      <div className="inline-flex w-fit rounded-[8px] border border-border-primary bg-surface-100 p-1">
        {(["AM", "PM"] as const).map((period) => (
          <button
            key={period}
            type="button"
            aria-pressed={parsed.period === period}
            onClick={() => apply({ period })}
            className={cn(
              "h-9 rounded-[6px] px-4 text-[14px] font-medium transition-colors",
              parsed.period === period
                ? "bg-accent-orange text-cream"
                : "text-ink-700 hover:bg-surface-300",
            )}
          >
            {period === "AM" ? "오전" : "오후"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-[12px] text-ink-600" htmlFor={hourId}>
          시
          <select
            id={hourId}
            value={parsed.hour12}
            onChange={(e) => apply({ hour12: e.target.value })}
            className="border-border-primary bg-surface-100 text-ink-900 h-11 rounded-[8px] border px-3 text-[15px]"
          >
            {HOUR_12_OPTIONS.map((hour) => (
              <option key={hour} value={hour}>
                {hour}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-ink-600" htmlFor={minuteId}>
          분
          <select
            id={minuteId}
            value={parsed.minute}
            onChange={(e) => apply({ minute: e.target.value })}
            className="border-border-primary bg-surface-100 text-ink-900 h-11 rounded-[8px] border px-3 text-[15px]"
          >
            {MINUTE_OPTIONS.map((minute) => (
              <option key={minute} value={minute}>
                {minute}
              </option>
            ))}
          </select>
        </label>
      </div>
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="text-ink-500 w-fit text-[12px] underline underline-offset-2"
        >
          시간 지우기
        </button>
      )}
    </fieldset>
  );
}
```

- [ ] **Step 4: Use `ScheduleTimeField` in the modal**

In `components/schedule/schedule-item-modal.tsx`, add:

```ts
import { ScheduleTimeField } from "@/components/schedule/schedule-time-field";
```

In `CommonFields`, replace the `<TextField label="시간" type="time" ... />` block with:

```tsx
      <ScheduleTimeField value={timeOfDay} onChange={onTime} />
```

Keep the `TextArea` and URL `TextField` unchanged.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm test -- tests/unit/time-of-day.test.ts tests/unit/schedule-time-field.test.tsx
npm run lint -- components/schedule/schedule-item-modal.tsx components/schedule/schedule-time-field.tsx lib/schedule/time-of-day.ts
git add -- components/schedule/schedule-item-modal.tsx components/schedule/schedule-time-field.tsx lib/schedule/time-of-day.ts tests/unit/time-of-day.test.ts tests/unit/schedule-time-field.test.tsx
git commit -m "feat(schedule): add responsive time picker"
```

Expected: tests pass; lint has no new errors.

---

## Task 5: Long-Press Selection Helper

**Files:**
- Create: `lib/hooks/use-long-press.ts`
- Create: `tests/unit/use-long-press.test.tsx`

- [ ] **Step 1: Write failing hook tests**

Create `tests/unit/use-long-press.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLongPress } from "@/lib/hooks/use-long-press";

function TestButton({ onLongPress }: { onLongPress: () => void }) {
  const handlers = useLongPress<HTMLButtonElement>({ onLongPress, delay: 400 });
  return (
    <button type="button" {...handlers}>
      target
    </button>
  );
}

describe("useLongPress", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires after the configured delay", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    render(<TestButton onLongPress={onLongPress} />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "target" }), {
      clientX: 10,
      clientY: 10,
      button: 0,
    });
    vi.advanceTimersByTime(399);
    expect(onLongPress).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("cancels when released early", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    render(<TestButton onLongPress={onLongPress} />);

    const button = screen.getByRole("button", { name: "target" });
    fireEvent.pointerDown(button, { clientX: 10, clientY: 10, button: 0 });
    fireEvent.pointerUp(button);
    vi.advanceTimersByTime(450);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("cancels when movement exceeds tolerance", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    render(<TestButton onLongPress={onLongPress} />);

    const button = screen.getByRole("button", { name: "target" });
    fireEvent.pointerDown(button, { clientX: 10, clientY: 10, button: 0 });
    fireEvent.pointerMove(button, { clientX: 30, clientY: 10 });
    vi.advanceTimersByTime(450);
    expect(onLongPress).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests and verify missing hook failure**

Run:

```bash
npm test -- tests/unit/use-long-press.test.tsx
```

Expected: FAIL because `lib/hooks/use-long-press.ts` does not exist.

- [ ] **Step 3: Implement the hook**

Create `lib/hooks/use-long-press.ts`:

```ts
"use client";

import { useCallback, useRef } from "react";

type UseLongPressOptions = {
  onLongPress: () => void;
  delay?: number;
  moveTolerance?: number;
  disabled?: boolean;
};

type Point = { x: number; y: number };

export function useLongPress<T extends HTMLElement>({
  onLongPress,
  delay = 450,
  moveTolerance = 8,
  disabled = false,
}: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<Point | null>(null);
  const didLongPressRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<T>) => {
      if (disabled || event.button !== 0) return;
      didLongPressRef.current = false;
      startRef.current = { x: event.clientX, y: event.clientY };
      timerRef.current = setTimeout(() => {
        didLongPressRef.current = true;
        onLongPress();
      }, delay);
    },
    [delay, disabled, onLongPress],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<T>) => {
      const start = startRef.current;
      if (!start) return;
      const dx = Math.abs(event.clientX - start.x);
      const dy = Math.abs(event.clientY - start.y);
      if (dx > moveTolerance || dy > moveTolerance) clear();
    },
    [clear, moveTolerance],
  );

  const onClickCapture = useCallback((event: React.MouseEvent<T>) => {
    if (!didLongPressRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    didLongPressRef.current = false;
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onContextMenu: clear,
    onClickCapture,
  };
}
```

- [ ] **Step 4: Run tests and commit**

Run:

```bash
npm test -- tests/unit/use-long-press.test.tsx
npm run lint -- lib/hooks/use-long-press.ts
git add -- lib/hooks/use-long-press.ts tests/unit/use-long-press.test.tsx
git commit -m "feat(ui): add long press hook"
```

Expected: tests pass; lint has no new errors.

---

## Task 6: Card Long-Press Selection UI

**Files:**
- Modify: `components/schedule/sortable-schedule-item.tsx`
- Modify: `components/schedule/schedule-list.tsx`
- Modify: `components/trip/schedule-tab.tsx`
- Modify: `tests/unit/sortable-schedule-item-selection.test.ts`
- Modify: `tests/e2e/lodging-range-and-bulk-move.spec.ts`

- [ ] **Step 1: Extend the sortable item test**

In `tests/unit/sortable-schedule-item-selection.test.ts`, add a second test:

```ts
  it("enters selection mode from a card-body long press", () => {
    vi.useFakeTimers();
    const item = makeItem();
    const onLongPress = vi.fn();

    render(
      React.createElement(
        DndContext,
        null,
        React.createElement(
          SortableContext,
          { items: [item.id] } as React.ComponentProps<typeof SortableContext>,
          React.createElement(SortableScheduleItem, {
            item,
            index: 1,
            isDomestic: true,
            onTap: vi.fn(),
            onLongPress,
            selectionMode: false,
          }),
        ),
      ),
    );

    const card = screen.getByTestId("schedule-card-item-1");
    fireEvent.pointerDown(card, { clientX: 10, clientY: 10, button: 0 });
    vi.advanceTimersByTime(450);

    expect(onLongPress).toHaveBeenCalledWith(item);
    vi.useRealTimers();
  });

  it("offers an accessible button to enter selection mode without a pointer long press", () => {
    const item = makeItem();
    const onLongPress = vi.fn();

    render(
      React.createElement(
        DndContext,
        null,
        React.createElement(
          SortableContext,
          { items: [item.id] } as React.ComponentProps<typeof SortableContext>,
          React.createElement(SortableScheduleItem, {
            item,
            index: 1,
            isDomestic: true,
            onTap: vi.fn(),
            onLongPress,
            selectionMode: false,
          }),
        ),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "남산 전망대 선택 모드 시작" }));

    expect(onLongPress).toHaveBeenCalledWith(item);
  });
```

- [ ] **Step 2: Run the focused test and verify prop is missing**

Run:

```bash
npm test -- tests/unit/sortable-schedule-item-selection.test.ts
```

Expected: FAIL because `SortableScheduleItem` does not accept `onLongPress` or render the `data-testid`.

- [ ] **Step 3: Update `SortableScheduleItem` props and card handlers**

In `components/schedule/sortable-schedule-item.tsx`, import the hook:

```ts
import { useLongPress } from "@/lib/hooks/use-long-press";
```

Add the prop:

```ts
  onLongPress?: (item: ScheduleItem) => void;
```

Destructure it:

```ts
  onLongPress,
```

Add this before `return`:

```ts
  const cardLongPress = useLongPress<HTMLDivElement>({
    onLongPress: () => onLongPress?.(item),
    disabled: selectionMode || !onLongPress,
  });
```

Remove `onClick` from the `<li>` and move tap behavior to the card wrapper:

```tsx
    <li
      ref={(el) => {
        setNodeRef(el);
        registerRef?.(el);
      }}
      style={style}
      className="flex items-stretch gap-1"
    >
```

Update the card wrapper `<div>`:

```tsx
      <div
        data-testid={`schedule-card-${item.id}`}
        className={cn(
          "min-w-0 flex-1 rounded-[8px] text-left",
          selectionMode && selected && "ring-accent-orange/70 ring-2",
        )}
        onClick={() => (selectionMode ? onToggleSelected?.(item) : onTap(item))}
        {...cardLongPress}
      >
```

Inside that card wrapper, before `<ScheduleItemCard ... />`, add the keyboard/screen-reader fallback:

```tsx
        {!selectionMode && onLongPress && (
          <button
            type="button"
            className="sr-only"
            onClick={(e) => {
              e.stopPropagation();
              onLongPress(item);
            }}
          >
            {item.title} 선택 모드 시작
          </button>
        )}
```

- [ ] **Step 4: Pass the long-press prop through `ScheduleList`**

In `components/schedule/schedule-list.tsx`, add to `Props`:

```ts
  onLongPressItem?: (item: ScheduleItem) => void;
```

Destructure:

```ts
  onLongPressItem,
```

Pass to `SortableScheduleItem`:

```tsx
            onLongPress={onLongPressItem}
```

- [ ] **Step 5: Add `enterSelectionMode` in `ScheduleTab`**

In `components/trip/schedule-tab.tsx`, add:

```ts
  function enterSelectionMode(item: ScheduleItem) {
    setSelectionMode(true);
    setSelectedIds(new Set([item.id]));
  }
```

Remove the existing visible `선택` button block from the compact header.

Pass the handler into `ScheduleList`:

```tsx
            onLongPressItem={enterSelectionMode}
```

- [ ] **Step 6: Add Delete to the selection bar**

Replace the existing selection bar JSX with:

```tsx
      {selectionMode && (
        <div className="border-border-primary bg-surface-100 sticky top-[calc(56px+env(safe-area-inset-top))] z-20 mt-2 flex items-center justify-between rounded-[8px] border px-3 py-2 lg:top-0">
          <span className="text-ink-700 text-[13px] font-medium">{selectedCount}개 선택</span>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="light"
              disabled={selectedCount === 0}
              onClick={() => setBulkMoveOpen(true)}
            >
              이동
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={selectedCount === 0}
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
```

- [ ] **Step 7: Update the existing bulk-move E2E that used the removed top `선택` button**

In `tests/e2e/lodging-range-and-bulk-move.spec.ts`, replace:

```ts
  await page.getByRole("button", { name: "선택" }).click();
  await page.getByRole("checkbox", { name: "Bulk-A 선택" }).click();
  await page.getByRole("checkbox", { name: "Bulk-B 선택" }).click();
```

with:

```ts
  const firstCard = page.getByTestId(/schedule-card-/).filter({ hasText: "Bulk-A" });
  await firstCard.dispatchEvent("pointerdown", { clientX: 20, clientY: 20, button: 0 });
  await page.waitForTimeout(500);
  await firstCard.dispatchEvent("pointerup");
  await expect(page.getByText("1개 선택")).toBeVisible();

  await page.getByText("Bulk-B", { exact: true }).click();
  await expect(page.getByText("2개 선택")).toBeVisible();
```

- [ ] **Step 8: Run tests and commit**

Run:

```bash
npm test -- tests/unit/use-long-press.test.tsx tests/unit/sortable-schedule-item-selection.test.ts
npm run lint -- components/schedule/sortable-schedule-item.tsx components/schedule/schedule-list.tsx components/trip/schedule-tab.tsx
npm run test:e2e -- tests/e2e/lodging-range-and-bulk-move.spec.ts
git add -- components/schedule/sortable-schedule-item.tsx components/schedule/schedule-list.tsx components/trip/schedule-tab.tsx tests/unit/sortable-schedule-item-selection.test.ts tests/e2e/lodging-range-and-bulk-move.spec.ts
git commit -m "feat(schedule): enter selection from long press"
```

Expected: tests pass; lint has no new errors.

---

## Task 7: Responsive Map Layout And Compact Day Tabs

**Files:**
- Modify: `components/schedule/day-tab-bar.tsx`
- Modify: `components/schedule/map-panel.tsx`
- Modify: `components/trip/schedule-tab.tsx`
- Create: `tests/e2e/schedule-layout-and-selection.spec.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Add E2E layout tests**

Create `tests/e2e/schedule-layout-and-selection.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { seedTripWithItems } from "./helpers/db-seed";

test.describe.configure({ mode: "serial" });

test("desktop schedule screen keeps the map visible while the schedule scrolls", async ({ page }) => {
  const { tripId } = await seedTripWithItems({
    title: "E2E Desktop Map Layout",
    startDate: "2026-12-20",
    endDate: "2026-12-20",
    isDomestic: true,
    itemsByDay: {
      1: Array.from({ length: 14 }, (_v, i) => `Layout-${i + 1}`),
    },
  });

  await page.setViewportSize({ width: 1280, height: 820 });
  await page.goto(`/trips/${tripId}`);
  await expect(page.getByText("Layout-1", { exact: true })).toBeVisible({ timeout: 10_000 });

  const map = page.getByLabel("지도").first();
  await expect(map).toBeVisible();
  const before = await map.boundingBox();
  expect(before?.height).toBeGreaterThan(400);

  await page.getByTestId("schedule-scroll-panel").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });

  const after = await map.boundingBox();
  expect(Math.round(after?.top ?? 0)).toBe(Math.round(before?.top ?? 0));
});

test("mobile schedule screen uses a compact day header and larger map area", async ({ page }) => {
  const { tripId } = await seedTripWithItems({
    title: "E2E Mobile Map Layout",
    startDate: "2026-12-21",
    endDate: "2026-12-22",
    isDomestic: true,
    itemsByDay: { 1: ["Mobile-A"] },
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/trips/${tripId}?map=open`);
  await expect(page.getByText("Mobile-A", { exact: true })).toBeVisible({ timeout: 10_000 });

  const map = page.getByLabel("지도").first();
  const dayTab = page.getByRole("tab", { name: /Day 1/ });
  await expect(map).toBeVisible();
  await expect(dayTab).toBeVisible();
  const mapBox = await map.boundingBox();
  const tabBox = await dayTab.boundingBox();
  expect(mapBox?.height).toBeGreaterThan(260);
  expect(tabBox?.height).toBeLessThanOrEqual(44);
  await expect(page.getByText(/번호를 길게 눌러/)).toHaveCount(0);
});
```

In `playwright.config.ts`, add `"schedule-layout-and-selection.spec.ts"` to the `alice` project `testMatch` array.

- [ ] **Step 2: Run E2E and verify current layout fails**

Run:

```bash
npm run test:e2e -- tests/e2e/schedule-layout-and-selection.spec.ts
```

Expected: FAIL because the current map height is 240px, there is no `schedule-scroll-panel`, and the old helper text is still present.

- [ ] **Step 3: Compact `DayTabBar`**

In `components/schedule/day-tab-bar.tsx`, add `className?: string` to props and use it on the root:

```ts
import { cn } from "@/lib/cn";

type Props = {
  days: TripDay[];
  activeDayId: string | null;
  onSelect: (dayId: string) => void;
  className?: string;
};
```

Update the root and button classes:

```tsx
    <div
      className={cn(
        "bg-surface-200/90 sticky top-14 z-20 -mx-4 overflow-x-auto px-4 pt-2 pb-1.5 backdrop-blur-md",
        className,
      )}
      role="tablist"
      aria-label="일자 선택"
    >
      <ul className="flex gap-1.5">
```

```tsx
                className={cn(
                  "flex h-10 min-w-[58px] flex-col items-center justify-center rounded-[8px] px-2.5 transition-colors duration-150",
                  active
                    ? "bg-accent-orange text-cream"
                    : "bg-surface-400 text-ink-700 hover:text-ink-900",
                )}
```

- [ ] **Step 4: Let `MapPanel` accept sizing classes**

In `components/schedule/map-panel.tsx`, import `cn`:

```ts
import { cn } from "@/lib/cn";
```

Add to `Props`:

```ts
  className?: string;
```

Destructure `className` and update the container:

```tsx
      className={cn(
        "border-border-primary bg-surface-200 mt-3 h-[240px] w-full overflow-hidden rounded-[10px] border",
        className,
      )}
```

- [ ] **Step 5: Refactor `ScheduleTab` layout**

In `components/trip/schedule-tab.tsx`, create the reusable map node before `return`:

```tsx
  const mapPanel =
    trip ? (
      <MapPanel
        isDomestic={trip.is_domestic}
        items={mapItems}
        onMarkerClick={handleMarkerClick}
        focusItemId={focusMapItemId}
        className="h-[clamp(280px,34dvh,380px)] lg:mt-0 lg:h-full"
      />
    ) : null;
```

Replace the top-level return wrapper with a responsive shell:

```tsx
    <div className="px-4 pb-28 lg:grid lg:h-[calc(100dvh-56px-80px)] lg:grid-cols-[minmax(0,560px)_minmax(420px,1fr)] lg:gap-4 lg:overflow-hidden lg:pb-4">
      <section
        data-testid="schedule-scroll-panel"
        className="min-w-0 lg:overflow-y-auto lg:pr-1"
      >
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

        {/* Keep the selection bar and DndContext list below this point. */}
      </section>

      <aside className="hidden min-h-0 lg:block">
        <div className="sticky top-16 h-full">{mapPanel}</div>
      </aside>
    </div>
```

Move the existing selection bar, `DndContext`, `Fab`, modals, place sheet, and day move sheets inside the same return so behavior remains unchanged. The `Fab` can remain fixed.

Remove the old helper row that rendered item count and the visible `선택` button.

- [ ] **Step 6: Run layout E2E and commit**

Run:

```bash
npm run test:e2e -- tests/e2e/schedule-layout-and-selection.spec.ts
npm run lint -- components/schedule/day-tab-bar.tsx components/schedule/map-panel.tsx components/trip/schedule-tab.tsx
git add -- components/schedule/day-tab-bar.tsx components/schedule/map-panel.tsx components/trip/schedule-tab.tsx tests/e2e/schedule-layout-and-selection.spec.ts playwright.config.ts
git commit -m "feat(schedule): improve map layout"
```

Expected: E2E spec passes for desktop and mobile layout assertions.

---

## Task 8: Selection Move/Delete E2E

**Files:**
- Modify: `tests/e2e/schedule-layout-and-selection.spec.ts`
- Modify: `components/trip/schedule-tab.tsx`
- Modify: `components/schedule/sortable-schedule-item.tsx`

- [ ] **Step 1: Add E2E selection behavior tests**

First update the import in `tests/e2e/schedule-layout-and-selection.spec.ts`:

```ts
import { test, expect, devices } from "@playwright/test";
```

Then append to `tests/e2e/schedule-layout-and-selection.spec.ts`:

```ts
test("long-pressing a card selects items and moves them to another day", async ({ page }) => {
  const { tripId } = await seedTripWithItems({
    title: "E2E Long Press Move",
    startDate: "2026-12-22",
    endDate: "2026-12-23",
    isDomestic: true,
    itemsByDay: { 1: ["Move-A", "Move-B"], 2: ["Move-Day2"] },
  });

  await page.goto(`/trips/${tripId}`);
  await expect(page.getByText("Move-A", { exact: true })).toBeVisible({ timeout: 10_000 });

  const firstCard = page.getByTestId(/schedule-card-/).filter({ hasText: "Move-A" });
  await firstCard.dispatchEvent("pointerdown", { clientX: 20, clientY: 20, button: 0 });
  await page.waitForTimeout(500);
  await firstCard.dispatchEvent("pointerup");

  await expect(page.getByText("1개 선택")).toBeVisible();
  await page.getByText("Move-B", { exact: true }).click();
  await expect(page.getByText("2개 선택")).toBeVisible();
  await page.getByRole("button", { name: "이동" }).click();
  await page.getByRole("button", { name: /Day 2/ }).click();

  await page.getByRole("tab", { name: /Day 2/ }).click();
  await expect(page.getByText("Move-A", { exact: true })).toBeVisible();
  await expect(page.getByText("Move-B", { exact: true })).toBeVisible();
});

test("long-pressing a card selects items and deletes them", async ({ page }) => {
  const { tripId } = await seedTripWithItems({
    title: "E2E Long Press Delete",
    startDate: "2026-12-24",
    endDate: "2026-12-24",
    isDomestic: true,
    itemsByDay: { 1: ["Delete-A", "Delete-B", "Keep-C"] },
  });

  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(`/trips/${tripId}`);
  await expect(page.getByText("Delete-A", { exact: true })).toBeVisible({ timeout: 10_000 });

  const firstCard = page.getByTestId(/schedule-card-/).filter({ hasText: "Delete-A" });
  await firstCard.dispatchEvent("pointerdown", { clientX: 20, clientY: 20, button: 0 });
  await page.waitForTimeout(500);
  await firstCard.dispatchEvent("pointerup");

  await page.getByText("Delete-B", { exact: true }).click();
  await expect(page.getByText("2개 선택")).toBeVisible();
  await page.getByRole("button", { name: "삭제" }).click();

  await expect(page.getByText("Delete-A", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Delete-B", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Keep-C", { exact: true })).toBeVisible();
});

test("desktop schedule time picker shows AM before PM and saves a 24-hour value", async ({ page }) => {
  const { tripId } = await seedTripWithItems({
    title: "E2E Desktop Time Picker",
    startDate: "2026-12-25",
    endDate: "2026-12-25",
    isDomestic: true,
    itemsByDay: {},
  });

  await page.setViewportSize({ width: 1280, height: 820 });
  await page.goto(`/trips/${tripId}`);
  await page.getByLabel("일정 추가").click();
  await page.getByRole("radio", { name: "기타" }).click();
  await page.getByLabel("제목").fill("시간 저장 테스트");

  const timeGroup = page.getByRole("group", { name: "시간" });
  await expect(timeGroup.getByRole("button", { name: "오전" })).toBeVisible();
  await expect(timeGroup.getByRole("button", { name: "오후" })).toBeVisible();
  const periodLabels = await timeGroup.getByRole("button").allTextContents();
  expect(periodLabels.indexOf("오전")).toBeLessThan(periodLabels.indexOf("오후"));

  await timeGroup.getByRole("button", { name: "오후" }).click();
  await timeGroup.getByLabel("시").selectOption("05");
  await timeGroup.getByLabel("분").selectOption("16");
  await page.getByRole("button", { name: "추가", exact: true }).click();

  await expect(page.getByText("시간 저장 테스트", { exact: true })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText("17:16", { exact: true })).toBeVisible();
});

test("mobile schedule time field keeps the native time input", async ({ browser, baseURL }) => {
  const { tripId } = await seedTripWithItems({
    title: "E2E Mobile Native Time",
    startDate: "2026-12-26",
    endDate: "2026-12-26",
    isDomestic: true,
    itemsByDay: {},
  });

  const ctx = await browser.newContext({
    ...devices["Pixel 5"],
    baseURL,
    storageState: "tests/e2e/.auth/alice.json",
  });
  const page = await ctx.newPage();
  await page.goto(`/trips/${tripId}`);
  await page.getByLabel("일정 추가").click();
  await page.getByRole("radio", { name: "기타" }).click();

  await expect(page.getByRole("button", { name: "오전" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "오후" })).toHaveCount(0);
  await expect(page.getByLabel("시간")).toHaveAttribute("type", "time");
  await ctx.close();
});
```

- [ ] **Step 2: Run the E2E tests**

Run:

```bash
npm run test:e2e -- tests/e2e/schedule-layout-and-selection.spec.ts
```

Expected: PASS after Tasks 1-7.

- [ ] **Step 3: Commit Task 8**

Run:

```bash
git add -- tests/e2e/schedule-layout-and-selection.spec.ts
git commit -m "test(schedule): cover long press selection flows"
```

---

## Task 9: Auth Persistence And Login Redirect

**Files:**
- Modify: `lib/supabase/browser-client.ts`
- Modify: `lib/auth/sign-in.ts`
- Modify: `app/login/page.tsx`
- Modify: `tests/e2e/login.spec.ts`

- [ ] **Step 1: Add existing-session login E2E coverage**

Append to `tests/e2e/login.spec.ts`:

```ts
  test("로그인 세션이 있으면 /login에서 /trips로 이동한다", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: "tests/e2e/.auth/alice.json" });
    const page = await ctx.newPage();
    await page.goto("/login");
    await expect(page).toHaveURL(/\/trips/, { timeout: 10_000 });
    await ctx.close();
  });
```

- [ ] **Step 2: Run login E2E and verify current redirect fails**

Run:

```bash
npm run test:e2e -- tests/e2e/login.spec.ts
```

Expected: FAIL because `/login` does not redirect away before initializing the GIS sign-in flow.

- [ ] **Step 3: Make Supabase browser auth options explicit**

In `lib/supabase/browser-client.ts`, replace the `createBrowserClient` call with:

```ts
    client = createBrowserClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      },
    ) as SupabaseClient;
```

- [ ] **Step 4: Stop forcing account selection for redirect sign-in**

In `lib/auth/sign-in.ts`, remove the `queryParams` block:

```ts
      queryParams: {
        prompt: "select_account",
      },
```

The `options` object should keep only `redirectTo`.

- [ ] **Step 5: Add already-signed-in redirect to login page**

In `app/login/page.tsx`, import the browser client:

```ts
import { getBrowserClient } from "@/lib/supabase/browser-client";
```

Extend the status union:

```ts
    "checking" | "idle" | "signing" | "redirecting" | "error" | "popup_blocked"
```

Initialize status with `"checking"`:

```ts
  const [status, setStatus] = useState<
    "checking" | "idle" | "signing" | "redirecting" | "error" | "popup_blocked"
  >("checking");
```

Replace the current GIS initialization effect with:

```tsx
  useEffect(() => {
    if (!buttonRef.current) return;
    let cancelled = false;
    const restoreConsole = installGisPopupBlockedConsoleHandler(() => {
      if (cancelled) return;
      setStatus("popup_blocked");
      setErrorMsg("현재 브라우저에서 Google 로그인 팝업을 열 수 없어요.");
    });

    (async () => {
      try {
        const supabase = getBrowserClient();
        const { data: userData } = await supabase.auth.getUser();
        if (cancelled) return;
        if (userData.user) {
          router.replace(redirectPath);
          return;
        }

        setStatus("idle");
        const { idToken, rawNonce } = await requestGoogleIdToken(buttonRef.current!);
        if (cancelled) return;
        setStatus("signing");
        await signInWithGoogle({ idToken, rawNonce });
        if (cancelled) return;
        router.replace(redirectPath);
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "로그인 실패");
      }
    })();

    return () => {
      cancelled = true;
      restoreConsole();
    };
  }, [router, redirectPath]);
```

Add a checking message above the signing message:

```tsx
      {status === "checking" && (
        <p className="text-ink-600 mt-4 flex items-center justify-center gap-2 text-[13px]">
          <Loader2 size={14} className="animate-spin" /> 세션 확인 중...
        </p>
      )}
```

- [ ] **Step 6: Run login tests and commit**

Run:

```bash
npm test -- tests/unit/pwa-runtime-caching.test.ts
npm run test:e2e -- tests/e2e/login.spec.ts
npm run lint -- app/login/page.tsx lib/auth/sign-in.ts lib/supabase/browser-client.ts
git add -- app/login/page.tsx lib/auth/sign-in.ts lib/supabase/browser-client.ts tests/e2e/login.spec.ts
git commit -m "fix(auth): reuse existing login sessions"
```

Expected: login E2E passes.

---

## Task 10: Remove Design-System Entry Points

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/settings/page.tsx`
- Create: `tests/unit/design-links.test.tsx`

- [ ] **Step 1: Add tests for visible design links**

Create `tests/unit/design-links.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LandingPage from "@/app/page";
import SettingsPage from "@/app/settings/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ clear: vi.fn() }),
}));

vi.mock("@/lib/profile/use-profile", () => ({
  useMyProfile: () => ({ data: null }),
}));

vi.mock("@/lib/group/use-my-group", () => ({
  useMyGroup: () => ({ data: null }),
}));

vi.mock("@/lib/supabase/browser-client", () => ({
  getBrowserClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: null } }),
    },
  }),
}));

describe("design system links", () => {
  it("does not show design system CTA on the landing page", () => {
    render(<LandingPage />);
    expect(screen.queryByText("디자인 시스템 보기")).toBeNull();
  });

  it("does not show design palette link in settings", () => {
    render(<SettingsPage />);
    expect(screen.queryByText("디자인 시스템 팔레트 보기")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests and verify current links fail**

Run:

```bash
npm test -- tests/unit/design-links.test.tsx
```

Expected: FAIL because both visible design links still exist.

- [ ] **Step 3: Remove landing page design CTA**

In `app/page.tsx`, remove this block:

```tsx
          <Link href="/design" className="block w-full">
            <Button size="md" fullWidth variant="ghost">
              디자인 시스템 보기
            </Button>
          </Link>
```

- [ ] **Step 4: Remove settings footer palette link**

In `app/settings/page.tsx`, remove:

```tsx
        <div className="mt-4 text-center">
          <Link
            href="/design"
            className="text-ink-600 hover:text-error text-[12px] underline-offset-2 hover:underline"
          >
            디자인 시스템 팔레트 보기
          </Link>
        </div>
```

Remove the now-unused `Link` import from `app/settings/page.tsx`.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm test -- tests/unit/design-links.test.tsx
npm run lint -- app/page.tsx app/settings/page.tsx tests/unit/design-links.test.tsx
git add -- app/page.tsx app/settings/page.tsx tests/unit/design-links.test.tsx
git commit -m "chore(ui): hide design system links"
```

Expected: tests pass; lint has no new errors.

---

## Task 11: Final Verification

**Files:**
- Read: changed files from Tasks 1-10

- [ ] **Step 1: Check git status**

Run:

```bash
git status --short
```

Expected: only user-owned pre-existing files may be dirty. The feature files from this plan should be committed.

- [ ] **Step 2: Run unit tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: no new errors. Existing warnings may remain if they predate this feature.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS. Existing Next warnings may remain if unrelated.

- [ ] **Step 5: Run targeted integration tests**

Run:

```bash
npm run test:integration -- tests/integration/schedule-v1-1-rpc.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run targeted E2E tests**

Run:

```bash
npm run test:e2e -- tests/e2e/login.spec.ts tests/e2e/schedule-layout-and-selection.spec.ts tests/e2e/lodging-range-and-bulk-move.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Record verification results**

Append a short verification note to `docs/superpowers/specs/2026-05-30-trip-map-usability-design.md` under a new `## 10. Implementation Notes` section:

```md
## 10. Implementation Notes

Final verification was run on 2026-05-30 from branch `codex-trip-map-usability`.

- `npm test` -> passed.
- `npm run lint` -> passed with no new errors.
- `npm run build` -> passed.
- `npm run test:integration -- tests/integration/schedule-v1-1-rpc.test.ts` -> passed.
- `npm run test:e2e -- tests/e2e/login.spec.ts tests/e2e/schedule-layout-and-selection.spec.ts tests/e2e/lodging-range-and-bulk-move.spec.ts` -> passed.
```

If a command fails, write the actual failing command and reason instead of the success text, then fix the failure before shipping.

- [ ] **Step 8: Commit verification note**

Run:

```bash
git add -- docs/superpowers/specs/2026-05-30-trip-map-usability-design.md
git commit -m "docs: record trip usability verification"
```

Expected: commit succeeds after verification passes.
