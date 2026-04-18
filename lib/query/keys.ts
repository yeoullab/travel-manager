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
    detail: (id: string) => ["trips", id] as const,
  },
} as const;
