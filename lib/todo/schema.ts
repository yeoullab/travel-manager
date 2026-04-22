import { z } from "zod";

export const todoTitleSchema = z.string().trim().min(1, "제목을 입력해주세요").max(100);

export const todoMemoSchema = z
  .string()
  .max(1000, "메모는 1000자 이하")
  .transform((v) => (v.trim() === "" ? null : v))
  .nullable();
