import { z } from "zod";

// Spec §2.2 URL 제약: http/https 만 허용, javascript:/data:/file: 거부
export const scheduleItemUrlSchema = z
  .string()
  .trim()
  .max(500, "URL 은 500자 이하여야 해요")
  .refine(
    (v) => v === "" || /^https?:\/\//i.test(v),
    "http:// 또는 https:// 로 시작해야 해요",
  )
  .transform((v) => (v === "" ? null : v));

export const scheduleItemTitleSchema = z.string().trim().min(1).max(100);
