if (process.env.NODE_ENV === "production") {
  throw new Error("lib/mocks/factory must not be imported in production builds");
}

import type { Database } from "@/types/database";

// Re-export type so the DB row shape stays locally anchored for future factory growth.
export type TripRow = Database["public"]["Tables"]["trips"]["Row"];

export type MockFactoryInput = {
  userId: string;
  tripId: string;
};

export function makeScheduleItemsMock(_input: MockFactoryInput) {
  return [] as unknown[];
}

export function makeExpensesMock(_input: MockFactoryInput) {
  return [] as unknown[];
}

export function makeTodosMock(_input: MockFactoryInput) {
  return [] as unknown[];
}

export function makeRecordsMock(_input: MockFactoryInput) {
  return [] as unknown[];
}
