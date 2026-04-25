# Categories Management Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spec §6.11 의 미구현 항목인 `/settings/categories` 페이지를 V1 스코프(시스템 카테고리 6종 읽기 전용 + 색상/이름 + 사용처 분리 안내)로 구현하고, settings 허브의 "Phase 6에서 연결됩니다" 플레이스홀더를 실제 라우트로 대체한다.

**Architecture:** 새 라우트 `app/settings/categories/page.tsx` (`"use client"`). `useCategories()` 훅이 `categories` 테이블을 SELECT (RLS `categories_select_all` 통과). 두 도메인(일정/경비)의 카테고리 모델 차이를 UI에서 명시적으로 분리해 표시 — schedule은 DB FK 기반 6종(`transport/sightseeing/food/lodging/shopping/other`), expense는 클라이언트 상수 6종(`food/transport/lodging/shopping/activity/other`). V1 은 모두 읽기 전용. 커스텀 카테고리는 V2 후보로 본 plan 외부.

**Tech Stack:** Next.js 16 App Router (Client Component), TanStack Query, Supabase JS, Tailwind, 자체 UI 프리미티브 (`AppBar`/`SettingsGroup` 패턴 재사용), Vitest + Playwright.

---

## File Structure

| 경로 | 액션 | 책임 |
|---|---|---|
| `lib/category/use-categories.ts` | Create | TanStack Query 훅 — `categories` SELECT (sort_order 오름차순). 시스템 테이블이라 staleTime: Infinity |
| `lib/query/keys.ts` | Modify | `categories.all` 키 추가 |
| `app/settings/categories/page.tsx` | Create | `"use client"` 페이지 — AppBar + 일정 카테고리 섹션 + 경비 카테고리 섹션 + footnote |
| `components/settings/category-row.tsx` | Create | 1행 컴포넌트 — color swatch + name + code (mono) |
| `app/settings/page.tsx` | Modify | "카테고리 관리" 행의 `onClick` 을 `flash("Phase 6...")` → `router.push("/settings/categories")` 로 교체 |
| `tests/unit/use-categories.test.ts` | Create | hook unit — sort 순서 보장, queryKey 안정성 |
| `tests/integration/categories-rls.test.ts` | Create | RLS — anon SELECT 거부 + authenticated 6 row SELECT |
| `tests/e2e/settings-categories.spec.ts` | Create | E2E — settings → 카테고리 관리 → 6종 전부 노출 + 일정/경비 분리 표시 |

**Dependency 순서:** Task 1 (queryKey) → Task 2 (hook) → Task 3 (RLS integration) → Task 4 (CategoryRow) → Task 5 (page) → Task 6 (settings re-wire) → Task 7 (E2E) → Task 8 (verification + commit + spec/wiki 갱신)

---

## Conventions

- **Branch:** main 직접 (단일 commit 단위 small. 위험 낮음, 위크리 따로 안 만들음)
- **Commit prefix:** `feat(settings):` / `test(...):` / `docs(spec):`
- **테스트 명명:**
  - unit `.test.ts`
  - integration `.test.ts` under `tests/integration/`
  - E2E `.spec.ts` under `tests/e2e/` — `playwright.config.ts` 의 `alice` project testMatch 에 추가
- **Co-author footer:** 이전 커밋 패턴 그대로 유지 (`Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`)

---

### Task 1: Add `categories` queryKey scope

**Files:**
- Modify: `lib/query/keys.ts`

- [ ] **Step 1: Read current `keys.ts`**

```bash
cat lib/query/keys.ts
```
Expected: `queryKeys` const with `profile, tripMembers, trips, group, tripDays, schedule, expenses, todos, records, guest` scopes.

- [ ] **Step 2: Append `categories` scope after `schedule`**

Insert this block right after the `schedule:` block (between `schedule` 와 `// ── Phase 4 additions ──`):

```ts
  categories: {
    all: ["categories", "all"] as const,
  },
```

- [ ] **Step 3: tsc**

