import type { Profile } from "@/lib/types";

export const PROFILE_ME_ID = "prof_me";
export const PROFILE_PARTNER_ID = "prof_partner";

export const profiles: Profile[] = [
  {
    id: PROFILE_ME_ID,
    email: "yeoul@example.com",
    displayName: "여울",
    avatarUrl: undefined,
    createdAt: "2025-10-12T09:30:00Z",
  },
  {
    id: PROFILE_PARTNER_ID,
    email: "minji@example.com",
    displayName: "민지",
    avatarUrl: undefined,
    createdAt: "2025-11-04T14:12:00Z",
  },
];

export const currentUserId = PROFILE_ME_ID;
