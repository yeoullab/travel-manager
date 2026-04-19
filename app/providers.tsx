"use client";

import type { ReactNode } from "react";
import { QueryProvider } from "@/lib/query/provider";
import { RealtimeGateway } from "@/components/realtime/realtime-gateway";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <RealtimeGateway />
      {children}
    </QueryProvider>
  );
}
