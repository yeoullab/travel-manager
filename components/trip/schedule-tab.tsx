"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarX, Map as MapIcon } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import { Button } from "@/components/ui/button";
import { Fab } from "@/components/ui/fab";
import { cn } from "@/lib/cn";
import { useResizableHeight } from "@/lib/hooks/use-resizable-height";

import { useTripDetail } from "@/lib/trip/use-trip-detail";
import { useTripDays } from "@/lib/trip/use-trip-days";
import { useScheduleList, type ScheduleItem } from "@/lib/schedule/use-schedule-list";
import { scrollItemIntoList } from "@/lib/schedule/scroll-item-into-list";
import { useCreateScheduleItem } from "@/lib/schedule/use-create-schedule-item";
import { useUpdateScheduleItem } from "@/lib/schedule/use-update-schedule-item";
import { useDeleteScheduleItem } from "@/lib/schedule/use-delete-schedule-item";
import { useDeleteScheduleItems } from "@/lib/schedule/use-delete-schedule-items";
import { useReorderScheduleItemsInDay } from "@/lib/schedule/use-reorder-schedule-items-in-day";
import { useMoveScheduleItemAcrossDays } from "@/lib/schedule/use-move-schedule-item-across-days";
import { useCreateLodgingScheduleItemsForRange } from "@/lib/schedule/use-create-lodging-schedule-items-for-range";
import { useMoveScheduleItemsToDay } from "@/lib/schedule/use-move-schedule-items-to-day";
import { useSetScheduleItemCandidacy } from "@/lib/schedule/use-set-schedule-item-candidacy";
import { useUiStore } from "@/lib/store/ui-store";
import { providerForTrip } from "@/lib/maps/provider";
import type { PlaceResult } from "@/lib/maps/types";
import { buildScheduleMutationBase } from "@/lib/schedule/build-schedule-mutation-base";

