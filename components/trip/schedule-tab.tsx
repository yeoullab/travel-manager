"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarX, ChevronDown, Map as MapIcon } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Fab } from "@/components/ui/fab";
import { cn } from "@/lib/cn";

import { useTripDetail } from "@/lib/trip/use-trip-detail";
import { useTripDays } from "@/lib/trip/use-trip-days";
import { useScheduleList, type ScheduleItem } from "@/lib/schedule/use-schedule-list";
import { useCreateScheduleItem } from "@/lib/schedule/use-create-schedule-item";
import { useUpdateScheduleItem } from "@/lib/schedule/use-update-schedule-item";
import { useDeleteScheduleItem } from "@/lib/schedule/use-delete-schedule-item";
import { useReorderScheduleItemsInDay } from "@/lib/schedule/use-reorder-schedule-items-in-day";
import { useMoveScheduleItemAcrossDays } from "@/lib/schedule/use-move-schedule-item-across-days";
import { useUiStore } from "@/lib/store/ui-store";
import { providerForTrip } from "@/lib/maps/provider";
import type { PlaceResult } from "@/lib/maps/types";

import { DayTabBar } from "@/components/schedule/day-tab-bar";
import { ScheduleList } from "@/components/schedule/schedule-list";
import {
  ScheduleItemModal,
  type ScheduleItemFormValue,
} from "@/components/schedule/schedule-item-modal";
import { DayMoveSheet } from "@/components/schedule/day-move-sheet";
import { MapPanel } from "@/components/schedule/map-panel";
import { PlaceSearchSheet } from "@/components/schedule/place-search-sheet";

type Props = { tripId: string };

