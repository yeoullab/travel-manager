"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Filter, Wallet } from "lucide-react";
import { ExpenseRow } from "@/components/ui/expense-row";
import { EmptyState } from "@/components/ui/empty-state";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { TextField, TextArea } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { Fab } from "@/components/ui/fab";
import { chipClassForColor } from "@/lib/profile/colors";
import { useTripMembers } from "@/lib/profile/use-trip-members";
import { useMyProfile } from "@/lib/profile/use-profile";
import { useTripDetail } from "@/lib/trip/use-trip-detail";
import { useTripDays } from "@/lib/trip/use-trip-days";
import { useScheduleList } from "@/lib/schedule/use-schedule-list";
import { useExpenseList, type Expense } from "@/lib/expense/use-expense-list";
import { useCreateExpense } from "@/lib/expense/use-create-expense";
import { useUpdateExpense } from "@/lib/expense/use-update-expense";
import { useDeleteExpense } from "@/lib/expense/use-delete-expense";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  type ExpenseCategoryCode,
} from "@/lib/expense/constants";
import {
  formatAmountInput,
  parseAmountInput,
} from "@/lib/expense/format-amount-input";
import {
  aggregateByCategory,
  aggregateByCurrency,
  groupByDate,
  sumByCurrency,
} from "@/lib/expense/aggregate";
import {
  expenseAmountSchema,
  expenseCurrencySchema,
  expenseMemoSchema,
  expenseTitleSchema,
} from "@/lib/expense/schema";
import { useUiStore } from "@/lib/store/ui-store";
import type { ProfileColor } from "@/lib/profile/color-schema";
import { cn } from "@/lib/cn";

type FilterKey = ExpenseCategoryCode | "all";

const FILTER_CATEGORIES: { key: FilterKey; label: string }[] = [
  { key: "all", label: "전체" },
  ...EXPENSE_CATEGORIES.map((c) => ({ key: c.code as FilterKey, label: c.label })),
];

const CURRENCY_SYMBOL: Record<string, string> = {
  KRW: "₩",
  JPY: "¥",
  USD: "$",
  EUR: "€",
  CNY: "¥",
  THB: "฿",
};

type Props = { tripId: string };

type Prefill = {
  title?: string;
  expenseDate?: string;
  scheduleItemId?: string;
};

type SheetMode =
  | { kind: "closed" }
  | { kind: "create"; prefill?: Prefill }
  | { kind: "edit"; expense: Expense };

type FormValue = {
  expenseDate: string;
  title: string;
  amount: string;
  currency: string;
  categoryCode: ExpenseCategoryCode;
  paidBy: string | null;
  memo: string;
  scheduleItemId: string | null;
};

const UUID_RE = /^[0-9a-f-]{36}$/i;

/**
 * 08 /trips/[id]?tab=expenses
 *
 * 통화별 총계 카드 + 카테고리 필터 칩 + 날짜별 그룹 리스트.
 * ExpenseRow 사용. FAB → BottomSheet 경비 추가/편집.
 */
