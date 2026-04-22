import { z } from "zod";
import { EXPENSE_CATEGORIES } from "./constants";

export const expenseTitleSchema = z.string().trim().min(1, "제목을 입력해주세요").max(100);

export const expenseAmountSchema = z
  .coerce.number()
  .finite("숫자를 입력해주세요")
  .min(0, "금액은 0 이상이어야 해요")
  .max(9_999_999_999.99, "금액이 너무 커요");

export const expenseCurrencySchema = z
  .string()
  .trim()
  .length(3)
  .regex(/^[A-Z]+$/, "통화 코드는 대문자 3자리");

export const expenseCategorySchema = z.enum(
  EXPENSE_CATEGORIES.map((c) => c.code) as [string, ...string[]],
);

export const expenseMemoSchema = z
  .string()
  .max(1000, "메모는 1000자 이하")
  .transform((v) => (v.trim() === "" ? null : v))
  .nullable();
