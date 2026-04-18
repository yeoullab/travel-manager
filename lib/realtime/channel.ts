"use client";

import { getBrowserClient } from "@/lib/supabase/browser-client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SubscribeOptions<Row extends Record<string, any>> = {
  channel: string;
  table: string;
  filter?: string;
  onChange: (payload: RealtimePostgresChangesPayload<Row>) => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function subscribeToTable<Row extends Record<string, any>>({
  channel,
  table,
  filter,
  onChange,
}: SubscribeOptions<Row>) {
  const supabase = getBrowserClient();
  const ch = supabase
    .channel(channel)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table, filter },
      (payload) => onChange(payload as RealtimePostgresChangesPayload<Row>),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(ch);
  };
}
