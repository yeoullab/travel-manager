import type { Database } from "@/types/database";

export type Expense = Database["public"]["Tables"]["expenses"]["Row"];

export function aggregateByCurrency(items: Expense[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of items) {
    out[e.currency] = (out[e.currency] ?? 0) + Number(e.amount);
  }
  return out;
}

export function aggregateByCategory(
  items: Expense[],
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const e of items) {
    out[e.category_code] ??= {};
    out[e.category_code][e.currency] =
      (out[e.category_code][e.currency] ?? 0) + Number(e.amount);
  }
  return out;
}

export function groupByDate(items: Expense[]): Record<string, Expense[]> {
  const out: Record<string, Expense[]> = {};
  for (const e of items) {
    (out[e.expense_date] ??= []).push(e);
  }
  return out;
}

export function sumByCurrency(items: Expense[]): Record<string, number> {
  return aggregateByCurrency(items);
}
