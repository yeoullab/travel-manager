import type { ScheduleCategory } from "@/lib/types";

export type MarkerTextTone = "light" | "dark";

/**
 * 카테고리 → 지도 마커 색 단일 소스 (스펙 §6).
 * globals.css 토큰과 hex 를 일치시킬 것: brown/rose/yellow 는 0023 에서 신설.
 * text: 배경 명도 기반 — 밝은 배경은 dark(잉크), 어두운 배경은 light(크림).
 */
export const CATEGORY_MARKER_COLORS: Record<
  ScheduleCategory,
  { fill: string; text: MarkerTextTone }
> = {
  transport: { fill: "#9fbbe0", text: "dark" },
  sightseeing: { fill: "#9fc9a2", text: "dark" },
  food: { fill: "#a5673f", text: "light" },
  cafe: { fill: "#e08cab", text: "dark" },
  lodging: { fill: "#c0a8dd", text: "dark" },
  shopping: { fill: "#e0b64f", text: "dark" },
  other: { fill: "rgba(38,37,30,0.2)", text: "dark" },
};

const MARKER_TEXT_COLOR: Record<MarkerTextTone, string> = {
  light: "#f2f1ed", // cream
  dark: "#26251e", // ink-900
};

export function markerColorsFor(
  category: ScheduleCategory | string | null | undefined,
): { fill: string; textColor: string } {
  const entry =
    CATEGORY_MARKER_COLORS[(category ?? "other") as ScheduleCategory] ??
    CATEGORY_MARKER_COLORS.other;
  return { fill: entry.fill, textColor: MARKER_TEXT_COLOR[entry.text] };
}
