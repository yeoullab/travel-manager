import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";

export function applyLocalReorder(
  items: ScheduleItem[],
  tripDayId: string,
  orderedIds: string[],
): ScheduleItem[] {
  // 파티션 판정: orderedIds 가 가리키는 아이템들의 is_candidate (RPC 와 동일 규칙)
  const orderedSet = new Set(orderedIds);
  const sample = items.find((i) => orderedSet.has(i.id));
  const isCandidate = sample?.is_candidate ?? false;
  const inPartition = items.filter(
    (i) => i.trip_day_id === tripDayId && i.is_candidate === isCandidate,
  );
  const currentIds = new Set(inPartition.map((i) => i.id));
  const nextIds = new Set(orderedIds);
  if (currentIds.size !== nextIds.size || orderedIds.length !== nextIds.size) {
    throw new Error("applyLocalReorder: set mismatch");
  }
  for (const id of orderedIds) {
    if (!currentIds.has(id)) throw new Error("applyLocalReorder: set mismatch");
  }

  const byId = new Map(inPartition.map((i) => [i.id, i]));
  const reordered = new Map<string, ScheduleItem>();
  orderedIds.forEach((id, idx) => {
    const src = byId.get(id)!;
    reordered.set(id, { ...src, sort_order: idx + 1 });
  });

  return items.map((i) =>
    i.trip_day_id === tripDayId && i.is_candidate === isCandidate ? reordered.get(i.id)! : i,
  );
}
