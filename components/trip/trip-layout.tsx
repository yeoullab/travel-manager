"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Wallet,
  CheckSquare,
  FileText,
  Settings as SettingsIcon,
  Share2,
} from "lucide-react";
import { AppBar } from "@/components/ui/app-bar";
import { BottomTabBar, type BottomTab } from "@/components/ui/bottom-tab-bar";
import type { Trip } from "@/lib/types";

export type TripTabKey = "schedule" | "expenses" | "todos" | "records" | "manage";

const TAB_DEFS: { key: TripTabKey; label: string; icon: BottomTab["icon"] }[] = [
  { key: "schedule", label: "일정", icon: Calendar },
  { key: "expenses", label: "경비", icon: Wallet },
  { key: "todos", label: "할 일", icon: CheckSquare },
  { key: "records", label: "기록", icon: FileText },
  { key: "manage", label: "관리", icon: SettingsIcon },
];

type TripLayoutProps = {
  trip: Trip;
  activeTab: TripTabKey;
  children: ReactNode;
};

/**
 * /trips/[id] 공용 셸.
 * AppBar + 탭 콘텐츠 + 하단 BottomTabBar (5탭).
 * 탭 전환은 쿼리 파라미터(`?tab=schedule|expenses|...`)로 단순화.
 */
export function TripLayout({ trip, activeTab, children }: TripLayoutProps) {
  const router = useRouter();
  const tabs: BottomTab[] = TAB_DEFS.map((t) => ({
    key: t.key,
    label: t.label,
    icon: t.icon,
    onClick: () => router.push(`/trips/${trip.id}?tab=${t.key}`),
  }));

  return (
    <div className="flex min-h-dvh flex-col pb-20" style={{ minHeight: "100dvh" }}>
      <AppBar
        title={trip.title}
        onBack={() => router.push("/trips")}
        trailing={
          <button
            type="button"
            aria-label="여행 공유"
            onClick={() => router.push(`/trips/${trip.id}?tab=manage`)}
            className="text-ink-700 hover:text-error flex h-11 w-11 items-center justify-center rounded-full transition-colors"
          >
            <Share2 size={20} strokeWidth={1.75} />
          </button>
        }
      />
      <main className="flex-1">{children}</main>
      <BottomTabBar tabs={tabs} activeKey={activeTab} />
    </div>
  );
}
