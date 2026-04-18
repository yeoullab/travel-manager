import type { ProfileColor } from "@/lib/profile/color-schema";

export type ChipClass = { bg: string; text: string };

export const CHIP_TONE_BY_COLOR: Record<ProfileColor, ChipClass> = {
  orange: { bg: "bg-accent-orange", text: "text-cream" },
  blue: { bg: "bg-ti-read", text: "text-ink-900" },
  gold: { bg: "bg-accent-gold", text: "text-cream" },
  violet: { bg: "bg-ti-edit", text: "text-ink-900" },
  green: { bg: "bg-ti-grep", text: "text-ink-900" },
  rose: { bg: "bg-ti-thinking", text: "text-ink-900" },
};

const NEUTRAL: ChipClass = { bg: "bg-surface-400", text: "text-ink-700" };

export function chipClassForColor(color: ProfileColor | null | undefined): ChipClass {
  if (!color) return NEUTRAL;
  return CHIP_TONE_BY_COLOR[color];
}
