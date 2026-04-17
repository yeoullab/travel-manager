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
import { trips, tripDays } from "./trips";
import { scheduleItems } from "./schedule-items";
import { expenses } from "./expenses";
import { todos } from "./todos";
import { records } from "./records";
import { guestShares } from "./guest-shares";
import { profiles, currentUserId } from "./profiles";

/**
 * Mock 데이터 조회 헬퍼.
 * Phase 1에서 Supabase 쿼리로 교체 예정 — 같은 시그니처 유지.
 */

export function getTripById(id: string): Trip | undefined {
  return trips.find((t) => t.id === id);
}

export function getTripDaysByTripId(tripId: string): TripDay[] {
  return tripDays
    .filter((d) => d.tripId === tripId)
    .sort((a, b) => a.dayNumber - b.dayNumber);
}

export function getScheduleItemsByTripDayId(tripDayId: string): ScheduleItem[] {
  return scheduleItems
    .filter((s) => s.tripDayId === tripDayId)
    .sort((a, b) => a.order - b.order);
}

export function getScheduleItemsByTripId(tripId: string): ScheduleItem[] {
  const days = getTripDaysByTripId(tripId).map((d) => d.id);
  return scheduleItems.filter((s) => days.includes(s.tripDayId));
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

export function groupTripsByStatus(
  allTrips: Trip[] = trips,
  today: Date = new Date(),
): { ongoing: Trip[]; upcoming: Trip[]; past: Trip[] } {
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

// ── Expense aggregation ──────────────────────────────────────────────
export function aggregateExpensesByCurrency(tripId: string): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const e of getExpensesByTripId(tripId)) {
    totals[e.currency] = (totals[e.currency] ?? 0) + e.amount;
  }
  return totals;
}
