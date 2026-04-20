"use client";

import { useMemo, useState } from "react";
import { Filter, Wallet } from "lucide-react";
import { ExpenseRow } from "@/components/ui/expense-row";
import { EmptyState } from "@/components/ui/empty-state";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { Fab } from "@/components/ui/fab";
import { getExpensesByTripId, aggregateExpensesByCurrency } from "@/lib/mocks";
import type { Expense, ExpenseCategory } from "@/lib/types";
import { chipClassForColor } from "@/lib/profile/colors";
import { useTripMembers } from "@/lib/profile/use-trip-members";
import { cn } from "@/lib/cn";

const CATEGORIES: { key: ExpenseCategory | "all"; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "food", label: "식비" },
  { key: "transport", label: "교통" },
  { key: "lodging", label: "숙박" },
  { key: "shopping", label: "쇼핑" },
  { key: "activity", label: "액티비티" },
  { key: "other", label: "기타" },
];

const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  food: "식비",
  transport: "교통",
  lodging: "숙박",
  shopping: "쇼핑",
  activity: "액티비티",
  other: "기타",
};

const CURRENCY_SYMBOL: Record<string, string> = {
  KRW: "₩",
  JPY: "¥",
  USD: "$",
  EUR: "€",
  CNY: "¥",
  THB: "฿",
};

type Props = { tripId: string };

/**
 * 08 /trips/[id]?tab=expenses
 *
 * 통화별 총계 카드 + 카테고리 필터 칩 + 날짜별 그룹 리스트.
 * ExpenseRow 사용. FAB → BottomSheet 경비 추가 폼 (저장 없음).
 */
