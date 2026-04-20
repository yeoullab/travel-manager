"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarX, ChevronDown, Map as MapIcon } from "lucide-react";
import { ScheduleItem } from "@/components/ui/schedule-item";
import { EmptyState } from "@/components/ui/empty-state";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { Fab } from "@/components/ui/fab";
import { getTripDaysByTripId, getScheduleItemsByTripDayId } from "@/lib/mocks";
import type { ScheduleItem as ScheduleItemT } from "@/lib/types";
import { cn } from "@/lib/cn";

type Props = { tripId: string };

/**
 * 06·07 /trips/[id]?tab=schedule
 *
 * Day Tab 가로 스크롤 → 선택 Day의 일정 리스트.
 * `?map=open` 쿼리로 지도 placeholder 토글 (07 화면).
 * 각 아이템 앞에 번호 마커(지도 핀과 매칭).
 */
export function ScheduleTab({ tripId }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const mapOpen = params.get("map") === "open";

  const days = useMemo(() => getTripDaysByTripId(tripId), [tripId]);
  const [activeDayId, setActiveDayId] = useState<string>(days[0]?.id ?? "");
  const [sheetOpen, setSheetOpen] = useState(false);

  const items = useMemo(
    () => (activeDayId ? getScheduleItemsByTripDayId(activeDayId) : []),
    [activeDayId],
  );

  function toggleMap() {
    const next = new URLSearchParams(params.toString());
    if (mapOpen) next.delete("map");
    else next.set("map", "open");
    router.push(`/trips/${tripId}?${next.toString()}`);
  }

  return (
    <div className="px-4 pb-28">
      <div className="bg-surface-300/50 border-border-primary mb-4 rounded-lg border px-3 py-2">
        <p className="text-ink-700 text-[12px]">이 탭은 다음 단계에서 실 데이터로 연결됩니다</p>
      </div>
      {/* Day tabs (sticky) */}
      <div className="bg-surface-200/90 sticky top-14 z-20 -mx-4 overflow-x-auto px-4 pt-3 pb-2 backdrop-blur-md">
        <ul className="flex gap-2">
          {days.map((d) => {
            const active = d.id === activeDayId;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => setActiveDayId(d.id)}
                  aria-pressed={active}
                  className={cn(
                    "flex h-12 min-w-[64px] flex-col items-center justify-center rounded-[10px] px-3",
                    "transition-colors duration-150",
                    active
                      ? "bg-accent-orange text-cream"
                      : "bg-surface-400 text-ink-700 hover:text-ink-900",
                  )}
                >
                  <span
                    className={cn(
                      "text-[10px] font-medium tracking-wider uppercase",
                      active ? "text-cream/90" : "text-ink-600",
                    )}
                  >
                    Day {d.dayNumber}
                  </span>
                  <span className="mt-0.5 text-[13px] font-semibold">
                    {formatShortDate(d.date)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Toolbar: count + map toggle */}
      <div className="mt-3 flex items-center justify-between">
        <p className="text-ink-600 text-[12px]">
          {items.length > 0 ? `${items.length}개 일정` : "일정 없음"}
        </p>
        <button
          type="button"
          onClick={toggleMap}
          aria-pressed={mapOpen}
          className="text-ink-700 hover:text-error flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors"
        >
          <MapIcon size={14} />
          {mapOpen ? "지도 접기" : "지도 펼치기"}
          <ChevronDown
            size={14}
            className={cn("transition-transform duration-200", mapOpen && "rotate-180")}
          />
        </button>
      </div>

      {mapOpen && <MapPlaceholder items={items} />}

      {/* Schedule list */}
      {items.length === 0 ? (
        <EmptyState
          className="py-16"
          icon={<CalendarX size={48} strokeWidth={1.5} />}
          title="아직 일정이 없어요"
          description="일정을 추가해 하루를 계획해보세요."
          cta={
            <Button variant="primary" onClick={() => setSheetOpen(true)}>
              + 일정 추가
            </Button>
          }
        />
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((item, idx) => (
            <li key={item.id} className="flex items-start gap-2">
              <div className="bg-surface-300 text-ink-700 mt-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold">
                {idx + 1}
              </div>
              <div className="min-w-0 flex-1">
                <ScheduleItem
                  category={item.category}
                  title={item.title}
                  time={item.time ?? undefined}
                  placeName={item.placeName ?? undefined}
                  memo={item.memo ?? undefined}
                  draggable
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Fab aria-label="일정 추가" onClick={() => setSheetOpen(true)} />

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="일정 추가"
        footer={
          <Button fullWidth variant="primary" onClick={() => setSheetOpen(false)}>
            저장
          </Button>
        }
      >
        <div className="space-y-4">
          <TextField label="제목" placeholder="예: 센소지 방문" />
          <TextField label="시간" type="time" />
          <TextField label="장소" placeholder="장소 검색" />
          <p className="text-ink-500 text-[12px]">Phase 0 목업 — 입력은 저장되지 않습니다.</p>
        </div>
      </BottomSheet>
    </div>
  );
}

function MapPlaceholder({ items }: { items: ScheduleItemT[] }) {
  const pinned = items.filter((i) => i.placeLat !== null && i.placeLng !== null);
  return (
    <div
      className={cn(
        "border-border-primary relative mt-3 flex h-[240px] items-center justify-center overflow-hidden rounded-[12px] border",
        "bg-[linear-gradient(135deg,rgba(159,187,224,0.25),rgba(159,201,162,0.18))]",
      )}
      role="img"
      aria-label="지도 placeholder"
    >
      <div aria-hidden className="absolute inset-0">
        {/* faint grid */}
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(38,37,30,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(38,37,30,0.08) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Sample pins (first 5 items) */}
      <div className="absolute inset-0">
        {pinned.slice(0, 5).map((item, idx) => (
          <div
            key={item.id}
            className="bg-accent-orange text-cream absolute flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold shadow-[0_2px_6px_rgba(245,78,0,0.35)]"
            style={{
              left: `${18 + idx * 14}%`,
              top: `${35 + ((idx * 11) % 30)}%`,
            }}
          >
            {idx + 1}
          </div>
        ))}
      </div>

      <div className="bg-surface-100/80 border-border-primary relative rounded-[8px] border px-3 py-2 backdrop-blur-sm">
        <p className="text-ink-600 text-[10px] tracking-wider uppercase">Map placeholder</p>
        <p className="text-ink-800 text-[13px] font-medium">
          {pinned.length}개 위치 · Phase 4에서 실 SDK 연동
        </p>
      </div>
    </div>
  );
}

function formatShortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}
