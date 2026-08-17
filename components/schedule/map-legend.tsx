import { CATEGORY_MARKER_COLORS } from "@/lib/maps/marker-colors";
import type { ScheduleCategory } from "@/lib/types";

const CATEGORY_LABEL: Record<ScheduleCategory, string> = {
  transport: "교통",
  sightseeing: "관광",
  food: "식당",
  cafe: "카페",
  lodging: "숙소",
  shopping: "쇼핑",
  other: "기타",
};

// 스펙 §6 마커 색 순서와 동일하게 고정 정렬.
const ORDER: ScheduleCategory[] = [
  "transport",
  "sightseeing",
  "food",
  "cafe",
  "lodging",
  "shopping",
  "other",
];

/**
 * 지도 우상단 카테고리 범례. **현재 지도에 실제로 있는 카테고리만** 노출 (작게 유지).
 * pointer-events:none 이라 지도 조작을 가리지 않는다.
 */
export function MapLegend({ categories }: { categories: string[] }) {
  const present = ORDER.filter((c) => categories.includes(c));
  if (present.length === 0) return null;
  return (
    <div
      aria-label="카테고리 범례"
      className="border-border-primary bg-surface-100/90 pointer-events-none absolute top-2 right-2 z-10 flex flex-col gap-1 rounded-[8px] border px-2 py-1.5 shadow-sm backdrop-blur-sm"
    >
      {present.map((c) => (
        <span key={c} className="text-ink-700 flex items-center gap-1.5 text-[11px] leading-none">
          <span
            aria-hidden
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ background: CATEGORY_MARKER_COLORS[c].fill }}
          />
          {CATEGORY_LABEL[c]}
        </span>
      ))}
    </div>
  );
}
