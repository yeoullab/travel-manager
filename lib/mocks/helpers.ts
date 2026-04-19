import type {
  Trip,
  TripDay,
  TripStatus,
  ScheduleItem,
  Expense,
  Todo,
  TripRecord,
  GuestShare,
  Profile,
} from "@/lib/types";
import { scheduleItems } from "./schedule-items";
import { expenses } from "./expenses";
import { todos } from "./todos";
import { records } from "./records";
import { guestShares } from "./guest-shares";
import { profiles, currentUserId } from "./profiles";

/**
 * Mock 데이터 조회 헬퍼.
 * Phase 2 Task 9에서 trips/groups mock 데이터는 삭제됨.
 * 남은 헬퍼는 Phase 3에서 Supabase 쿼리로 교체 예정 — 같은 시그니처 유지.
 */

// ── Phase 2 Task 9 deprecated placeholders ──────────────────────────
// trips/groups mock 데이터는 Task 9에서 삭제되었으나, 다음 호출부가
// Phase 3 (Task 11~14)에서 재작성되기 전까지 import를 유지해야 빌드가
// 깨지지 않아 빈 결과를 돌려주는 스텁을 남겨둔다. 해당 Task에서 이 스텁도
// 완전히 제거된다.

const warned = new Set<string>();
function devWarn(name: string) {
  if (process.env.NODE_ENV !== "production" && !warned.has(name)) {
    warned.add(name);
    // eslint-disable-next-line no-console
    console.warn(
      `[mocks] ${name} is a deprecated Phase 2 placeholder returning empty data; migrate call sites to real-DB hooks.`,
    );
  }
}

/** @deprecated Phase 2 placeholder — removed by Task 11/12. */
export function getTripById(_id: string): Trip | undefined {
  devWarn("getTripById");
  return undefined;
}

/** @deprecated Phase 2 placeholder — removed by Task 11/12. */
export function getTripDaysByTripId(_tripId: string): TripDay[] {
  devWarn("getTripDaysByTripId");
  return [];
}

/** @deprecated Phase 2 placeholder — removed by Task 11/12. */
export function getScheduleItemsByTripId(_tripId: string): ScheduleItem[] {
  devWarn("getScheduleItemsByTripId");
  return [];
}

/** @deprecated Phase 2 placeholder — use groupTripsByStatus from @/lib/trip/trip-grouping (Task 11). */
export function groupTripsByStatus(
  allTrips: Trip[] = [],
  today: Date = new Date(),
): { ongoing: Trip[]; upcoming: Trip[]; past: Trip[] } {
  devWarn("groupTripsByStatus");
  const result = { ongoing: [] as Trip[], upcoming: [] as Trip[], past: [] as Trip[] };
  for (const trip of allTrips) {
    const status = computeTripStatus(trip, today);
    result[status].push(trip);
  }
  result.ongoing.sort((a, b) => a.endDate.localeCompare(b.endDate));
  result.upcoming.sort((a, b) => a.startDate.localeCompare(b.startDate));
  result.past.sort((a, b) => b.endDate.localeCompare(a.endDate));
  return result;
}

// ── Active helpers ──────────────────────────────────────────────────

export function getScheduleItemsByTripDayId(tripDayId: string): ScheduleItem[] {
  return scheduleItems
    .filter((s) => s.tripDayId === tripDayId)
    .sort((a, b) => a.order - b.order);
}

export function getExpensesByTripId(tripId: string): Expense[] {
  return expenses
    .filter((e) => e.tripId === tripId)
    .sort((a, b) => a.expenseDate.localeCompare(b.expenseDate));
}

export function getTodosByTripId(tripId: string): Todo[] {
  return todos
    .filter((t) => t.tripId === tripId)
    .sort((a, b) => {
      // incomplete first, then by createdAt
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      return a.createdAt.localeCompare(b.createdAt);
    });
}

export function getRecordsByTripId(tripId: string): TripRecord[] {
  return records
    .filter((r) => r.tripId === tripId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getGuestShareByTripId(tripId: string): GuestShare | undefined {
  return guestShares.find((g) => g.tripId === tripId && g.isActive);
}

export function getGuestShareByToken(token: string): GuestShare | undefined {
  return guestShares.find(
    (g) =>
      g.token === token &&
      g.isActive &&
      (!g.expiresAt || new Date(g.expiresAt) > new Date()),
  );
}

export function getProfileById(id: string): Profile | undefined {
  return profiles.find((p) => p.id === id);
}

export function getProfileName(id: string | null | undefined): string {
  if (!id) return "";
  const p = getProfileById(id);
  if (!p) return "";
  return p.id === currentUserId ? "나" : p.displayName;
}

// ── Computed trip grouping ───────────────────────────────────────────
export function computeTripStatus(trip: Trip, today: Date = new Date()): TripStatus {
  const t = today.toISOString().slice(0, 10);
  if (trip.startDate <= t && t <= trip.endDate) return "ongoing";
  if (trip.startDate > t) return "upcoming";
  return "past";
}

// ── Expense aggregation ──────────────────────────────────────────────
export function aggregateExpensesByCurrency(tripId: string): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const e of getExpensesByTripId(tripId)) {
    totals[e.currency] = (totals[e.currency] ?? 0) + e.amount;
  }
  return totals;
}
