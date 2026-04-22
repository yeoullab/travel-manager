import { z } from "zod";

export const recordTitleSchema = z.string().trim().min(1, "제목을 입력해주세요").max(100);

export const recordContentSchema = z
  .string()
  .trim()
  .min(1, "내용을 입력해주세요")
  .max(20000, "내용은 20,000자 이하");

export function buildRecordDateSchema(start: string, end: string) {
  return z
    .string()
    .min(1, "날짜를 선택해주세요")
    .refine(
      (v) => v >= start && v <= end,
      `날짜는 ${start} ~ ${end} 사이여야 해요`,
    );
}
