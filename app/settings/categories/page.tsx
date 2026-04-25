"use client";

import { useRouter } from "next/navigation";
import { AppBar } from "@/components/ui/app-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryRow } from "@/components/settings/category-row";
import { useCategories, CATEGORY_FALLBACK_LABEL } from "@/lib/category/use-categories";
import { EXPENSE_CATEGORIES, type ExpenseCategoryCode } from "@/lib/expense/constants";

const EXPENSE_COLOR_TOKEN: Record<ExpenseCategoryCode, string> = {
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
                name={c.name || CATEGORY_FALLBACK_LABEL[c.code as keyof typeof CATEGORY_FALLBACK_LABEL] || c.code}
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
