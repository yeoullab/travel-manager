import type { Group, GroupMember } from "@/lib/types";
import { PROFILE_ME_ID, PROFILE_PARTNER_ID } from "./profiles";

export const GROUP_ID = "grp_main";

export const groups: Group[] = [
  {
    id: GROUP_ID,
    name: "여울&민지",
    inviteCode: "INVITE-DEMO-CODE",
    status: "active",
    maxMembers: 2,
    createdBy: PROFILE_ME_ID,
    createdAt: "2025-12-01T10:00:00Z",
  },
];

export const groupMembers: GroupMember[] = [
  {
    id: "gm_me",
    groupId: GROUP_ID,
    userId: PROFILE_ME_ID,
    role: "owner",
    joinedAt: "2025-12-01T10:00:00Z",
  },
  {
    id: "gm_partner",
    groupId: GROUP_ID,
    userId: PROFILE_PARTNER_ID,
    role: "member",
    joinedAt: "2025-12-01T11:20:00Z",
  },
];
