"use client";

import { useQuery } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import type { Database } from "@/types/database";

export type MyProfile = Database["public"]["Tables"]["profiles"]["Row"];
export type PublicProfile = Database["public"]["Views"]["profiles_public"]["Row"];

export function useMyProfile() {
  const supabase = getBrowserClient();
  return useQuery({
    queryKey: queryKeys.profile.me,
    queryFn: async (): Promise<MyProfile | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, color, created_at")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data as MyProfile;
    },
  });
}

export function useProfileById(id: string | null | undefined) {
  const supabase = getBrowserClient();
  return useQuery({
    queryKey: queryKeys.profile.byId(id ?? "__none__"),
    enabled: !!id,
    queryFn: async (): Promise<PublicProfile | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("profiles_public")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
