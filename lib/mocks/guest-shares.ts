import type { GuestShare } from "@/lib/types";
// Inlined legacy trip ID (previously imported from ./trips, removed in Task 9).
const TRIP_TOKYO_ID = "trip_tokyo";

/**
 * 게스트 공유 — 도쿄 여행에만 활성 링크 1개.
 * 기록 탭은 숨김(프라이버시).
 */
export const guestShares: GuestShare[] = [
  {
    id: "gs_tk_1",
    tripId: TRIP_TOKYO_ID,
    token: "share_tokyo_demo_token",
    showSchedule: true,
    showExpenses: false,
    showTodos: false,
    showRecords: false,
    isActive: true,
    expiresAt: "2026-06-01T00:00:00Z",
    createdAt: "2026-04-10T10:00:00Z",
  },
];
