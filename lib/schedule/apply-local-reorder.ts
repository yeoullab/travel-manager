import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";

export function applyLocalReorder(
  items: ScheduleItem[],
  tripDayId: string,
  orderedIds: string[],
): ScheduleItem[] {
  const inDay = items.filter((i) => i.trip_day_id === tripDayId);
  const currentIds = new Set(inDay.map((i) => i.id));
  const nextIds = new Set(orderedIds);
  if (currentIds.size !== nextIds.size || orderedIds.length !== nextIds.size) {
    throw new Error("applyLocalReorder: set mismatch");
  }
  for (const id of orderedIds) {
    if (!currentIds.has(id)) throw new Error("applyLocalReorder: set mismatch");
  }

  const byId = new Map(inDay.map((i) => [i.id, i]));
  const reordered = new Map<string, ScheduleItem>();
  orderedIds.forEach((id, idx) => {
    const src = byId.get(id)!;
    reordered.set(id, { ...src, sort_order: idx + 1 });
  });

  return items.map((i) => (i.trip_day_id === tripDayId ? reordered.get(i.id)! : i));
}