export function ExpensesTab({ tripId }: Props) {
  const [filter, setFilter] = useState<ExpenseCategory | "all">("all");
  const [sheetOpen, setSheetOpen] = useState(false);

  const { lookup: lookupMember } = useTripMembers(tripId);
  const all = useMemo(() => getExpensesByTripId(tripId), [tripId]);
  const totals = useMemo(() => aggregateExpensesByCurrency(tripId), [tripId]);

  const filtered = filter === "all" ? all : all.filter((e) => e.category === filter);
  const byDate = useMemo(() => groupByDate(filtered), [filtered]);
  const categoryTotals = useMemo(() => aggregateByCategory(all), [all]);

  return (
    <div className="px-4 pt-3 pb-28">
      <div className="bg-surface-300/50 border-border-primary mb-4 rounded-lg border px-3 py-2">
        <p className="text-ink-700 text-[12px]">이 탭은 다음 단계에서 실 데이터로 연결됩니다</p>
      </div>
      {/* Totals card */}
      <div className="bg-surface-100 border-border-primary rounded-[12px] border p-4">
        <p className="text-ink-600 text-[11px] font-medium tracking-wider uppercase">
          총 경비 (통화별)
        </p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
          {Object.entries(totals).length === 0 ? (
            <p className="text-ink-700 text-[14px]">아직 기록된 경비가 없어요</p>
          ) : (
            Object.entries(totals).map(([currency, amount]) => (
              <div key={currency}>
                <p className="text-ink-900 font-mono text-[22px] font-semibold tracking-[-0.01em]">
                  {formatAmount(amount, currency)}
                </p>
                <p className="text-ink-600 text-[11px] tracking-wider uppercase">{currency}</p>
              </div>
            ))
          )}
        </div>
        {Object.keys(categoryTotals).length > 0 && (
          <div className="border-border-primary mt-4 border-t pt-3">
            <p className="text-ink-600 mb-2 text-[11px] font-medium tracking-wider uppercase">
              카테고리별
            </p>
            <ul className="flex flex-col gap-1">
              {Object.entries(categoryTotals).map(([cat, byCurr]) => (
                <li key={cat} className="flex items-baseline justify-between gap-3">
                  <span className="text-ink-800 text-[13px]">
                    {CATEGORY_LABEL[cat as ExpenseCategory]}
                  </span>
                  <span className="text-ink-700 font-mono text-[12px] tabular-nums">
                    {Object.entries(byCurr)
                      .map(([c, a]) => formatAmount(a, c))
                      .join("  ·  ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Category filter */}
      <div className="-mx-4 mt-4 flex items-center gap-2 overflow-x-auto px-4 pb-1">
        <Filter size={14} className="text-ink-500 ml-0.5 shrink-0" aria-hidden />
        {CATEGORIES.map((c) => {
          const active = filter === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilter(c.key)}
              aria-pressed={active}
              className={cn(
                "h-8 shrink-0 rounded-full px-3 text-[12px] font-medium transition-colors",
                active ? "bg-ink-900 text-cream" : "bg-surface-400 text-ink-700 hover:text-ink-900",
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Grouped list */}
      {filtered.length === 0 ? (
        <EmptyState
          className="py-16"
          icon={<Wallet size={48} strokeWidth={1.5} />}
          title={filter === "all" ? "경비가 없어요" : "해당 카테고리 경비가 없어요"}
          description={
            filter === "all"
              ? "여행 경비를 기록해 정산을 편하게 해보세요."
              : "다른 카테고리를 선택하거나 항목을 추가해보세요."
          }
          cta={
            filter === "all" ? (
              <Button variant="primary" onClick={() => setSheetOpen(true)}>
                + 경비 추가
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {Object.entries(byDate).map(([date, expenses]) => {
            const daySum = sumByCurrency(expenses);
            return (
              <section key={date}>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h3 className="text-ink-600 text-[11px] font-semibold tracking-wider uppercase">
                    {formatDateHeading(date)}
                  </h3>
                  <p className="text-ink-700 font-mono text-[11px] tabular-nums">
                    {Object.entries(daySum)
                      .map(([c, a]) => formatAmount(a, c))
                      .join("  ·  ")}
                  </p>
                </div>
                <div className="bg-surface-100 border-border-primary overflow-hidden rounded-[12px] border">
                  {expenses.map((e) => {
                    const payer = lookupMember(e.paidBy);
                    return (
                      <ExpenseRow
                        key={e.id}
                        category={e.category}
                        title={e.title}
                        amount={e.amount}
                        currency={e.currency}
                        paidByName={payer?.display_name ?? e.paidBy ?? ""}
                        paidByChip={chipClassForColor(
                          payer?.color as Parameters<typeof chipClassForColor>[0],
                        )}
                        memo={e.memo ?? undefined}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Fab aria-label="경비 추가" onClick={() => setSheetOpen(true)} />

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="경비 추가"
        footer={
          <Button fullWidth variant="primary" onClick={() => setSheetOpen(false)}>
            저장
          </Button>
        }
      >
        <div className="space-y-4">
          <TextField label="제목" placeholder="예: 점심 식사" />
          <TextField label="금액" placeholder="0" inputMode="numeric" />
          <TextField label="날짜" type="date" />
          <p className="text-ink-500 text-[12px]">Phase 0 목업 — 입력은 저장되지 않습니다.</p>
        </div>
      </BottomSheet>
    </div>
  );
}

function groupByDate(items: Expense[]): Record<string, Expense[]> {
  const out: Record<string, Expense[]> = {};
  for (const e of items) {
    (out[e.expenseDate] ??= []).push(e);
  }
  return out;
}

function sumByCurrency(items: Expense[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of items) {
    out[e.currency] = (out[e.currency] ?? 0) + e.amount;
  }
  return out;
}

function aggregateByCategory(items: Expense[]): Record<ExpenseCategory, Record<string, number>> {
  const out = {} as Record<ExpenseCategory, Record<string, number>>;
  for (const e of items) {
    out[e.category] ??= {};
    out[e.category][e.currency] = (out[e.category][e.currency] ?? 0) + e.amount;
  }
  return out;
}

function formatAmount(amount: number, currency: string): string {
  const sym = CURRENCY_SYMBOL[currency] ?? currency;
  const needsDecimal = currency === "USD" || currency === "EUR";
  const formatted = needsDecimal ? amount.toFixed(2) : amount.toLocaleString("ko-KR");
  return `${sym}${formatted}`;
}

function formatDateHeading(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}
