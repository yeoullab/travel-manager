import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";

function compactMainDay(items: ScheduleItem[]): ScheduleItem[] {
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
    if (item.is_candidate) {
      throw new Error("applyLocalBulkMove: candidate items use set_schedule_item_candidacy");
    }
    if (item.trip_day_id === targetDayId) {
      throw new Error("applyLocalBulkMove: target day contains selected item");
    }
    return item;
  });

  const affectedDayIds = new Set(selected.map((item) => item.trip_day_id));
  affectedDayIds.add(targetDayId);
  const selectedIds = new Set(itemIds);
  const isMainOf = (i: ScheduleItem, dayId: string | null) =>
    i.trip_day_id === dayId && !i.is_candidate;

  const targetExisting = compactMainDay(items.filter((i) => isMainOf(i, targetDayId)));
  const moved = selected.map((item, index) => ({
    ...item,
    trip_day_id: targetDayId,
    sort_order: targetExisting.length + index + 1,
  }));

  const nextByDay = new Map<string | null, ScheduleItem[]>();
  for (const dayId of affectedDayIds) {
    if (dayId === targetDayId) {
      nextByDay.set(dayId, compactMainDay([...targetExisting, ...moved]));
      continue;
    }
    nextByDay.set(
      dayId,
      compactMainDay(items.filter((i) => isMainOf(i, dayId) && !selectedIds.has(i.id))),
    );
  }

  const untouched = items.filter(
    (item) => item.is_candidate || !affectedDayIds.has(item.trip_day_id),
  );
  return [...untouched, ...Array.from(nextByDay.values()).flat()];
}
