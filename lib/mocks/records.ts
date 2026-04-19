import type { TripRecord } from "@/lib/types";
// Inlined legacy trip IDs (previously imported from ./trips, removed in Task 9).
const TRIP_TOKYO_ID = "trip_tokyo";
const TRIP_OSAKA_ID = "trip_osaka";

const TS = "2026-04-16T22:00:00Z";

/**
 * 텍스트 기록 총 3건. 도쿄 1 + 오사카 2.
 */
export const records: TripRecord[] = [
  {
    id: "rec_tk_1",
    tripId: TRIP_TOKYO_ID,
    title: "첫날 후기",
    content:
      "비행기에서 내리자마자 하네다의 분위기가 달랐다. 호텔까지 가는 길에 본 거리 풍경이 아직도 눈에 선하다. 저녁의 도리키조쿠는 기대 이상이었음.",
    date: "2026-04-15",
    createdAt: TS,
    updatedAt: TS,
  },
  {
    id: "rec_os_1",
    tripId: TRIP_OSAKA_ID,
    title: "오사카성 감상",
    content:
      "생각보다 규모가 크고 전시실이 알찼다. 꼭대기 전망대에서 본 오사카 시내가 인상적이었다.",
    date: "2026-01-09",
    createdAt: "2026-01-09T20:00:00Z",
    updatedAt: "2026-01-09T20:00:00Z",
  },
  {
    id: "rec_os_2",
    tripId: TRIP_OSAKA_ID,
    title: "교토 후시미 이나리",
    content:
      "센본 토리이 전체를 돌진 못했지만 반쯤 올라가서 본 전망이 좋았다. 다음엔 이른 아침에 다시 오고 싶다.",
    date: "2026-01-10",
    createdAt: "2026-01-10T19:30:00Z",
    updatedAt: "2026-01-10T19:30:00Z",
  },
];
