import * as React from "react";
import { cn } from "@/lib/cn";

export type ExpenseCategory =
  | "food"
  | "transport"
  | "lodging"
  | "shopping"
  | "activity"
  | "other";

const categoryLabel: Record<ExpenseCategory, string> = {
  food: "식비",
  transport: "교통",
  lodging: "숙박",
  shopping: "쇼핑",
  activity: "액티비티",
  other: "기타",
};

type ExpenseRowProps = {
  category: ExpenseCategory;
  title: string;
  amount: number;
  currency: string; // "KRW", "JPY", "USD" 등
  paidByName?: string;
  memo?: string;
  onClick?: () => void;
  className?: string;
};

const currencySymbol: Record<string, string> = {
  KRW: "₩",
  JPY: "¥",
  USD: "$",
  EUR: "€",
  CNY: "¥",
  THB: "฿",
};

function formatAmount(amount: number, currency: string): string {
  const symbol = currencySymbol[currency] ?? currency;
  const needsDecimal = currency === "USD" || currency === "EUR";
  const formatted = needsDecimal
    ? amount.toFixed(2)
    : amount.toLocaleString("ko-KR");
  return `${symbol}${formatted}`;
}

/**
 * 경비 아이템 행. 카테고리 배지 + 제목 + 금액(통화) + paid_by + memo.
 * 일자 집계는 컨테이너에서 처리; 이 컴포넌트는 단일 행만.
 */
export function ExpenseRow({
  category,
  title,
  amount,
  currency,
  paidByName,
  memo,
  onClick,
  className,
}: ExpenseRowProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "border-border-primary flex items-center gap-3 border-b px-4 py-3 last:border-b-0",
        "active:bg-surface-300 transition-colors",
        onClick && "cursor-pointer",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="bg-surface-500 text-ink-700 rounded-full px-2 py-0.5 text-[11px]">
            {categoryLabel[category]}
          </span>
          <p className="text-ink-900 truncate text-[15px] font-medium">{title}</p>
        </div>
        {(paidByName || memo) && (
          <p className="text-ink-600 mt-1 truncate text-[12px]">
            {paidByName && <span>결제: {paidByName}</span>}
            {paidByName && memo && <span> · </span>}
            {memo && <span>{memo}</span>}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-ink-900 font-mono text-[15px] font-semibold">
          {formatAmount(amount, currency)}
        </p>
      </div>
    </div>
  );
}
