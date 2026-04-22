export const queryKeys = {
  profile: {
    me: ["profile", "me"] as const,
    byId: (id: string) => ["profile", "byId", id] as const,
  },
  tripMembers: {
    byTripId: (tripId: string) => ["tripMembers", tripId] as const,
  },
  trips: {
    all: ["trips"] as const,
    list: ["trips", "list"] as const,
    detail: (id: string) => ["trips", "detail", id] as const,
  },
  group: {
    me: ["group", "me"] as const,
  },
  tripDays: {
    byTripId: (tripId: string) => ["tripDays", tripId] as const,
  },
  schedule: {
    byTripId: (tripId: string) => ["schedule", tripId] as const,
  },
  // ── Phase 4 additions ──
  expenses: {
    byTripId: (tripId: string) => ["expenses", tripId] as const,
  },
  todos: {
    byTripId: (tripId: string) => ["todos", tripId] as const,
  },
  records: {
    byTripId: (tripId: string) => ["records", tripId] as const,
  },
  guest: {
    byTripId: (tripId: string) => ["guest", "byTripId", tripId] as const,
  },
} as const;