Run: `pnpm tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add lib/query/keys.ts
git commit -m "$(cat <<'EOF'
feat(query): add categories queryKey scope

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `useCategories` hook + unit test (TDD)

**Files:**
- Create: `lib/category/use-categories.ts`
- Create: `tests/unit/use-categories.test.ts`

- [ ] **Step 1: Write the failing unit test**

`tests/unit/use-categories.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { queryKeys } from "@/lib/query/keys";

describe("categories queryKey", () => {
  it("exposes a stable categories.all key", () => {
    expect(queryKeys.categories.all).toEqual(["categories", "all"]);
  });
});

describe("Category row shape", () => {
  it("matches the seed contract from 0008_categories.sql", async () => {
    const { CATEGORY_FALLBACK_LABEL } = await import("@/lib/category/use-categories");
    expect(CATEGORY_FALLBACK_LABEL).toEqual({
      transport: "교통",
      sightseeing: "관광",
      food: "식당",
      lodging: "숙소",
      shopping: "쇼핑",
      other: "기타",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/use-categories.test.ts`
Expected: FAIL — `Cannot find module '@/lib/category/use-categories'`.

- [ ] **Step 3: Write the hook**

`lib/category/use-categories.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import type { Database } from "@/types/database";

export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

/**
 * Schedule (일정) 도메인 시스템 카테고리 6종.
 * 0008_categories.sql 의 seed 와 1:1. components/ui/schedule-item.tsx 의 categoryColor / categoryLabel 도 같은 코드 집합 사용.
 * RLS 가 SELECT only 라 INSERT/UPDATE/DELETE 는 시도해도 deny — V1 은 읽기 전용.
 */
export function useCategories() {
  const supabase = getBrowserClient();
  return useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: async (): Promise<CategoryRow[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: Infinity, // 시스템 테이블, 사실상 변하지 않음
  });
}

/** 0008 seed 의 한글 라벨 fallback. DB row.name 이 우선이지만 SSR/loading 시 fallback. */
export const CATEGORY_FALLBACK_LABEL: Record<string, string> = {
  transport: "교통",
  sightseeing: "관광",
  food: "식당",
  lodging: "숙소",
  shopping: "쇼핑",
  other: "기타",
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/use-categories.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: tsc + lint**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add lib/category/use-categories.ts tests/unit/use-categories.test.ts
git commit -m "$(cat <<'EOF'
feat(category): useCategories hook + label fallback (read-only)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Integration test — categories RLS contract

**Files:**
- Create: `tests/integration/categories-rls.test.ts`

- [ ] **Step 1: Write the failing integration test**

`tests/integration/categories-rls.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const STAMP = Date.now();
const PWD = "Test_Pwd_2026!";
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let userId = "";
let auth: SupabaseClient<Database>;
let anon: SupabaseClient<Database>;

beforeAll(async () => {
  const r = await admin.auth.admin.createUser({
    email: `catrls+${STAMP}@test.local`,
    password: PWD,
    email_confirm: true,
  });
  if (r.error) throw r.error;
  userId = r.data.user!.id;

  auth = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await auth.auth.signInWithPassword({
    email: `catrls+${STAMP}@test.local`,
    password: PWD,
  });
  if (error) throw error;

  anon = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
});

afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId);
});

describe("categories RLS (0008_categories.sql)", () => {
  it("authenticated user reads all 6 seed rows in sort_order", async () => {
    const { data, error } = await auth
      .from("categories")
      .select("code, name, sort_order")
      .order("sort_order", { ascending: true });
    expect(error).toBeNull();
    expect(data?.map((r) => r.code)).toEqual([
      "transport",
      "sightseeing",
      "food",
      "lodging",
      "shopping",
      "other",
    ]);
  });

  it("anon (no session) cannot read categories", async () => {
    const { data, error } = await anon.from("categories").select("code");
    // RLS deny → empty result (PostgREST policy 위반은 row 0 + error null)
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it("authenticated INSERT is denied (read-only system table)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (auth as any)
      .from("categories")
      .insert({ code: "test_x", name: "테스트", color_token: "bg-ink-400", sort_order: 99 });
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify the schema is in place**

Run: `pnpm test:integration tests/integration/categories-rls.test.ts`
Expected: PASS (3 tests). 0008 마이그레이션은 이미 원격 적용 완료.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/categories-rls.test.ts
git commit -m "$(cat <<'EOF'
test(integration): categories RLS contract — 6 seed rows + read-only

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `CategoryRow` UI component

**Files:**
- Create: `components/settings/category-row.tsx`

- [ ] **Step 1: Write the component**

`components/settings/category-row.tsx`:

```tsx
import { cn } from "@/lib/cn";

type Props = {
  /** Tailwind bg class — e.g. "bg-ti-read" */
  colorToken: string;
  /** 한글 표시 라벨 — 예: "교통" */
  name: string;
  /** code 식별자 — 예: "transport" */
  code: string;
  /** 추가 우측 슬롯 — 예: 사용 도메인 뱃지 */
  trailing?: React.ReactNode;
};

/**
 * /settings/categories 페이지의 1행. 좌측 색상 dot + 라벨/code + 우측 슬롯.
 * V1 read-only — onClick 미지원. V2 커스텀 카테고리 도입 시 액션 추가 예정.
 */
export function CategoryRow({ colorToken, name, code, trailing }: Props) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span
        aria-hidden
        className={cn(
          "border-border-primary inline-block h-4 w-4 shrink-0 rounded-full border",
          colorToken,
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="text-ink-900 truncate text-[15px] font-medium">{name}</p>
        <p className="text-ink-500 mt-0.5 truncate font-mono text-[11px]">{code}</p>
      </div>
      {trailing}
    </div>
  );
}
```

- [ ] **Step 2: tsc + lint**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/settings/category-row.tsx
git commit -m "$(cat <<'EOF'
feat(settings): CategoryRow UI primitive (color swatch + name + code)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `/settings/categories` page

**Files:**
- Create: `app/settings/categories/page.tsx`

- [ ] **Step 1: Write the page**

`app/settings/categories/page.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { AppBar } from "@/components/ui/app-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryRow } from "@/components/settings/category-row";
import { useCategories, CATEGORY_FALLBACK_LABEL } from "@/lib/category/use-categories";
import { EXPENSE_CATEGORIES } from "@/lib/expense/constants";

const EXPENSE_COLOR_TOKEN: Record<string, string> = {
  food: "bg-ti-thinking",
  transport: "bg-ti-read",
  lodging: "bg-ti-edit",
  shopping: "bg-accent-gold",
  activity: "bg-ti-grep",
  other: "bg-ink-400",
};

/**
 * 13 `/settings/categories` — 카테고리 관리 (V1: 읽기 전용).
 *
 * 일정과 경비는 카테고리 모델이 다르다:
 * - 일정: `categories` DB 테이블 FK (0008 seed 6종, schedule_items.category_code)
 * - 경비: 클라이언트 상수 `EXPENSE_CATEGORIES` + DB CHECK (0010_expenses.sql)
 * V1 은 두 도메인을 분리해 보여주기만 한다. 커스텀 카테고리는 V2 후보.
 */
export default function CategoriesPage() {
  const router = useRouter();
  const { data: categories, isLoading } = useCategories();

  return (
    <div className="flex min-h-dvh flex-col" style={{ minHeight: "100dvh" }}>
      <AppBar title="카테고리 관리" onBack={() => router.push("/settings")} />
      <main className="mx-auto w-full max-w-[560px] flex-1 px-4 pt-4 pb-16">
        <SectionHeader title="일정 카테고리" subtitle="여행 일정에 사용되는 카테고리예요" />
        <section className="bg-surface-100 border-border-primary divide-border-primary mt-2 flex flex-col divide-y overflow-hidden rounded-[12px] border">
          {isLoading ? (
            <ScheduleSkeleton />
          ) : (
            (categories ?? []).map((c) => (
              <CategoryRow
                key={c.code}
                colorToken={c.color_token}
                name={c.name || CATEGORY_FALLBACK_LABEL[c.code] || c.code}
                code={c.code}
              />
            ))
          )}
        </section>

        <SectionHeader title="경비 카테고리" subtitle="여행 경비 분류에 사용되는 카테고리예요" />
        <section className="bg-surface-100 border-border-primary divide-border-primary mt-2 flex flex-col divide-y overflow-hidden rounded-[12px] border">
          {EXPENSE_CATEGORIES.map((c) => (
            <CategoryRow
              key={c.code}
              colorToken={EXPENSE_COLOR_TOKEN[c.code] ?? "bg-ink-400"}
              name={c.label}
              code={c.code}
            />
          ))}
        </section>

        <p className="text-ink-500 mt-6 text-[12px] leading-relaxed">
          V1 은 시스템 카테고리만 제공해요. 커스텀 카테고리(직접 추가/편집)는 다음 버전에서 도입 예정이에요.
        </p>
      </main>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mt-4 px-1">
      <h2 className="text-ink-900 text-[16px] font-semibold">{title}</h2>
      {subtitle && <p className="text-ink-600 mt-0.5 text-[12px]">{subtitle}</p>}
    </div>
  );
}

function ScheduleSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </>
  );
}
```

- [ ] **Step 2: Verify Skeleton component API**

Run: `grep -E "^export function Skeleton" components/ui/skeleton.tsx`
Expected: matches `export function Skeleton(`.
If shape differs (e.g. `Skeleton` doesn't accept `className`), inspect the file and adapt — keep the rest of the page unchanged.

- [ ] **Step 3: tsc + lint + build**

Run: `pnpm tsc --noEmit && pnpm lint && pnpm build`
Expected: 0 errors. New route `/settings/categories` appears in build output as `○ (Static)` (client component pre-rendered shell).

- [ ] **Step 4: Commit**

```bash
git add app/settings/categories/page.tsx
git commit -m "$(cat <<'EOF'
feat(settings): /settings/categories page (V1 read-only)

Schedule categories from DB (categories table seed) + expense categories
from client constants, rendered as two separate sections. V2 covers
custom categories.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Re-wire settings hub row

**Files:**
- Modify: `app/settings/page.tsx:105-110`

- [ ] **Step 1: Replace placeholder onClick**

In `app/settings/page.tsx`, find the "카테고리 관리" `SettingsRow`:

```tsx
<SettingsRow
  icon={<Tag size={20} className="text-ink-600" />}
  title="카테고리 관리"
  subtitle="일정·경비 카테고리 커스터마이즈"
  onClick={() => flash("카테고리 관리는 Phase 6에서 연결됩니다")}
/>
```

Replace **only** the `onClick` line with:

```tsx
  onClick={() => router.push("/settings/categories")}
```

Also update the `subtitle` to reflect V1 read-only scope:

```tsx
  subtitle="일정·경비 카테고리 한눈에 보기"
```

- [ ] **Step 2: Verify `flash` is still used elsewhere**

Run: `grep -n 'flash(' app/settings/page.tsx`
Expected: at least one remaining usage (`handleLogout`). If `flash` ends up unused, also remove its declaration to keep lint clean — but `handleLogout` uses it, so it should stay.

- [ ] **Step 3: tsc + lint**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/settings/page.tsx
git commit -m "$(cat <<'EOF'
feat(settings): wire category-management row to /settings/categories

Replaces the "Phase 6에서 연결됩니다" toast placeholder with real route.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: E2E spec — settings → categories

**Files:**
- Create: `tests/e2e/settings-categories.spec.ts`
- Modify: `playwright.config.ts` — add spec to `alice` project `testMatch`

- [ ] **Step 1: Inspect playwright.config.ts to find the alice testMatch entry**

Run: `grep -nE "testMatch|alice" playwright.config.ts`
Expected: `alice` project block with a `testMatch` array listing existing specs (e.g. `expenses-crud.spec.ts`).

- [ ] **Step 2: Add the new spec to the alice testMatch list**

In `playwright.config.ts`, locate the `alice` project's `testMatch` array and add `"settings-categories.spec.ts"` to it. Keep alphabetical order if the existing list is alphabetical.

- [ ] **Step 3: Write the E2E spec**

`tests/e2e/settings-categories.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

// 사용자 alice (storageState alice.json) 로 settings → categories 진입 + 6+6 카테고리 노출 확인.
test("settings → 카테고리 관리 → 일정 6종 + 경비 6종 노출", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "설정" })).toBeVisible();

  await page.getByRole("button", { name: /카테고리 관리/ }).click();
  await page.waitForURL("**/settings/categories");

  await expect(page.getByRole("heading", { name: "카테고리 관리" })).toBeVisible();

  // 일정 섹션
  await expect(page.getByRole("heading", { name: "일정 카테고리" })).toBeVisible();
  for (const label of ["교통", "관광", "식당", "숙소", "쇼핑", "기타"]) {
    await expect(
      page.locator("section").filter({ hasText: "일정 카테고리" }).getByText(label, { exact: true }),
    ).toBeVisible();
  }

  // 경비 섹션
  await expect(page.getByRole("heading", { name: "경비 카테고리" })).toBeVisible();
  for (const label of ["식비", "교통", "숙박", "쇼핑", "액티비티", "기타"]) {
    await expect(
      page.locator("section").filter({ hasText: "경비 카테고리" }).getByText(label, { exact: true }),
    ).toBeVisible();
  }
});

test("뒤로가기 → /settings 로 복귀", async ({ page }) => {
  await page.goto("/settings/categories");
  await page.getByRole("button", { name: "뒤로" }).click();
  await page.waitForURL("**/settings");
  await expect(page.getByRole("heading", { name: "설정" })).toBeVisible();
});
```

- [ ] **Step 4: Verify the AppBar back button has the expected accessible name**

Run: `grep -nE "aria-label|onBack" components/ui/app-bar.tsx`
Expected: an aria-label like "뒤로" on the back button. If different (e.g. "Back"), update the spec's `name: "뒤로"` to match the actual label.

- [ ] **Step 5: Run the new E2E**

Run: `pnpm exec playwright test tests/e2e/settings-categories.spec.ts --project=alice --reporter=line`
Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/settings-categories.spec.ts playwright.config.ts
git commit -m "$(cat <<'EOF'
test(e2e): /settings/categories — 6+6 categories + back navigation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Full verification + spec/wiki sync + tag

**Files:**
- Modify: `docs/specs/2026-04-20-travel-manager-design-updated.md` — flip §0 row, §6.11 status
- Modify: `~/Library/CloudStorage/SynologyDrive-home/앱/MY_AI_WIKI/projects/travel-manager/status.md`

- [ ] **Step 1: Run full automated gate**

Run each in turn, stop on first failure:

```bash
pnpm tsc --noEmit
pnpm lint
pnpm test
pnpm test:integration
pnpm build
pnpm exec playwright test tests/e2e/share-toggle.spec.ts tests/e2e/partner-realtime.spec.ts tests/e2e/settings-categories.spec.ts --reporter=line
```

Expected:
- tsc: 0 errors
- lint: 0 errors (warnings unchanged from baseline)
- unit: ≥ 104/104 (102 prior + 2 new in Task 2)
- integration: ≥ 136/136 (133 prior + 3 new in Task 3)
- build: 15 routes (14 prior + `/settings/categories`)
- Realtime + categories E2E: all PASS

- [ ] **Step 2: Update spec §0 outstanding row**

In `docs/specs/2026-04-20-travel-manager-design-updated.md`, find:

```
| §6.11 | **(미완)** 카테고리 관리 페이지 (`/settings/categories`) — 기본 6 카테고리 + 커스텀 + 그룹 fanout | ⏳ Outstanding | — |
```

Replace with:

```
| §6.11 V1 | 카테고리 관리 페이지 (`/settings/categories`) — 시스템 카테고리 6종 read-only | ✅ Complete | (Task 8 commit) |
| §6.11 V2 | 커스텀 카테고리 (CRUD + 그룹 fanout) | ⏳ Outstanding | — |
```

Also flip §6.11 heading from `[⏳ 미구현 — 시드만 존재 (0008)]` to `[V1 ✅, V2 ⏳]`.

- [ ] **Step 3: Append re-audit row in 변경 이력**

Append at the end of the existing 변경 이력 table:

```
| **2026-04-25 categories V1** | §6.11 분리 — V1 read-only 페이지 완료, V2 커스텀 카테고리 outstanding |
```

- [ ] **Step 4: Update wiki status.md**

Edit `/Users/sohyun/Library/CloudStorage/SynologyDrive-home/앱/MY_AI_WIKI/projects/travel-manager/status.md`:

- Update `updated:` line frontmatter to today + "categories V1 페이지 완료"
- Move the categories item from "다음 할 일" to "완료된 것" with a `[x]` checkbox: `[x] **[2026-04-25 완료] /settings/categories V1** — 시스템 카테고리 6종 read-only. V2 커스텀은 후속 plan`
- Add a session-log bullet under "메모" referencing this plan path

- [ ] **Step 5: Commit docs**

```bash
git add docs/specs/2026-04-20-travel-manager-design-updated.md
git commit -m "$(cat <<'EOF'
docs(spec): mark §6.11 V1 complete, V2 (custom categories) outstanding

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

The wiki edit is outside the git repo and saves on its own.

- [ ] **Step 6: Tag**

```bash
git tag categories-v1
git log --oneline -10
```
Expected: 7 new commits (Tasks 1–7) + 1 docs commit (Task 8 step 5) on top of `35332f5`. Tag `categories-v1` on the latest commit.

> origin push 는 사용자 수동 (`git push origin main --follow-tags`).

---

## Self-Review

**1. Spec coverage:**
- Spec §6.11 (Category Management) — V1 read-only 페이지 → Task 5. Spec 의 "기본 + 커스텀" 중 커스텀은 본 plan 외부로 명시.
- §0 Implementation Status `§6.11 미완` 행 → Task 8 에서 `V1 ✅ / V2 ⏳` 로 분리 + 변경 이력 row 추가.
- §5 Routing `/settings/categories` 행 → 페이지 자체는 Task 5 가 만족. Routing 표는 이미 `[⏳ 미구현]` 으로 표기돼 있고 spec 업데이트는 Task 8 에서 자동 표기 변경.
- spec 외 nav placeholder ("Phase 6에서 연결됩니다" toast) → Task 6 가 제거.

**2. Placeholder scan:** 검색 — "TBD", "TODO", "implement later", "fill in details", "appropriate error handling", "edge cases", "Similar to Task" — 없음. 모든 step 에 코드/명령/기대 결과 포함.

**3. Type consistency:**
- `useCategories` 반환 타입 `CategoryRow[]` — Task 2 정의, Task 5 가 `(categories ?? []).map((c) => ...)` 로 사용 (`c.code` / `c.name` / `c.color_token` 모두 0008 schema 와 일치).
- `EXPENSE_CATEGORIES` import path — `@/lib/expense/constants` (실재 확인됨, code → label 객체 배열).
- `queryKeys.categories.all` — Task 1 추가, Task 2 사용. 둘 다 `["categories", "all"] as const`.
- `CATEGORY_FALLBACK_LABEL` — Task 2 export, Task 5 import.
- `CategoryRow` props (`colorToken/name/code/trailing`) — Task 4 정의, Task 5 사용 시그니처 일치.
- `Skeleton` import — 기존 `components/ui/skeleton.tsx` 사용. Task 5 Step 2 가 API 차이 검증 단계로 안전망.

---

## Execution Handoff

**Plan complete and saved to `docs/plans/2026-04-25-categories-management.md`.**

다음 두 옵션 중 선택:

1. **Subagent-Driven (recommended)** — 각 Task 마다 fresh subagent 가 실행, two-stage review, 빠른 iteration. main context window 절약.
2. **Inline Execution** — 이 세션에서 Task 1~8 을 batch 로 실행. 사용자 checkpoint 만 제공.

어느 쪽?
