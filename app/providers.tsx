"use client";

import type { ReactNode } from "react";
import { QueryProvider } from "@/lib/query/provider";

export function Providers({ children }: { children: ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
