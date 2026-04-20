import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";

export function applyLocalMove(
  items: ScheduleItem[],
  itemId: string,
  targetDayId: string,
  targetPosition: number, // 1-based, 1..targetCount+1
): ScheduleItem[] {
  const src = items.find((i) => i.id === itemId);
  if (!src) throw new Error("applyLocalMove: item not found");
  if (src.trip_day_id === targetDayId) {
    throw new Error("applyLocalMove: same day — use applyLocalReorder (use_reorder_for_same_day)");
  }

  const sourceDayId = src.trip_day_id;
  const targetExisting = items
    .filter((i) => i.trip_day_id === targetDayId)
    .sort((a, b) => a.sort_order - b.sort_order);
  if (targetPosition < 1 || targetPosition > targetExisting.length + 1) {
    throw new Error(
      `applyLocalMove: invalid_target_position (got ${targetPosition}, max ${targetExisting.length + 1})`,
    );
  }

  const sourceRemaining = items
    .filter((i) => i.trip_day_id === sourceDayId && i.id !== itemId)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i, idx) => ({ ...i, sort_order: idx + 1 }));

  const movedItem: ScheduleItem = { ...src, trip_day_id: targetDayId, sort_order: targetPosition };
  const targetNext = [
    ...targetExisting.slice(0, targetPosition - 1),
    movedItem,
    ...targetExisting.slice(targetPosition - 1),
  ].map((i, idx) => ({ ...i, sort_order: idx + 1 }));

  const untouched = items.filter(
    (i) => i.trip_day_id !== sourceDayId && i.trip_day_id !== targetDayId,
  );
  return [...untouched, ...sourceRemaining, ...targetNext];
}
