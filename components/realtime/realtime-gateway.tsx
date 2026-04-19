"use client";

import { useMyProfile } from "@/lib/profile/use-profile";
import { useRealtimeGateway } from "@/lib/realtime/use-realtime-gateway";

export function RealtimeGateway() {
  const { data: profile } = useMyProfile();
  useRealtimeGateway(profile?.id);
  return null;
}
