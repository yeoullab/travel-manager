"use client";

import type { ReactNode } from "react";
import { QueryProvider } from "@/lib/query/provider";
import { RealtimeGateway } from "@/components/realtime/realtime-gateway";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <RealtimeGateway />
      <ServiceWorkerRegistrar />
      {children}
    </QueryProvider>
  );
}
