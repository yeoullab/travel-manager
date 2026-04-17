"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { useSimulatedLoad } from "@/lib/use-simulated-load";
import {
  groupTripsByStatus,
  getTripDaysByTripId,
  getExpensesByTripId,
  getScheduleItemsByTripId,
} from "@/lib/mocks";
import type { Trip, TripStatus } from "@/lib/types";
import { cn } from "@/lib/cn";

/**
 * 03·04 `/trips` — 여행 목록 (empty + filled).
 *
 * `?empty=1` 쿼리로 빈 상태 미리보기 전환.
 * 진행중 / 다가오는 / 지난으로 그루핑.
 * md: 에서는 2-column (리스트 + 하이라이트 요약).
 */
export default function TripsPage() {
  return (
    <Suspense fallback={<TripsFallback />}>
      <TripsPageInner />
    </Suspense>
  );
}

function TripsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEmptyPreview = searchParams.get("empty") === "1";
  const loaded = useSimulatedLoad(500);

  const grouped = useMemo(() => groupTripsByStatus(), []);
  const showEmpty =
    isEmptyPreview ||
    (grouped.ongoing.length === 0 &&
      grouped.upcoming.length === 0 &&
      grouped.past.length === 0);

  const highlight =
    grouped.ongoing[0] ?? grouped.upcoming[0] ?? grouped.past[0] ?? null;

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

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-2 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] md:gap-8 md:px-8">
        <section className="min-w-0">
          {!loaded ? (
            <TripListSkeleton />
          ) : showEmpty ? (
            <TripsEmpty />
          ) : (
            <TripsFilled grouped={grouped} />
          )}

          <PreviewToggle isEmptyPreview={isEmptyPreview} />
        </section>

        {/* Desktop hilight panel */}
        <aside className="hidden md:block">
          {loaded && !showEmpty && highlight ? (
            <HighlightPanel trip={highlight} />
          ) : (
            <DesktopPlaceholder />
          )}
        </aside>
      </main>

      {!showEmpty && (
        <Fab aria-label="새 여행 만들기" onClick={() => router.push("/trips/new")} />
      )}
    </div>
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

function TripsEmpty() {
  return (
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
  );
}

type Grouped = ReturnType<typeof groupTripsByStatus>;

function TripsFilled({ grouped }: { grouped: Grouped }) {
  return (
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
  );
}

function TripGroup({
  label,
  status,
  trips,
}: {
  label: string;
  status: TripStatus;
  trips: Trip[];
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

function TripCard({ trip, status }: { trip: Trip; status: TripStatus }) {
  const dayCount = getTripDaysByTripId(trip.id).length;
  return (
    <Link
      href={`/trips/${trip.id}`}
      className={cn(
        "bg-surface-100 border-border-primary flex items-stretch gap-4 overflow-hidden rounded-[12px] border p-4",
        "transition-shadow duration-200 active:scale-[0.99]",
        "hover:shadow-[0_0_16px_rgba(0,0,0,0.04),0_0_8px_rgba(0,0,0,0.02)]",
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
        {trip.isDomestic ? (
          <MapPin size={22} strokeWidth={1.75} />
        ) : (
          <Plane size={22} strokeWidth={1.75} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <StatusPill status={status} />
          <span className="text-ink-600 text-[12px]">
            {dayCount}일 일정
          </span>
        </div>
        <h3 className="text-ink-900 mt-1 truncate text-[18px] font-semibold tracking-[-0.005em]">
          {trip.title}
        </h3>
        <p className="text-ink-700 mt-0.5 truncate text-[13px]">
          {trip.destination} · {formatRange(trip.startDate, trip.endDate)}
        </p>
      </div>

      <div className="text-ink-500 flex items-center">
        <ChevronRight size={18} />
      </div>
    </Link>
  );
}

function StatusPill({ status }: { status: TripStatus }) {
  const label =
    status === "ongoing" ? "진행 중" : status === "upcoming" ? "다가오는" : "지난";
  const cls =
    status === "ongoing"
      ? "bg-accent-orange text-cream"
      : status === "upcoming"
        ? "bg-ti-read text-ink-900"
        : "bg-surface-400 text-ink-700";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        cls,
      )}
    >
      {label}
    </span>
  );
}

function HighlightPanel({ trip }: { trip: Trip }) {
  const scheduleCount = getScheduleItemsByTripId(trip.id).length;
  const expenseCount = getExpensesByTripId(trip.id).length;
  const dayCount = getTripDaysByTripId(trip.id).length;
  return (
    <div className="bg-surface-100 border-border-primary sticky top-20 mt-8 rounded-[16px] border p-6">
      <p className="text-ink-600 text-[11px] font-medium tracking-[0.15em] uppercase">
        Highlight
      </p>
      <h2 className="text-ink-900 mt-2 text-[26px] font-semibold tracking-[-0.01em]">
        {trip.title}
      </h2>
      <p className="text-ink-700 mt-1 text-[14px]">
        {trip.destination} · {formatRange(trip.startDate, trip.endDate)}
      </p>

      <dl className="mt-6 grid grid-cols-3 gap-3">
        <HighlightStat label="일정" value={dayCount} suffix="일" />
        <HighlightStat label="항목" value={scheduleCount} suffix="건" />
        <HighlightStat label="경비" value={expenseCount} suffix="건" />
      </dl>

      <Link href={`/trips/${trip.id}`} className="mt-6 block">
        <Button variant="primary" fullWidth>
          상세 보기
        </Button>
      </Link>
    </div>
  );
}

function HighlightStat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix: string;
}) {
  return (
    <div className="bg-surface-200 border-border-primary rounded-[10px] border p-3 text-center">
      <p className="text-ink-600 text-[11px] tracking-wider uppercase">{label}</p>
      <p className="text-ink-900 mt-1 font-mono text-[20px] font-semibold">
        {value}
        <span className="text-ink-600 ml-0.5 text-[12px] font-normal">{suffix}</span>
      </p>
    </div>
  );
}

function DesktopPlaceholder() {
  return (
    <div className="bg-surface-100 border-border-primary mt-8 flex h-[320px] items-center justify-center rounded-[16px] border">
      <p className="text-ink-500 text-[13px]">여행을 선택하면 요약이 보입니다</p>
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
            <Skeleton variant="line" className="w-[40%]" />
            <Skeleton variant="text" className="w-[70%]" />
            <Skeleton variant="text" className="w-[50%]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PreviewToggle({ isEmptyPreview }: { isEmptyPreview: boolean }) {
  const next = isEmptyPreview ? "/trips" : "/trips?empty=1";
  const label = isEmptyPreview
    ? "데이터 있는 상태 보기"
    : "빈 상태 미리보기";
  return (
    <div className="border-border-primary mt-10 border-t pt-4">
      <p className="text-ink-500 text-[11px] tracking-wider uppercase">mockup preview</p>
      <Link
        href={next}
        className="text-ink-700 hover:text-error mt-1 inline-block text-[13px] underline-offset-2 hover:underline"
      >
        → {label}
      </Link>
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────
function formatRange(start: string, end: string): string {
  const [ys, ms, ds] = start.split("-");
  const [ye, me, de] = end.split("-");
  const sameYear = ys === ye;
  const sameMonth = sameYear && ms === me;
  if (sameMonth) return `${Number(ms)}월 ${Number(ds)}일 - ${Number(de)}일`;
  if (sameYear) return `${Number(ms)}월 ${Number(ds)}일 - ${Number(me)}월 ${Number(de)}일`;
  return `${ys}. ${Number(ms)}. ${Number(ds)}. - ${ye}. ${Number(me)}. ${Number(de)}.`;
}
