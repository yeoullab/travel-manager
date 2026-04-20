"use client";

import { useQuery } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import type { Database } from "@/types/database";

type GroupRow = Database["public"]["Tables"]["groups"]["Row"];
type GroupMemberRow = Database["public"]["Tables"]["group_members"]["Row"];
type PublicProfile = Database["public"]["Views"]["profiles_public"]["Row"];

export type MyGroupData = {
  group: GroupRow;
  members: Array<GroupMemberRow & { profile: PublicProfile | null }>;
  inviteCode?: string; // groups_with_invite 로만 노출
} | null;

export function useMyGroup() {
  const supabase = getBrowserClient();
  return useQuery({
    queryKey: queryKeys.group.me,
    queryFn: async (): Promise<MyGroupData> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      // 본인이 속한 active 또는 pending 그룹.
      // `groups!inner` 로 inner join 하여 dissolved/cancelled 그룹의 group_members
      // 잔존 row 가 함께 딸려오는 현상(groups=null) 을 차단한다.
      const { data: memberRows } = await supabase
        .from("group_members")
        .select("*, groups!inner(*)")
        .eq("user_id", user.id)
        .in("groups.status", ["pending", "active"])
        .order("joined_at", { ascending: false })
        .limit(1);

      const memberRow = memberRows?.[0];
      if (!memberRow) return null;
      const group = (memberRow as { groups: GroupRow }).groups;
      if (!group) return null;

      // 오너이면 invite_code 도 조회
      let inviteCode: string | undefined;
      if (group.status === "pending") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: viewRow } = await (supabase as any)
          .from("groups_with_invite")
          .select("invite_code")
          .eq("id", group.id)
          .maybeSingle();
        inviteCode = viewRow?.invite_code ?? undefined;
      }

      // 멤버 프로필
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: allMembers } = await (supabase as any)
        .from("group_members")
        .select("*, profiles_public(*)")
        .eq("group_id", group.id);

      const members = (
        (allMembers ?? []) as Array<GroupMemberRow & { profiles_public: PublicProfile | null }>
      ).map((m) => ({
        ...m,
        profile: m.profiles_public,
      }));

      return { group, members, inviteCode };
    },
  });
}
