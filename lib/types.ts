/**
 * 도메인 타입 정의. DB 스키마(스펙 §5)를 TS로 매핑.
 * Phase 1에서 `supabase gen types`로 자동 생성된 타입으로 교체 예정.
 */

export type UUID = string;
export type ISODate = string; // "YYYY-MM-DD"
export type ISODateTime = string; // "YYYY-MM-DDTHH:mm:ssZ"

// ── Profiles / Groups ────────────────────────────────────────────────
export type Profile = {
  id: UUID;
  email: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: ISODateTime;
};

export type GroupStatus = "pending" | "active" | "dissolved";
export type MemberRole = "owner" | "member";

export type Group = {
  id: UUID;
  name: string;
  inviteCode: string;
  status: GroupStatus;
  maxMembers: number;
  createdBy: UUID;
  createdAt: ISODateTime;
};

export type GroupMember = {
  id: UUID;
  groupId: UUID;
  userId: UUID;
  role: MemberRole;
  joinedAt: ISODateTime;
};

// ── Trips ─────────────────────────────────────────────────────────────
export type Trip = {
  id: UUID;
  groupId: UUID | null;
  createdBy: UUID;
  title: string;
  destination: string;
  startDate: ISODate;
  endDate: ISODate;
  isDomestic: boolean;
  currencies: string[]; // ["JPY", "KRW"]
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type TripDay = {
  id: UUID;
  tripId: UUID;
  dayNumber: number;
  date: ISODate;
};

// ── Schedule / Expense / Todo / Record ────────────────────────────────
export type ScheduleCategory =
  | "transport"
  | "sightseeing"
  | "food"
  | "lodging"
  | "shopping"
  | "other";

export type ScheduleItem = {
  id: UUID;
  tripDayId: UUID;
  title: string;
  category: ScheduleCategory;
  time: string | null; // "HH:mm"
  order: number;
  placeName: string | null;
  placeAddress: string | null;
  placeLat: number | null;
  placeLng: number | null;
  mapProvider: "google" | "naver" | null;
  memo: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type ExpenseCategory =
  | "food"
  | "transport"
  | "lodging"
  | "shopping"
  | "activity"
  | "other";

export type Expense = {
  id: UUID;
  tripId: UUID;
  expenseDate: ISODate; // 독립 필드 (ADR-004)
  title: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  paidBy: UUID | null;
  memo: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type Todo = {
  id: UUID;
  tripId: UUID;
  title: string;
  memo: string | null;
  isCompleted: boolean;
  assignedTo: UUID | null;
  createdAt: ISODateTime;
};

export type TripRecord = {
  id: UUID;
  tripId: UUID;
  title: string;
  content: string;
  date: ISODate;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

// ── Guest share ───────────────────────────────────────────────────────
export type GuestShare = {
  id: UUID;
  tripId: UUID;
  token: string;
  showSchedule: boolean;
  showExpenses: boolean;
  showTodos: boolean;
  showRecords: boolean;
  isActive: boolean;
  expiresAt: ISODateTime | null;
  createdAt: ISODateTime;
};

// ── Computed trip grouping (client-side) ─────────────────────────────
export type TripStatus = "ongoing" | "upcoming" | "past";
