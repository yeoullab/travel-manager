import type { Trip, TripDay } from "@/lib/types";
import { PROFILE_ME_ID } from "./profiles";
import { GROUP_ID } from "./groups";

export const TRIP_TOKYO_ID = "trip_tokyo";
export const TRIP_GANGNEUNG_ID = "trip_gangneung";
export const TRIP_OSAKA_ID = "trip_osaka";

/**
 * 3개 여행 — 진행중 / 다가오는 / 지난 한 건씩.
 * 오늘 기준(2026-04-17)에서 각각 체험 가능.
 */
export const trips: Trip[] = [
  {
    id: TRIP_TOKYO_ID,
    groupId: GROUP_ID,
    createdBy: PROFILE_ME_ID,
    title: "도쿄 3박 4일",
    destination: "도쿄, 일본",
    startDate: "2026-04-15",
    endDate: "2026-04-18",
    isDomestic: false,
    currencies: ["JPY", "KRW"],
    createdAt: "2026-03-20T14:00:00Z",
    updatedAt: "2026-04-15T08:00:00Z",
  },
  {
    id: TRIP_GANGNEUNG_ID,
    groupId: GROUP_ID,
    createdBy: PROFILE_ME_ID,
    title: "강릉 1박 2일",
    destination: "강릉, 대한민국",
    startDate: "2026-05-10",
    endDate: "2026-05-11",
    isDomestic: true,
    currencies: ["KRW"],
    createdAt: "2026-04-02T19:30:00Z",
    updatedAt: "2026-04-05T12:10:00Z",
  },
  {
    id: TRIP_OSAKA_ID,
    groupId: GROUP_ID,
    createdBy: PROFILE_ME_ID,
    title: "오사카 4박 5일",
    destination: "오사카, 일본",
    startDate: "2026-01-08",
    endDate: "2026-01-12",
    isDomestic: false,
    currencies: ["JPY", "KRW"],
    createdAt: "2025-12-15T11:00:00Z",
    updatedAt: "2026-01-13T10:30:00Z",
  },
];

export const tripDays: TripDay[] = [
  // Tokyo (4 days: 15-18)
  { id: "td_tokyo_1", tripId: TRIP_TOKYO_ID, dayNumber: 1, date: "2026-04-15" },
  { id: "td_tokyo_2", tripId: TRIP_TOKYO_ID, dayNumber: 2, date: "2026-04-16" },
  { id: "td_tokyo_3", tripId: TRIP_TOKYO_ID, dayNumber: 3, date: "2026-04-17" },
  { id: "td_tokyo_4", tripId: TRIP_TOKYO_ID, dayNumber: 4, date: "2026-04-18" },
  // Gangneung (2 days: 10-11 May)
  { id: "td_gn_1", tripId: TRIP_GANGNEUNG_ID, dayNumber: 1, date: "2026-05-10" },
  { id: "td_gn_2", tripId: TRIP_GANGNEUNG_ID, dayNumber: 2, date: "2026-05-11" },
  // Osaka (5 days: 08-12 Jan)
  { id: "td_osk_1", tripId: TRIP_OSAKA_ID, dayNumber: 1, date: "2026-01-08" },
  { id: "td_osk_2", tripId: TRIP_OSAKA_ID, dayNumber: 2, date: "2026-01-09" },
  { id: "td_osk_3", tripId: TRIP_OSAKA_ID, dayNumber: 3, date: "2026-01-10" },
  { id: "td_osk_4", tripId: TRIP_OSAKA_ID, dayNumber: 4, date: "2026-01-11" },
  { id: "td_osk_5", tripId: TRIP_OSAKA_ID, dayNumber: 5, date: "2026-01-12" },
];
