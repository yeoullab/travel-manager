import { describe, expect, it } from "vitest";
import {
  aggregateByCategory,
  aggregateByCurrency,
  groupByDate,
  sumByCurrency,
  type Expense,
} from "@/lib/expense/aggregate";

function mk(partial: Partial<Expense>): Expense {
  const base: Record<string, unknown> = {
    id: "00000000-0000-0000-0000-000000000000",
    trip_id: "t1",
    category_code: "food",
    title: "meal",
    amount: 0,
    currency: "KRW",
    expense_date: "2026-05-01",
    memo: null,
    paid_by: null,
    schedule_item_id: null,
    created_by: "u1",
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
  };
  return { ...base, ...partial } as Expense;
}

describe("aggregateByCurrency", () => {
  it("sums amounts per currency (numeric conversion)", () => {
    const items = [
      mk({ currency: "KRW", amount: 1000 }),
      mk({ currency: "KRW", amount: 500 }),
      mk({ currency: "JPY", amount: 3000 }),
    ];
    expect(aggregateByCurrency(items)).toEqual({ KRW: 1500, JPY: 3000 });
  });
  it("returns empty object for empty input", () => {
    expect(aggregateByCurrency([])).toEqual({});
  });
});

describe("aggregateByCategory", () => {
  it("nests by category_code then currency", () => {
    const items = [
      mk({ category_code: "food", currency: "KRW", amount: 1000 }),
      mk({ category_code: "food", currency: "USD", amount: 10 }),
      mk({ category_code: "transport", currency: "KRW", amount: 2000 }),
    ];
    const out = aggregateByCategory(items);
    expect(out.food).toEqual({ KRW: 1000, USD: 10 });
    expect(out.transport).toEqual({ KRW: 2000 });
  });
});

describe("groupByDate", () => {
  it("groups by expense_date preserving input order", () => {
    const a = mk({ id: "a", expense_date: "2026-05-01", title: "a" });
    const b = mk({ id: "b", expense_date: "2026-05-02", title: "b" });
    const c = mk({ id: "c", expense_date: "2026-05-01", title: "c" });
    const out = groupByDate([a, b, c]);
    expect(out["2026-05-01"].map((e) => e.id)).toEqual(["a", "c"]);
    expect(out["2026-05-02"].map((e) => e.id)).toEqual(["b"]);
  });
});

describe("sumByCurrency", () => {
  it("is an alias of aggregateByCurrency", () => {
    const items = [mk({ currency: "KRW", amount: 1 }), mk({ currency: "KRW", amount: 2 })];
    expect(sumByCurrency(items)).toEqual({ KRW: 3 });
  });
});
