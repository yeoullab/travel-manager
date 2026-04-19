"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  Luggage,
  Plus,
  Plane,
  MapPin,
  Settings as SettingsIcon,
  ChevronRight,
} from "lucide-react";
import { AppBar } from "@/components/ui/app-bar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader } from "@/components/ui/section-header";
import { Fab } from "@/components/ui/fab";
import { useTripsList } from "@/lib/trip/use-trips-list";
import { groupTripsByStatus, type TripStatus } from "@/lib/trip/trip-grouping";
import type { TripRow } from "@/lib/trip/use-trips-list";
import { cn } from "@/lib/cn";

export default function TripsPage() {
  return (
    <Suspense fallback={<TripsFallback />}>
      <TripsPageInner />
    </Suspense>
  );
}

function TripsPageInner() {
  const router = useRouter();
  const { data: trips, isLoading } = useTripsList();
  const grouped = groupTripsByStatus(trips ?? []);
  const showEmpty =
    !isLoading &&
    grouped.ongoing.length === 0 &&
    grouped.upcoming.length === 0 &&
    grouped.past.length === 0;

  return (
    <div className="flex min-h-dvh flex-col pb-24" style={{ minHeight: "100dvh" }}>
      <AppBar
        title="여행"
        trailing={
          <Link
            href="/settings"
            aria-label="설정"
            className="text-ink-700 hover:text-error flex h-11 w-11 items-center justify-center rounded-full transition-colors"
          >
            <SettingsIcon size={20} strokeWidth={1.75} />
          </Link>
        }
      />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-2">
        {isLoading ? (
          <TripListSkeleton />
        ) : showEmpty ? (
          <EmptyState
            className="mt-12"
            icon={<Luggage size={48} strokeWidth={1.5} />}
            title="아직 여행이 없어요"
            description="첫 여행을 만들어 파트너와 함께 계획해보세요."
            cta={
              <Link href="/trips/new">
                <Button variant="primary" size="md">
                  <Plus size={18} strokeWidth={2} />새 여행 만들기
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="pb-10">
            {grouped.ongoing.length > 0 && (
              <TripGroup label="진행 중" status="ongoing" trips={grouped.ongoing} />
            )}
            {grouped.upcoming.length > 0 && (
              <TripGroup label="다가오는 여행" status="upcoming" trips={grouped.upcoming} />
            )}
            {grouped.past.length > 0 && (
              <TripGroup label="지난 여행" status="past" trips={grouped.past} />
            )}
          </div>
        )}
      </main>
      {!showEmpty && (
        <Fab aria-label="새 여행 만들기" onClick={() => router.push("/trips/new")} />
      )}
    </div>
  );
}

function TripGroup({
  label,
  status,
  trips,
}: {
  label: string;
  status: TripStatus;
  trips: TripRow[];
}) {
  return (
    <div>
      <SectionHeader>{label}</SectionHeader>
      <ul className="flex flex-col gap-3">
        {trips.map((trip) => (
          <li key={trip.id}>
            <TripCard trip={trip} status={status} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function TripCard({ trip, status }: { trip: TripRow; status: TripStatus }) {
  return (
    <Link
      href={`/trips/${trip.id}`}
      className={cn(
        "bg-surface-100 border-border-primary flex items-stretch gap-4 overflow-hidden rounded-[12px] border p-4",
        "transition-shadow duration-200 active:scale-[0.99]",
        "hover:shadow-[0_0_16px_rgba(0,0,0,0.04)]",
      )}
    >
      <div
        aria-hidden
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px]",
          status === "ongoing" && "bg-accent-orange/10 text-accent-orange",
          status === "upcoming" && "bg-ti-read/40 text-ink-800",
          status === "past" && "bg-surface-400 text-ink-600",
        )}
      >
        {trip.is_domestic ? (
          <MapPin size={22} strokeWidth={1.75} />
        ) : (
          <Plane size={22} strokeWidth={1.75} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-ink-900 mt-1 truncate text-[18px] font-semibold tracking-[-0.005em]">
          {trip.title}
        </h3>
        <p className="text-ink-700 mt-0.5 truncate text-[13px]">
          {trip.destination} · {formatRange(trip.start_date, trip.end_date)}
        </p>
      </div>
      <div className="text-ink-500 flex items-center">
        <ChevronRight size={18} />
      </div>
    </Link>
  );
}

function TripsFallback() {
  return (
    <div className="flex min-h-dvh flex-col" style={{ minHeight: "100dvh" }}>
      <AppBar title="여행" />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-2">
        <TripListSkeleton />
      </main>
    </div>
  );
}

function TripListSkeleton() {
  return (
    <div className="space-y-3 pt-2">
      <Skeleton variant="text" className="mt-6 w-[80px]" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="bg-surface-100 border-border-primary flex items-center gap-4 rounded-[12px] border p-4"
        >
          <Skeleton variant="rect" className="h-12 w-12 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" className="w-[70%]" />
            <Skeleton variant="text" className="w-[50%]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function formatRange(start: string, end: string): string {
  const [ys, ms, ds] = start.split("-");
  const [ye, me, de] = end.split("-");
  if (ys === ye && ms === me) return `${Number(ms)}월 ${Number(ds)}일 - ${Number(de)}일`;
  if (ys === ye) return `${Number(ms)}월 ${Number(ds)}일 - ${Number(me)}월 ${Number(de)}일`;
  return `${ys}. ${Number(ms)}. ${Number(ds)}. - ${ye}. ${Number(me)}. ${Number(de)}.`;
}