import { DayTabBar } from "@/components/schedule/day-tab-bar";
import { ScheduleList } from "@/components/schedule/schedule-list";
import { CandidateSection } from "@/components/schedule/candidate-section";
import { CandidatePanel } from "@/components/schedule/candidate-panel";
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
  const [view, setView] = useState<"day" | "candidates">("day");
  const candidatesOnMap = params.get("candidates") === "1";

  const { data: trip } = useTripDetail(tripId);
  const { data: days = [], isLoading: daysLoading } = useTripDays(tripId);
  const { data: items = [], isLoading: itemsLoading } = useScheduleList(tripId);

  const createItem = useCreateScheduleItem();
  const updateItem = useUpdateScheduleItem();
  const deleteItem = useDeleteScheduleItem();
  const deleteMany = useDeleteScheduleItems();
  const reorder = useReorderScheduleItemsInDay();
  const move = useMoveScheduleItemAcrossDays();
  const createLodgingRange = useCreateLodgingScheduleItemsForRange();
  const moveMany = useMoveScheduleItemsToDay();
  const candidacy = useSetScheduleItemCandidacy();

  const mapResize = useResizableHeight({
    storageKey: "travel-manager:map-height",
    defaultHeight: 280,
    min: 160,
    max: 520,
  });

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
  const [focusMapItemId, setFocusMapItemId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [candidacySheet, setCandidacySheet] = useState<{
    item: ScheduleItem;
    mode: "promote" | "move";
  } | null>(null);

  const scheduleRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const registerItemRef = useCallback((id: string, el: HTMLLIElement | null) => {
    if (el) scheduleRefs.current[id] = el;
    else delete scheduleRefs.current[id];
  }, []);
  const handleMarkerClick = useCallback(
    (id: string, contextLabel?: string) => {
      if (contextLabel) showToast(contextLabel);
      const el = scheduleRefs.current[id];
      // 지도·탭 영역은 고정한 채 리스트 컨테이너만 스크롤한다.
      if (el) scrollItemIntoList(el);
    },
    [showToast],
  );
  const handleNumberTap = useCallback(
    (item: ScheduleItem) => {
      if (item.place_lat == null || item.place_lng == null) {
        showToast("지도 좌표가 없는 일정이에요");
        return;
      }
      setFocusMapItemId(item.id);
      const next = new URLSearchParams(params.toString());
      let changed = false;
      if (!mapOpen) {
        next.set("map", "open");
        changed = true;
      }
      if (item.is_candidate && params.get("candidates") !== "1") {
        next.set("candidates", "1");
        changed = true;
      }
      if (changed) router.push(`/trips/${tripId}?${next.toString()}`);
    },
    [mapOpen, params, router, showToast, tripId],
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!activeDayId && days.length > 0) setActiveDayId(days[0].id);
    if (activeDayId && days.length > 0 && !days.some((d) => d.id === activeDayId)) {
      setActiveDayId(days[0].id);
    }
  }, [days, activeDayId]);

  useEffect(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setBulkMoveOpen(false);
  }, [activeDayId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const sensors = useSensors(
    // PointerSensor: 데스크톱 마우스 + 일부 mobile pointer events
    useSensor(PointerSensor, { activationConstraint: { delay: 400, tolerance: 8 } }),
    // TouchSensor: iOS Safari/Android Chrome long-press — touch-action: none 과 결합 필수
    useSensor(TouchSensor, { activationConstraint: { delay: 400, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // 본 일정만 day 별 그룹 (후보·풀 제외) — 기존 번호/이동 로직의 입력
  const itemsByDay = useMemo(() => {
    const grouped: Record<string, ScheduleItem[]> = {};
    for (const it of items) {
      if (!it.trip_day_id || it.is_candidate) continue;
      (grouped[it.trip_day_id] ??= []).push(it);
    }
    for (const k of Object.keys(grouped)) {
      grouped[k].sort((a, b) => a.sort_order - b.sort_order);
    }
    return grouped;
  }, [items]);

  const candidatesByDay = useMemo(() => {
    const grouped: Record<string, ScheduleItem[]> = {};
    for (const it of items) {
      if (!it.trip_day_id || !it.is_candidate) continue;
      (grouped[it.trip_day_id] ??= []).push(it);
    }
    for (const k of Object.keys(grouped)) {
      grouped[k].sort((a, b) => a.sort_order - b.sort_order);
    }
    return grouped;
  }, [items]);

  const poolItems = useMemo(
    () =>
      items
        .filter((it) => !it.trip_day_id && it.is_candidate)
        .sort((a, b) => a.sort_order - b.sort_order),
    [items],
  );

  const activeDayItems = useMemo(
    () => (activeDayId ? (itemsByDay[activeDayId] ?? []) : []),
    [activeDayId, itemsByDay],
  );
  const activeDayCandidates = useMemo(
    () => (activeDayId ? (candidatesByDay[activeDayId] ?? []) : []),
    [activeDayId, candidatesByDay],
  );
  const selectedActiveItems = useMemo(
    () => activeDayItems.filter((item) => selectedIds.has(item.id)),
    [activeDayItems, selectedIds],
  );
  const selectedCount = selectedActiveItems.length;

  const mapItems = useMemo(() => {
    type Entry = {
      it: ScheduleItem;
      label: string;
      variant: "main" | "candidate";
      contextLabel?: string;
    };
    const entries: Entry[] = [];
    if (view === "candidates") {
      // 후보 탭 지도: 풀 + 모든 일자 후보. 그룹이 섞이므로 라벨에 소속을 접두(스펙 §6 + 소속 구분).
      // 풀 = "P-N", 일자 후보 = "{day}-N". CandidatePanel 배지와 동일 라벨.
      poolItems.forEach((it, idx) =>
        entries.push({
          it,
          label: `P-${idx + 1}`,
          variant: "candidate",
          contextLabel: `전체 풀 후보 ${idx + 1}`,
        }),
      );
      for (const d of days) {
        (candidatesByDay[d.id] ?? []).forEach((it, idx) =>
          entries.push({
            it,
            label: `${d.day_number}-${idx + 1}`,
            variant: "candidate",
            contextLabel: `Day ${d.day_number} 후보 ${idx + 1}`,
          }),
        );
      }
    } else {
      activeDayItems.forEach((it, idx) =>
        entries.push({ it, label: String(idx + 1), variant: "main" }),
      );
      if (candidatesOnMap) {
        activeDayCandidates.forEach((it, idx) =>
          entries.push({ it, label: String(idx + 1), variant: "candidate" }),
        );
      }
    }
    return entries
      .filter(({ it }) => it.place_lat != null && it.place_lng != null)
      .map(({ it, label, variant, contextLabel }) => ({
        id: it.id,
        place_lat: it.place_lat!,
        place_lng: it.place_lng!,
        label,
        title: it.title,
        category: it.category_code,
        variant,
        contextLabel,
      }));
  }, [view, activeDayItems, activeDayCandidates, candidatesOnMap, poolItems, candidatesByDay, days]);

  function toggleMap() {
    const next = new URLSearchParams(params.toString());
    if (mapOpen) next.delete("map");
    else next.set("map", "open");
    router.push(`/trips/${tripId}?${next.toString()}`);
  }

  function toggleCandidatesOnMap() {
    const next = new URLSearchParams(params.toString());
    if (candidatesOnMap) next.delete("candidates");
    else next.set("candidates", "1");
    router.push(`/trips/${tripId}?${next.toString()}`);
  }

  function handleDragStart() {
    setDragging(true);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragging(false);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeItem = items.find((i) => i.id === active.id);
    const overItem = items.find((i) => i.id === over.id);
    if (!activeItem || !overItem) return;
    // 파티션 경계를 넘는 드래그는 무시 (전환은 메뉴 액션으로만 — 스펙 §7)
    if (activeItem.is_candidate !== overItem.is_candidate) return;

    if (activeItem.is_candidate) {
      // 일자 후보 파티션 내 재정렬만 허용
      if (!activeItem.trip_day_id || activeItem.trip_day_id !== overItem.trip_day_id) return;
      const dayList = (candidatesByDay[activeItem.trip_day_id] ?? []).map((i) => i.id);
      const fromIdx = dayList.indexOf(activeItem.id);
      const toIdx = dayList.indexOf(overItem.id);
      if (fromIdx === -1 || toIdx === -1) return;
      const nextOrder = [...dayList];
      nextOrder.splice(fromIdx, 1);
      nextOrder.splice(toIdx, 0, activeItem.id);
      reorder.mutate({ tripId, tripDayId: activeItem.trip_day_id, orderedIds: nextOrder });
      return;
    }

    // 본 일정: trip_day_id 는 이 시점에 non-null 이어야 한다.
    if (!activeItem.trip_day_id || !overItem.trip_day_id) return;

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
  function toggleSelectionMode() {
    if (selectionMode) {
      setSelectedIds(new Set());
      setSelectionMode(false);
    } else {
      setSelectionMode(true);
    }
  }
  function enterSelectionMode(item: ScheduleItem) {
    setSelectionMode(true);
    setSelectedIds(new Set([item.id]));
  }
  function toggleSelected(item: ScheduleItem) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }
  function closeModal() {
    setModal(null);
    setPickedPlace(null);
  }

  function handleSubmit(value: ScheduleItemFormValue) {
    if (!modal) return;
    if (view === "day" && !activeDayId) return;
    const base = buildScheduleMutationBase(value);
    if (modal.mode === "create") {
      const asCandidate = view === "candidates" || Boolean(value.isCandidate);
      if (
        !asCandidate &&
        value.categoryCode === "lodging" &&
        value.lodgingRange &&
        value.lodgingRange.startDayId &&
        value.lodgingRange.endDayId &&
        value.lodgingRange.startDayId !== value.lodgingRange.endDayId
      ) {
        createLodgingRange.mutate(
          {
            title: base.title,
            timeOfDay: base.timeOfDay,
            memo: base.memo,
            url: base.url,
            placeName: base.placeName,
            placeAddress: base.placeAddress,
            placeLat: base.placeLat,
            placeLng: base.placeLng,
            placeProvider: base.placeProvider,
            placeExternalId: base.placeExternalId,
            placeExternalUrl: base.placeExternalUrl,
            tripId,
            startDayId: value.lodgingRange.startDayId,
            endDayId: value.lodgingRange.endDayId,
          },
          {
            onSuccess: (ids) => {
              showToast(`${ids.length}일 숙소 일정을 추가했어요`, "success");
              closeModal();
            },
            onError: (e) => showToast(`추가 실패: ${e instanceof Error ? e.message : ""}`, "error"),
          },
        );
        return;
      }
      createItem.mutate(
        {
          ...base,
          tripId,
          tripDayId: view === "candidates" ? null : activeDayId,
          isCandidate: asCandidate,
        },
        {
          onSuccess: () => {
            showToast(asCandidate ? "후보로 등록했어요" : "일정을 추가했어요", "success");
            closeModal();
          },
          onError: (e) => showToast(`추가 실패: ${e instanceof Error ? e.message : ""}`, "error"),
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
          onError: (e) => showToast(`저장 실패: ${e instanceof Error ? e.message : ""}`, "error"),
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

  function handleBulkMovePick(targetDayId: string) {
    if (!activeDayId || moveMany.isPending || selectedActiveItems.length === 0) return;
    const itemIds = selectedActiveItems.map((item) => item.id);
    moveMany.mutate(
      { tripId, itemIds, targetDayId },
      {
        onSuccess: () => {
          showToast(`${itemIds.length}개 일정을 이동했어요`, "success");
          setSelectionMode(false);
          setSelectedIds(new Set());
          setBulkMoveOpen(false);
        },
        onError: (e) => showToast(`이동 실패: ${e instanceof Error ? e.message : ""}`, "error"),
      },
    );
  }

  function handleBulkDelete() {
    if (deleteMany.isPending || selectedActiveItems.length === 0) return;
    const itemIds = selectedActiveItems.map((item) => item.id);
    if (itemIds.length === 0) return;
    const ok = window.confirm(`${itemIds.length}개 일정을 삭제할까요?`);
    if (!ok) return;

    deleteMany.mutate(
      { tripId, itemIds },
      {
        onSuccess: () => {
          showToast(`${itemIds.length}개 일정을 삭제했어요`, "success");
          setSelectionMode(false);
          setSelectedIds(new Set());
          setBulkMoveOpen(false);
        },
        onError: (e) => {
          showToast(`삭제 실패: ${e instanceof Error ? e.message : ""}`, "error");
        },
      },
    );
  }

  function runCandidacy(
    itemId: string,
    isCandidate: boolean,
    targetDayId: string | null,
    msg: string,
  ) {
    candidacy.mutate(
      { tripId, itemId, isCandidate, targetDayId },
      {
        onSuccess: () => showToast(msg, "success"),
        onError: (e) => showToast(`실패: ${e instanceof Error ? e.message : ""}`, "error"),
      },
    );
    setCandidacySheet(null);
    closeModal();
  }

  function handleDemote() {
    if (!modal?.initial) return;
    runCandidacy(modal.initial.id, true, modal.initial.trip_day_id, "후보로 옮겼어요");
  }

  if (daysLoading || itemsLoading) {
    return <ListSkeleton rows={5} />;
  }

  const mapPanel = trip ? (
    <div className="flex h-full flex-col">
      {view === "day" && (
        <label className="text-ink-700 mb-1 flex shrink-0 items-center gap-1.5 self-end text-[12px]">
          <input
            type="checkbox"
            checked={candidatesOnMap}
            onChange={toggleCandidatesOnMap}
            className="accent-ink-900 h-4 w-4"
          />
          후보 보기
        </label>
      )}
      <MapPanel
        isDomestic={trip.is_domestic}
        items={mapItems}
        onMarkerClick={handleMarkerClick}
        focusItemId={focusMapItemId}
        className="mt-0 min-h-0 flex-1"
      />
    </div>
  ) : null;

  return (
    <div className="px-4 pb-28 lg:grid lg:h-[calc(100dvh-56px-80px)] lg:grid-cols-[minmax(0,560px)_minmax(420px,1fr)] lg:gap-4 lg:overflow-hidden lg:pb-4">
      <section
        data-testid="schedule-scroll-panel"
        className={cn(
          "min-w-0",
          // Mobile: fixed-height flex column so only the list scrolls when the map is open.
          mapOpen
            ? "flex h-[calc(100dvh-56px)] flex-col overflow-hidden"
            : "",
          // Desktop: unchanged scroll column.
          "lg:flex lg:h-auto lg:flex-col lg:overflow-y-auto lg:pr-1",
        )}
      >
        <div className="shrink-0">
          <div className="flex items-stretch gap-2">
            <DayTabBar
              days={days}
              activeDayId={view === "day" ? activeDayId : null}
              onSelect={(dayId) => {
                setView("day");
                setActiveDayId(dayId);
              }}
              candidateActive={view === "candidates"}
              onSelectCandidates={() => setView("candidates")}
              className="min-w-0 flex-1 lg:top-0"
            />
            <button
              type="button"
              onClick={toggleMap}
              aria-pressed={mapOpen}
              aria-label={mapOpen ? "지도 접기" : "지도 펼치기"}
              className={cn(
                "mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] transition-colors lg:hidden",
                mapOpen
                  ? "bg-accent-orange text-cream"
                  : "bg-surface-400 text-ink-700 hover:text-ink-900",
              )}
            >
              <MapIcon size={18} />
            </button>
          </div>
        </div>

        {mapOpen && mapPanel && (
          <div className="shrink-0 lg:hidden">
            <div style={{ height: mapResize.height }}>{mapPanel}</div>
            <div
              {...mapResize.handleProps}
              aria-label="지도 높이 조절"
              className="flex h-6 cursor-row-resize touch-none items-center justify-center"
            >
              <span className="bg-border-medium h-1 w-10 rounded-full" />
            </div>
          </div>
        )}

        <div
          className={cn(
            "min-w-0",
            mapOpen ? "flex-1 overflow-y-auto" : "",
          )}
        >
          {view === "day" && selectionMode && (
            <div className="border-border-primary bg-surface-100 sticky top-0 z-20 mt-2 flex items-center justify-between rounded-[8px] border px-3 py-2">
              <span className="text-ink-700 text-[13px] font-medium">{selectedCount}개 선택</span>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="light"
                  disabled={selectedCount === 0 || moveMany.isPending}
                  onClick={() => setBulkMoveOpen(true)}
                >
                  이동
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={selectedCount === 0 || deleteMany.isPending}
                  onClick={handleBulkDelete}
                >
                  삭제
                </Button>
                <button
                  type="button"
                  onClick={toggleSelectionMode}
                  className="text-ink-600 h-9 rounded-full px-2 text-[13px] font-medium"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {view === "day" ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              {activeDayItems.length === 0 && activeDayCandidates.length === 0 ? (
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
                <>
                  <ScheduleList
                    items={activeDayItems}
                    isDomestic={trip?.is_domestic ?? true}
                    onTapItem={selectionMode ? toggleSelected : openEdit}
                    onLongPressItem={enterSelectionMode}
                    onTapNumber={handleNumberTap}
                    selectionMode={selectionMode}
                    selectedIds={selectedIds}
                    onToggleSelected={toggleSelected}
                    registerItemRef={registerItemRef}
                  />
                  {activeDayCandidates.length > 0 && (
                    <CandidateSection
                      items={activeDayCandidates}
                      isDomestic={trip?.is_domestic ?? true}
                      onTapItem={openEdit}
                      onTapNumber={handleNumberTap}
                      registerItemRef={registerItemRef}
                    />
                  )}
                </>
              )}
            </DndContext>
          ) : (
            <CandidatePanel
              poolItems={poolItems}
              candidatesByDay={candidatesByDay}
              days={days}
              isDomestic={trip?.is_domestic ?? true}
              onTapItem={openEdit}
              onTapNumber={handleNumberTap}
              registerItemRef={registerItemRef}
            />
          )}
        </div>
      </section>

      <aside className="hidden min-h-0 lg:block">
        <div className="sticky top-16 h-full">{mapPanel}</div>
      </aside>

      <Fab aria-label="일정 추가" onClick={openCreate} />

      {modal && (
        <ScheduleItemModal
          open
          mode={modal.mode}
          initial={modal.initial}
          pickedPlace={pickedPlace}
          candidateMode={view === "candidates" ? "pool-fixed" : "day-toggle"}
          onClose={closeModal}
          onSubmit={handleSubmit}
          onDelete={modal.mode === "edit" ? handleDelete : undefined}
          onOpenPlaceSearch={() => setPlaceSheetOpen(true)}
          onOpenDayMove={
            modal.mode === "edit" && modal.initial && !modal.initial.is_candidate
              ? () => setDayMoveFor(modal.initial)
              : undefined
          }
          onDemoteToCandidate={
            modal.mode === "edit" && modal.initial && !modal.initial.is_candidate
              ? handleDemote
              : undefined
          }
          onPromoteToSchedule={
            modal.mode === "edit" && modal.initial?.is_candidate
              ? () => setCandidacySheet({ item: modal.initial!, mode: "promote" })
              : undefined
          }
          onMoveCandidate={
            modal.mode === "edit" && modal.initial?.is_candidate
              ? () => setCandidacySheet({ item: modal.initial!, mode: "move" })
              : undefined
          }
          days={days}
          currentDayId={activeDayId}
          onAddExpense={
            modal.mode === "edit" && modal.initial
              ? () => {
                  const itemId = modal.initial!.id;
                  closeModal();
                  router.push(`/trips/${tripId}?tab=expenses&quickAdd=scheduleItemId:${itemId}`);
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
      <DayMoveSheet
        open={bulkMoveOpen}
        days={days}
        currentDayId={activeDayId ?? ""}
        onClose={() => setBulkMoveOpen(false)}
        onPick={handleBulkMovePick}
      />
      <DayMoveSheet
        open={candidacySheet?.mode === "promote"}
        days={days}
        currentDayId=""
        title="일정으로 승격할 날짜"
        onClose={() => setCandidacySheet(null)}
        onPick={(dayId) => {
          if (!candidacySheet) return;
          runCandidacy(candidacySheet.item.id, false, dayId, "일정으로 승격했어요");
        }}
      />
      <DayMoveSheet
        open={candidacySheet?.mode === "move"}
        days={days}
        currentDayId={candidacySheet?.item.trip_day_id ?? ""}
        title="후보 이동"
        onClose={() => setCandidacySheet(null)}
        onPick={(dayId) => {
          if (!candidacySheet) return;
          runCandidacy(candidacySheet.item.id, true, dayId, "후보를 이동했어요");
        }}
        onPickPool={() => {
          if (!candidacySheet) return;
          runCandidacy(candidacySheet.item.id, true, null, "전체 후보로 이동했어요");
        }}
      />
    </div>
  );
}
