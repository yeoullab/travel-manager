import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";

function compactDay(items: ScheduleItem[]): ScheduleItem[] {
  return [...items]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item, index) => ({ ...item, sort_order: index + 1 }));
}

export function applyLocalBulkMove(
  items: ScheduleItem[],
  itemIds: string[],
  targetDayId: string,
): ScheduleItem[] {
  if (itemIds.length === 0) {
    throw new Error("applyLocalBulkMove: empty item ids");
  }
  if (new Set(itemIds).size !== itemIds.length) {
    throw new Error("applyLocalBulkMove: duplicate item ids");
  }

  const byId = new Map(items.map((item) => [item.id, item]));
  const selected = itemIds.map((id) => {
    const item = byId.get(id);
    if (!item) throw new Error("applyLocalBulkMove: item not found");
    if (item.trip_day_id === targetDayId) {
      throw new Error("applyLocalBulkMove: target day contains selected item");
    }
    return item;
  });

  const affectedDayIds = new Set(selected.map((item) => item.trip_day_id));
  affectedDayIds.add(targetDayId);
  const selectedIds = new Set(itemIds);

  const targetExisting = compactDay(items.filter((item) => item.trip_day_id === targetDayId));
  const moved = selected.map((item, index) => ({
    ...item,
    trip_day_id: targetDayId,
    sort_order: targetExisting.length + index + 1,
  }));

  const nextByDay = new Map<string, ScheduleItem[]>();
  for (const dayId of affectedDayIds) {
    if (dayId === targetDayId) {
      nextByDay.set(dayId, compactDay([...targetExisting, ...moved]));
      continue;
    }
    nextByDay.set(
      dayId,
      compactDay(items.filter((item) => item.trip_day_id === dayId && !selectedIds.has(item.id))),
    );
  }

  const untouched = items.filter((item) => !affectedDayIds.has(item.trip_day_id));
  return [...untouched, ...Array.from(nextByDay.values()).flat()];
}
