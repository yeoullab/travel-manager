import type { PlaceResult } from "@/lib/maps/types";
import type { ScheduleCategory } from "@/lib/types";

export type ScheduleMutationFormValue = {
  title: string;
  categoryCode: ScheduleCategory;
  timeOfDay: string | null;
  memo: string | null;
  url: string | null;
  place: PlaceResult | null;
  placeAddressManual?: string | null;
};

export function buildScheduleMutationBase(value: ScheduleMutationFormValue) {
  const manualAddress = value.placeAddressManual?.trim() || null;
  const isManualPlace = value.place === null && manualAddress !== null;

  return {
    title: value.title,
    categoryCode: value.categoryCode,
    timeOfDay: value.timeOfDay,
    memo: value.memo,
    url: value.url,
    placeName: isManualPlace ? value.title : (value.place?.name ?? null),
    placeAddress: isManualPlace ? manualAddress : (value.place?.address ?? null),
    placeLat: value.place?.lat ?? null,
    placeLng: value.place?.lng ?? null,
    placeProvider: value.place?.provider ?? null,
    placeExternalId: value.place?.externalId ?? null,
    placeExternalUrl: value.place?.externalUrl ?? null,
  };
}
