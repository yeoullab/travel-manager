import type { Database } from "@/types/database";

type TripRow = Database["public"]["Tables"]["trips"]["Row"];

export type TripStatus = "ongoing" | "upcoming" | "past";

export function getTripStatus(trip: TripRow, today = new Date()): TripStatus {
  const todayStr = today.toISOString().split("T")[0];
  if (trip.end_date < todayStr) return "past";
  if (trip.start_date > todayStr) return "upcoming";
  return "ongoing";
}

export function groupTripsByStatus(trips: TripRow[], today = new Date()) {
  const ongoing: TripRow[] = [];
  const upcoming: TripRow[] = [];
  const past: TripRow[] = [];
  for (const t of trips) {
    const s = getTripStatus(t, today);
    if (s === "ongoing") ongoing.push(t);
    else if (s === "upcoming") upcoming.push(t);
    else past.push(t);
  }
  return { ongoing, upcoming, past };
}