export function ScheduleTab({ tripId }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const mapOpen = params.get("map") === "open";

  const { data: trip } = useTripDetail(tripId);
  const { data: days = [], isLoading: daysLoading } = useTripDays(tripId);
  const { data: items = [], isLoading: itemsLoading } = useScheduleList(tripId);

  const createItem = useCreateScheduleItem();
  const updateItem = useUpdateScheduleItem();
  const deleteItem = useDeleteScheduleItem();
  const reorder = useReorderScheduleItemsInDay();
  const move = useMoveScheduleItemAcrossDays();

  const setDragging = useUiStore((s) => s.setDraggingSchedule);
  const showToast = useUiStore((s) => s.showToast);

  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    mode: "create" | "edit";
    initial: ScheduleItem | null;
  } | null>(null);
  const [placeSheetOpen, setPlaceSheetOpen] = useState(false);
  const [pickedPlace, setPickedPlace] = useState<PlaceResult | null>(null);
  const [dayMoveFor, setDayMoveFor] = useState<ScheduleItem | null>(null);

  const scheduleRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const registerItemRef = useCallback((id: string, el: HTMLLIElement | null) => {
    if (el) scheduleRefs.current[id] = el;
    else delete scheduleRefs.current[id];
  }, []);
  const handleMarkerClick = useCallback((id: string) => {
    const el = scheduleRefs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!activeDayId && days.length > 0) setActiveDayId(days[0].id);
    if (activeDayId && days.length > 0 && !days.some((d) => d.id === activeDayId)) {
      setActiveDayId(days[0].id);
    }
  }, [days, activeDayId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 400, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const itemsByDay = useMemo(() => {
    const grouped: Record<string, ScheduleItem[]> = {};
    for (const it of items) (grouped[it.trip_day_id] ??= []).push(it);
    for (const k of Object.keys(grouped)) {
      grouped[k].sort((a, b) => a.sort_order - b.sort_order);
    }
    return grouped;
  }, [items]);

  const activeDayItems = activeDayId ? (itemsByDay[activeDayId] ?? []) : [];

  const mapItems = useMemo(() => {
    return activeDayItems
      .map((it, idx) => ({ it, label: String(idx + 1) }))
      .filter(({ it }) => it.place_lat != null && it.place_lng != null)
      .map(({ it, label }) => ({
        id: it.id,
        place_lat: it.place_lat!,
        place_lng: it.place_lng!,
        label,
      }));
  }, [activeDayItems]);

  function toggleMap() {
    const next = new URLSearchParams(params.toString());
    if (mapOpen) next.delete("map");
    else next.set("map", "open");
    router.push(`/trips/${tripId}?${next.toString()}`);
  }

  function handleDragStart(_e: DragStartEvent) {
    setDragging(true);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragging(false);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeItem = items.find((i) => i.id === active.id);
    const overItem = items.find((i) => i.id === over.id);
    if (!activeItem || !overItem) return;

    if (activeItem.trip_day_id === overItem.trip_day_id) {
      const dayList = (itemsByDay[activeItem.trip_day_id] ?? []).map((i) => i.id);
      const fromIdx = dayList.indexOf(activeItem.id);
      const toIdx = dayList.indexOf(overItem.id);
      if (fromIdx === -1 || toIdx === -1) return;
      const nextOrder = [...dayList];
      nextOrder.splice(fromIdx, 1);
      nextOrder.splice(toIdx, 0, activeItem.id);
      reorder.mutate({ tripId, tripDayId: activeItem.trip_day_id, orderedIds: nextOrder });
    } else {
      const targetDay = overItem.trip_day_id;
      const targetList = (itemsByDay[targetDay] ?? []).map((i) => i.id);
      const overIdx = targetList.indexOf(overItem.id);
      const targetPosition = overIdx === -1 ? targetList.length + 1 : overIdx + 1;
      move.mutate({ tripId, itemId: activeItem.id, targetDayId: targetDay, targetPosition });
    }
  }

  function openCreate() {
    setPickedPlace(null);
    setModal({ mode: "create", initial: null });
  }
  function openEdit(item: ScheduleItem) {
    setPickedPlace(null);
    setModal({ mode: "edit", initial: item });
  }
  function closeModal() {
    setModal(null);
    setPickedPlace(null);
  }

  function handleSubmit(value: ScheduleItemFormValue) {
    if (!modal || !activeDayId) return;
    // manual_place stage 에서 들어온 수동 주소는 lat/lng 부재로 DB place 필드에 넣을 수 없어
    // memo 앞에 "주소: ..." 로 prepend (DB CHECK schedule_items_place_atomic 호환).
    const memoMerged =
      value.placeAddressManual && value.placeAddressManual.trim().length > 0
        ? `주소: ${value.placeAddressManual.trim()}${value.memo ? `\n\n${value.memo}` : ""}`
        : value.memo;
    const base = {
      title: value.title,
      categoryCode: value.categoryCode,
      timeOfDay: value.timeOfDay,
      memo: memoMerged,
      url: value.url,
      placeName: value.place?.name ?? null,
      placeAddress: value.place?.address ?? null,
      placeLat: value.place?.lat ?? null,
      placeLng: value.place?.lng ?? null,
      placeProvider: value.place?.provider ?? null,
      placeExternalId: value.place?.externalId ?? null,
    };
    if (modal.mode === "create") {
      createItem.mutate(
        { ...base, tripId, tripDayId: activeDayId },
        {
          onSuccess: () => {
            showToast("일정을 추가했어요", "success");
            closeModal();
          },
          onError: (e) =>
            showToast(`추가 실패: ${e instanceof Error ? e.message : ""}`, "error"),
        },
      );
    } else if (modal.initial) {
      updateItem.mutate(
        { ...base, tripId, itemId: modal.initial.id },
        {
          onSuccess: () => {
            showToast("저장했어요", "success");
            closeModal();
          },
          onError: (e) =>
            showToast(`저장 실패: ${e instanceof Error ? e.message : ""}`, "error"),
        },
      );
    }
  }

  function handleDelete() {
    if (modal?.mode !== "edit" || !modal.initial) return;
    if (!window.confirm("이 일정을 삭제할까요?")) return;
    deleteItem.mutate(
      { tripId, itemId: modal.initial.id },
      {
        onSuccess: () => {
          showToast("삭제했어요", "success");
          closeModal();
        },
        onError: (e) => showToast(`삭제 실패: ${e instanceof Error ? e.message : ""}`, "error"),
      },
    );
  }

  function handleDayMovePick(targetDayId: string) {
    if (!dayMoveFor) return;
    const targetList = itemsByDay[targetDayId] ?? [];
    move.mutate(
      {
        tripId,
        itemId: dayMoveFor.id,
        targetDayId,
        targetPosition: targetList.length + 1,
      },
      {
        onError: (e) => showToast(`이동 실패: ${e instanceof Error ? e.message : ""}`, "error"),
      },
    );
    setDayMoveFor(null);
    closeModal();
  }

  if (daysLoading || itemsLoading) {
    return <p className="text-ink-500 px-4 py-6 text-[13px]">불러오는 중…</p>;
  }

  return (
    <div className="px-4 pb-28">
      <DayTabBar days={days} activeDayId={activeDayId} onSelect={setActiveDayId} />

      <div className="mt-3 flex items-center justify-between">
        <p className="text-ink-600 text-[12px]">
          {activeDayItems.length > 0 ? `${activeDayItems.length}개 일정` : "일정 없음"}
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

      {mapOpen && trip && (
        <MapPanel
          isDomestic={trip.is_domestic}
          items={mapItems}
          onMarkerClick={handleMarkerClick}
        />
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {activeDayItems.length === 0 ? (
          <EmptyState
            className="py-16"
            icon={<CalendarX size={48} strokeWidth={1.5} />}
            title="아직 일정이 없어요"
            description="일정을 추가해 하루를 계획해보세요."
            cta={
              <Button variant="primary" onClick={openCreate}>
                + 일정 추가
              </Button>
            }
          />
        ) : (
          <ScheduleList
            items={activeDayItems}
            onTapItem={openEdit}
            registerItemRef={registerItemRef}
          />
        )}
      </DndContext>

      <Fab aria-label="일정 추가" onClick={openCreate} />

      {modal && (
        <ScheduleItemModal
          open
          mode={modal.mode}
          initial={modal.initial}
          pickedPlace={pickedPlace}
          onClose={closeModal}
          onSubmit={handleSubmit}
          onDelete={modal.mode === "edit" ? handleDelete : undefined}
          onOpenPlaceSearch={() => setPlaceSheetOpen(true)}
          onOpenDayMove={modal.mode === "edit" ? () => setDayMoveFor(modal.initial) : undefined}
          onAddExpense={
            modal.mode === "edit" && modal.initial
              ? () => {
                  const itemId = modal.initial!.id;
                  closeModal();
                  router.push(
                    `/trips/${tripId}?tab=expenses&quickAdd=scheduleItemId:${itemId}`,
                  );
                }
              : undefined
          }
        />
      )}

      {trip && (
        <PlaceSearchSheet
          open={placeSheetOpen}
          provider={providerForTrip(trip.is_domestic)}
          onClose={() => setPlaceSheetOpen(false)}
          onPick={(p) => {
            setPickedPlace(p);
            setPlaceSheetOpen(false);
          }}
          onManual={() => setPlaceSheetOpen(false)}
        />
      )}

      <DayMoveSheet
        open={Boolean(dayMoveFor)}
        days={days}
        currentDayId={dayMoveFor?.trip_day_id ?? ""}
        onClose={() => setDayMoveFor(null)}
        onPick={handleDayMovePick}
      />
    </div>
  );
}