export function ExpensesTab({ tripId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filter, setFilter] = useState<FilterKey>("all");
  const [sheet, setSheet] = useState<SheetMode>({ kind: "closed" });

  const { data: trip } = useTripDetail(tripId);
  const { data: me } = useMyProfile();
  const { data: members = [], lookup: lookupMember } = useTripMembers(tripId);
  const { data: expenses = [], isLoading, error } = useExpenseList(tripId);
  const { data: scheduleItems = [] } = useScheduleList(tripId);
  const { data: tripDays = [] } = useTripDays(tripId);

  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const showToast = useUiStore((s) => s.showToast);

  // URL quickAdd: ?quickAdd=scheduleItemId:<uuid>
  const quickAdd = searchParams.get("quickAdd");
  const clearQuickAdd = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("quickAdd");
    const qs = next.toString();
    router.replace(`/trips/${tripId}${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!quickAdd) return;
    const sepIdx = quickAdd.indexOf(":");
    if (sepIdx < 0) {
      clearQuickAdd();
      return;
    }
    const kind = quickAdd.slice(0, sepIdx);
    const id = quickAdd.slice(sepIdx + 1);
    if (kind !== "scheduleItemId" || !UUID_RE.test(id)) {
      clearQuickAdd();
      return;
    }
    // schedule 아직 로딩 중이면 대기 (다음 effect tick 에서 prefill)
    if (scheduleItems.length === 0) return;
    const item = scheduleItems.find((s) => s.id === id);
    if (!item) {
      showToast("해당 일정을 찾을 수 없어요", "error");
      clearQuickAdd();
      return;
    }
    const day = tripDays.find((d) => d.id === item.trip_day_id);
    setSheet({
      kind: "create",
      prefill: {
        title: item.title,
        expenseDate: day?.date,
        scheduleItemId: item.id,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickAdd, scheduleItems, tripDays]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const totals = useMemo(() => aggregateByCurrency(expenses), [expenses]);
  const categoryTotals = useMemo(() => aggregateByCategory(expenses), [expenses]);
  const filtered = useMemo(
    () =>
      filter === "all" ? expenses : expenses.filter((e) => e.category_code === filter),
    [expenses, filter],
  );
  const byDate = useMemo(() => groupByDate(filtered), [filtered]);

  const tripCurrencies = useMemo(() => {
    if (!trip) return ["KRW"];
    const list = trip.is_domestic ? ["KRW"] : (trip.currencies ?? []);
    return list.length ? list : ["KRW"];
  }, [trip]);

  const openCreate = () => {
    if (!trip) return;
    setSheet({ kind: "create" });
  };

  const openEdit = (expense: Expense) => setSheet({ kind: "edit", expense });
  const closeSheet = () => {
    setSheet({ kind: "closed" });
    if (quickAdd) clearQuickAdd();
  };

  return (
    <div className="px-4 pt-3 pb-28">
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
                    {EXPENSE_CATEGORY_LABEL[cat as ExpenseCategoryCode] ?? cat}
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
      <div
        role="radiogroup"
        aria-label="카테고리 필터"
        className="-mx-4 mt-4 flex items-center gap-2 overflow-x-auto px-4 pb-1"
      >
        <Filter size={14} className="text-ink-500 ml-0.5 shrink-0" aria-hidden />
        {FILTER_CATEGORIES.map((c) => {
          const active = filter === c.key;
          return (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setFilter(c.key)}
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

      {/* Body */}
      {error ? (
        <EmptyState
          className="py-16"
          icon={<Wallet size={48} strokeWidth={1.5} />}
          title="경비를 불러오지 못했어요"
          description={error.message}
        />
      ) : isLoading ? (
        <p className="text-ink-600 py-16 text-center text-[14px]">불러오는 중…</p>
      ) : filtered.length === 0 ? (
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
              <Button variant="primary" onClick={openCreate}>
                + 경비 추가
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {Object.entries(byDate).map(([date, items]) => {
            const daySum = sumByCurrency(items);
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
                  {items.map((e) => {
                    const payer = lookupMember(e.paid_by);
                    return (
                      <ExpenseRow
                        key={e.id}
                        category={e.category_code as ExpenseCategoryCode}
                        title={e.title}
                        amount={Number(e.amount)}
                        currency={e.currency}
                        paidByName={payer?.display_name ?? (e.paid_by ? "(알 수 없음)" : "공동")}
                        paidByChip={chipClassForColor(
                          (payer?.color ?? null) as ProfileColor | null,
                        )}
                        memo={e.memo ?? undefined}
                        onClick={() => openEdit(e)}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Fab aria-label="경비 추가" onClick={openCreate} />

      <ExpenseSheet
        mode={sheet}
        tripId={tripId}
        tripCurrencies={tripCurrencies}
        isDomestic={trip?.is_domestic ?? true}
        myProfileId={me?.id ?? null}
        onClose={closeSheet}
        onSubmitCreate={async (values) => {
          try {
            await createExpense.mutateAsync({
              tripId,
              expenseDate: values.expenseDate,
              title: values.title,
              amount: parseAmountInput(values.amount),
              currency: values.currency,
              categoryCode: values.categoryCode,
              paidBy: values.paidBy,
              scheduleItemId: values.scheduleItemId,
              memo: values.memo.trim() === "" ? null : values.memo,
            });
            showToast("경비를 추가했어요", "success");
            closeSheet();
          } catch (err) {
            showToast(
              err instanceof Error ? err.message : "경비 추가 중 오류가 발생했어요",
              "error",
            );
          }
        }}
        onSubmitUpdate={async (values, expenseId) => {
          try {
            await updateExpense.mutateAsync({
              tripId,
              expenseId,
              expenseDate: values.expenseDate,
              title: values.title,
              amount: parseAmountInput(values.amount),
              currency: values.currency,
              categoryCode: values.categoryCode,
              paidBy: values.paidBy,
              scheduleItemId: values.scheduleItemId,
              memo: values.memo.trim() === "" ? null : values.memo,
            });
            showToast("경비를 수정했어요", "success");
            closeSheet();
          } catch (err) {
            showToast(
              err instanceof Error ? err.message : "경비 수정 중 오류가 발생했어요",
              "error",
            );
          }
        }}
        onDelete={async (expenseId) => {
          try {
            await deleteExpense.mutateAsync({ tripId, expenseId });
            showToast("경비를 삭제했어요", "success");
            closeSheet();
          } catch (err) {
            showToast(
              err instanceof Error ? err.message : "경비 삭제 중 오류가 발생했어요",
              "error",
            );
          }
        }}
        isSaving={createExpense.isPending || updateExpense.isPending}
        isDeleting={deleteExpense.isPending}
        members={members}
      />
    </div>
  );
}

type SheetProps = {
  mode: SheetMode;
  tripId: string;
  tripCurrencies: string[];
  isDomestic: boolean;
  myProfileId: string | null;
  members: Array<{ id: string | null; display_name: string | null; color: string | null }>;
  onClose: () => void;
  onSubmitCreate: (v: FormValue) => Promise<void>;
  onSubmitUpdate: (v: FormValue, expenseId: string) => Promise<void>;
  onDelete: (expenseId: string) => Promise<void>;
  isSaving: boolean;
  isDeleting: boolean;
};

function ExpenseSheet({
  mode,
  tripCurrencies,
  isDomestic,
  myProfileId,
  members,
  onClose,
  onSubmitCreate,
  onSubmitUpdate,
  onDelete,
  isSaving,
  isDeleting,
}: SheetProps) {
  const initialCurrency = tripCurrencies[0] ?? "KRW";
  const [values, setValues] = useState<FormValue>(() => buildInitialValues(mode, {
    myProfileId,
    initialCurrency,
  }));
  const [errors, setErrors] = useState<Partial<Record<keyof FormValue, string>>>({});

  // Re-init form when sheet opens or target expense changes.
  // eslint-disable react-hooks rules: we intentionally re-seed local state when
  // the sheet identity changes (new create session or different expense edit).
  const sheetKey =
    mode.kind === "edit"
      ? `edit:${mode.expense.id}`
      : mode.kind === "create"
        ? `create:${mode.prefill?.scheduleItemId ?? "blank"}`
        : "closed";
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (mode.kind === "closed") return;
    setValues(buildInitialValues(mode, { myProfileId, initialCurrency }));
    setErrors({});
  }, [sheetKey]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const open = mode.kind !== "closed";
  const isEdit = mode.kind === "edit";
  const title = isEdit ? "경비 수정" : "경비 추가";

  const update = <K extends keyof FormValue>(key: K, value: FormValue[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const validate = (): FormValue | null => {
    const next: Partial<Record<keyof FormValue, string>> = {};
    const titleResult = expenseTitleSchema.safeParse(values.title);
    if (!titleResult.success) next.title = titleResult.error.issues[0]?.message ?? "제목 오류";

    const amountResult = expenseAmountSchema.safeParse(parseAmountInput(values.amount));
    if (!amountResult.success)
      next.amount = amountResult.error.issues[0]?.message ?? "금액 오류";

    const currencyResult = expenseCurrencySchema.safeParse(values.currency);
    if (!currencyResult.success)
      next.currency = currencyResult.error.issues[0]?.message ?? "통화 오류";
    else if (isDomestic && values.currency !== "KRW") next.currency = "국내 여행은 KRW 만 허용";
    else if (!tripCurrencies.includes(values.currency))
      next.currency = "여행에 등록된 통화만 선택할 수 있어요";

    const memoResult = expenseMemoSchema.safeParse(values.memo);
    if (!memoResult.success) next.memo = memoResult.error.issues[0]?.message ?? "메모 오류";

    if (!values.expenseDate) next.expenseDate = "날짜를 선택해주세요";

    setErrors(next);
    return Object.keys(next).length === 0 ? values : null;
  };

  const handleSubmit = async () => {
    const valid = validate();
    if (!valid) return;
    if (mode.kind === "edit") {
      await onSubmitUpdate(valid, mode.expense.id);
    } else if (mode.kind === "create") {
      await onSubmitCreate(valid);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-2">
          {isEdit && (
            <Button
              variant="ghost"
              onClick={() => {
                if (!isEdit) return;
                if (confirm("이 경비를 삭제할까요?")) {
                  void onDelete(mode.expense.id);
                }
              }}
              disabled={isDeleting || isSaving}
            >
              삭제
            </Button>
          )}
          <Button
            fullWidth
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={isSaving || isDeleting}
          >
            {isSaving ? "저장 중…" : "저장"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* 카테고리 */}
        <div>
          <p className="text-ink-700 mb-2 text-[13px] font-medium">카테고리</p>
          <div
            role="radiogroup"
            aria-label="경비 카테고리"
            className="flex flex-wrap gap-2"
          >
            {EXPENSE_CATEGORIES.map((c) => {
              const active = values.categoryCode === c.code;
              return (
                <button
                  key={c.code}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => update("categoryCode", c.code)}
                  className={cn(
                    "h-9 rounded-full px-3 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-ink-900 text-cream"
                      : "bg-surface-400 text-ink-700 hover:text-ink-900",
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <TextField
          label="제목"
          placeholder="예: 점심 식사"
          value={values.title}
          onChange={(e) => update("title", e.target.value)}
          error={errors.title}
          maxLength={100}
        />

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <TextField
            label="금액"
            placeholder="0"
            inputMode="decimal"
            value={values.amount}
            onChange={(e) => update("amount", formatAmountInput(e.target.value))}
            error={errors.amount}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-ink-700 text-[13px] font-medium">통화</label>
            <select
              value={values.currency}
              onChange={(e) => update("currency", e.target.value)}
              className={cn(
                "bg-surface-100 border-border-primary h-11 rounded-[8px] border px-3 text-[15px]",
                errors.currency && "border-error",
              )}
              aria-invalid={errors.currency ? "true" : undefined}
            >
              {tripCurrencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {errors.currency && (
              <p className="text-error text-[12px]">{errors.currency}</p>
            )}
          </div>
        </div>

        <TextField
          label="날짜"
          type="date"
          value={values.expenseDate}
          onChange={(e) => update("expenseDate", e.target.value)}
          error={errors.expenseDate}
        />

        {/* 결제자 */}
        <div>
          <p className="text-ink-700 mb-2 text-[13px] font-medium">결제자</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              role="radio"
              aria-checked={values.paidBy === null}
              onClick={() => update("paidBy", null)}
              className={cn(
                "h-9 rounded-full px-3 text-[13px] font-medium transition-colors",
                values.paidBy === null
                  ? "bg-ink-900 text-cream"
                  : "bg-surface-400 text-ink-700 hover:text-ink-900",
              )}
            >
              공동
            </button>
            {members.map((m) => {
              const active = values.paidBy === m.id;
              return (
                <button
                  key={m.id ?? "unknown"}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => m.id && update("paidBy", m.id)}
                  className={cn(
                    "h-9 rounded-full px-3 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-ink-900 text-cream"
                      : "bg-surface-400 text-ink-700 hover:text-ink-900",
                  )}
                >
                  {m.display_name ?? "이름 없음"}
                </button>
              );
            })}
          </div>
        </div>

        <TextArea
          label="메모"
          placeholder="선택 사항"
          value={values.memo}
          onChange={(e) => update("memo", e.target.value)}
          error={errors.memo}
          maxLength={1000}
        />
      </div>
    </BottomSheet>
  );
}

function buildInitialValues(
  mode: SheetMode,
  opts: { myProfileId: string | null; initialCurrency: string },
): FormValue {
  if (mode.kind === "edit") {
    const e = mode.expense;
    return {
      expenseDate: e.expense_date,
      title: e.title,
      amount: formatAmountInput(String(e.amount)),
      currency: e.currency,
      categoryCode: e.category_code as ExpenseCategoryCode,
      paidBy: e.paid_by,
      memo: e.memo ?? "",
      scheduleItemId: e.schedule_item_id,
    };
  }
  const prefill = mode.kind === "create" ? mode.prefill : undefined;
  return {
    expenseDate: prefill?.expenseDate ?? todayIso(),
    title: prefill?.title ?? "",
    amount: "",
    currency: opts.initialCurrency,
    categoryCode: "food",
    paidBy: opts.myProfileId,
    memo: "",
    scheduleItemId: prefill?.scheduleItemId ?? null,
  };
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
