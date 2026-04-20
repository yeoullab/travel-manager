import type { ReactNode } from "react";

export const metadata = {
  referrer: "no-referrer" as const,
};

export default function InviteLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
