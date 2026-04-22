"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import type { ExpenseCategoryCode } from "./constants";

export type UpdateExpenseInput = {
  tripId: string; // invalidate 키 용도
  expenseId: string;
  expenseDate: string;
  title: string;
  amount: number;
  currency: string;
  categoryCode: ExpenseCategoryCode;
  paidBy?: string | null;
  scheduleItemId?: string | null;
  memo?: string | null;
};

export function useUpdateExpense() {
  const supabase = getBrowserClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateExpenseInput): Promise<void> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("update_expense", {
        p_expense_id: input.expenseId,
        p_expense_date: input.expenseDate,
        p_title: input.title,
        p_amount: input.amount,
        p_currency: input.currency,
        p_category_code: input.categoryCode,
        p_paid_by: input.paidBy ?? null,
        p_schedule_item_id: input.scheduleItemId ?? null,
        p_memo: input.memo ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.expenses.byTripId(vars.tripId) });
    },
  });
}
