"use client";

import Link from "next/link";
import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { AppBar } from "@/components/ui/app-bar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { TripLayout, type TripTabKey } from "@/components/trip/trip-layout";
import { ScheduleTab } from "@/components/trip/schedule-tab";
import { ExpensesTab } from "@/components/trip/expenses-tab";
import { TodosTab } from "@/components/trip/todos-tab";
import { RecordsTab } from "@/components/trip/records-tab";
import { ManageTab } from "@/components/trip/manage-tab";
import { useSimulatedLoad } from "@/lib/use-simulated-load";
import { getTripById } from "@/lib/mocks";

const VALID_TABS: TripTabKey[] = ["schedule", "expenses", "todos", "records", "manage"];

/**
 * 06~11 `/trips/[id]` — 여행 상세 (5탭 디스패처).
 * `?tab=` 쿼리로 schedule/expenses/todos/records/manage 전환.
 * 기본 탭은 schedule.
 */
export default function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<TripDetailFallback />}>
      <TripDetailInner id={id} />
    </Suspense>
  );
}

function TripDetailInner({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: TripTabKey =
    tabParam && (VALID_TABS as string[]).includes(tabParam) ? (tabParam as TripTabKey) : "schedule";
  const loaded = useSimulatedLoad(500);
  const trip = getTripById(id);

  if (!trip) {
    return <TripNotFound />;
  }

  if (!loaded) {
    return (
      <TripLayout trip={trip} activeTab={tab}>
        <div className="space-y-3 px-4 pt-5">
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="rect" className="h-12 w-16 shrink-0" />
            ))}
          </div>
          <Skeleton variant="text" className="mt-4 w-[30%]" />
          <Skeleton variant="rect" className="h-20 w-full" />
          <Skeleton variant="rect" className="h-20 w-full" />
          <Skeleton variant="rect" className="h-20 w-full" />
        </div>
      </TripLayout>
    );
  }

  return (
    <TripLayout trip={trip} activeTab={tab}>
      {tab === "schedule" && <ScheduleTab tripId={id} />}
      {tab === "expenses" && <ExpensesTab tripId={id} />}
      {tab === "todos" && <TodosTab tripId={id} />}
      {tab === "records" && <RecordsTab tripId={id} />}
      {tab === "manage" && <ManageTab tripId={id} />}
    </TripLayout>
  );
}

function TripNotFound() {
  return (
    <div className="flex min-h-dvh flex-col" style={{ minHeight: "100dvh" }}>
      <AppBar title="여행을 찾을 수 없음" />
      <main className="flex-1">
        <EmptyState
          className="py-20"
          icon={<AlertCircle size={48} strokeWidth={1.5} />}
          title="존재하지 않는 여행이에요"
          description="삭제되었거나 접근 권한이 없는 여행일 수 있어요."
          cta={
            <Link href="/trips">
              <Button variant="primary">여행 목록으로</Button>
            </Link>
          }
        />
      </main>
    </div>
  );
}

function TripDetailFallback() {
  return (
    <div className="flex min-h-dvh flex-col" style={{ minHeight: "100dvh" }}>
      <AppBar />
    </div>
  );
}
