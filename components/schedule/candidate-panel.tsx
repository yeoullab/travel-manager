"use client";

import { Inbox } from "lucide-react";
import { ScheduleItem as ScheduleItemCard } from "@/components/ui/schedule-item";
import { EmptyState } from "@/components/ui/empty-state";
import { markerColorsFor } from "@/lib/maps/marker-colors";
import { resolvePlaceLink } from "@/lib/maps/place-link";
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";
import type { ScheduleCategory } from "@/lib/types";
import type { TripDay } from "@/lib/trip/use-trip-days";

type Props = {
  poolItems: ScheduleItem[];
  candidatesByDay: Record<string, ScheduleItem[]>;
  days: TripDay[];
  isDomestic: boolean;
  onTapItem: (item: ScheduleItem) => void;
  onTapNumber?: (item: ScheduleItem) => void;
  registerItemRef?: (id: string, el: HTMLLIElement | null) => void;
};

/** 후보 탭 (스펙 §7): ① 전체 풀 후보 → ② 일자별 후보 그룹 (있는 날만). 정렬 없음(V1). */
export function CandidatePanel({
  poolItems,
  candidatesByDay,
  days,
  isDomestic,
  onTapItem,
  onTapNumber,
  registerItemRef,
}: Props) {
  const daysWithCandidates = days.filter((d) => (candidatesByDay[d.id] ?? []).length > 0);
  const empty = poolItems.length === 0 && daysWithCandidates.length === 0;

  if (empty) {
    return (
      <EmptyState
        className="py-16"
        icon={<Inbox size={48} strokeWidth={1.5} />}
        title="아직 후보가 없어요"
        description="일정 추가 시 '후보로 등록'을 체크하거나, 여기서 바로 등록해보세요."
      />
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-5" data-testid="candidate-panel">
      <section>
        <h3 className="text-ink-700 mb-2 text-[13px] font-semibold">
          전체 풀 후보 ({poolItems.length})
        </h3>
        {poolItems.length === 0 ? (
          <p className="text-ink-500 text-[12px]">
            여행 전체에서 고려할 후보를 + 버튼으로 등록하세요.
          </p>
        ) : (
          <CandidateRows
            items={poolItems}
            labelPrefix="P-"
            isDomestic={isDomestic}
            onTapItem={onTapItem}
            onTapNumber={onTapNumber}
            registerItemRef={registerItemRef}
          />
        )}
      </section>

      {daysWithCandidates.map((d) => (
        <section key={d.id}>
          <h3 className="text-ink-700 mb-2 text-[13px] font-semibold">
            Day {d.day_number} 후보 ({(candidatesByDay[d.id] ?? []).length})
          </h3>
          <CandidateRows
            items={candidatesByDay[d.id] ?? []}
            labelPrefix={`${d.day_number}-`}
            isDomestic={isDomestic}
            onTapItem={onTapItem}
            onTapNumber={onTapNumber}
            registerItemRef={registerItemRef}
          />
        </section>
      ))}
    </div>
  );
}

function CandidateRows({
  items,
  labelPrefix,
  isDomestic,
  onTapItem,
  onTapNumber,
  registerItemRef,
}: {
  items: ScheduleItem[];
  /** 지도 마커와 일치하는 라벨 접두 ("P-" | "{day}-"). 소속 구분용. */
  labelPrefix: string;
  isDomestic: boolean;
  onTapItem: (item: ScheduleItem) => void;
  onTapNumber?: (item: ScheduleItem) => void;
  registerItemRef?: (id: string, el: HTMLLIElement | null) => void;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, idx) => {
        const { fill } = markerColorsFor(item.category_code);
        const label = `${labelPrefix}${idx + 1}`;
        return (
          <li
            key={item.id}
            ref={(el) => registerItemRef?.(item.id, el)}
            className="flex items-stretch gap-1"
          >
            <button
              type="button"
              aria-label={`후보 ${label} 지도에서 보기`}
              className="flex h-11 w-11 shrink-0 items-center justify-center bg-transparent"
              onClick={(e) => {
                e.stopPropagation();
                onTapNumber?.(item);
              }}
            >
              <span
                className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full border-2 border-dashed bg-transparent px-1 text-[11px] font-semibold tabular-nums"
                style={{ borderColor: fill, color: fill }}
              >
                {label}
              </span>
            </button>
            <div className="min-w-0 flex-1">
              <ScheduleItemCard
                category={item.category_code as ScheduleCategory}
                title={item.title}
                time={item.time_of_day ? item.time_of_day.slice(0, 5) : undefined}
                placeName={item.place_name ?? undefined}
                placeAddress={item.place_address ?? undefined}
                memo={item.memo ?? undefined}
                onClick={() => onTapItem(item)}
                placeUrl={resolvePlaceLink({
                  placeExternalUrl: item.place_external_url,
                  placeLat: item.place_lat,
                  placeLng: item.place_lng,
                  placeName: item.place_name,
                  placeAddress: item.place_address,
                  isDomestic,
                })}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
