import type { PlaceResult, LatLng } from "@/lib/maps/types";
import { getServerEnv } from "@/lib/env";
import { clampLatLng } from "@/lib/maps/rate-limit";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
// §6.13: googleMapsUri 추가 (Places API New v1) — Google Maps Place 페이지 직링크.
const FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri";

type GoogleResp = {
  places?: Array<{
    id: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
    googleMapsUri?: string;
  }>;
};

export async function searchGoogle(query: string, near?: LatLng): Promise<PlaceResult[]> {
  const { GOOGLE_MAPS_SERVER_KEY } = getServerEnv();
  if (!GOOGLE_MAPS_SERVER_KEY) throw new Error("google_maps_server_key_missing");

  const body = {
    textQuery: query,
    pageSize: 10,
    ...(near && {
      locationBias: {
        circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 5000 },
      },
    }),
  };

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_MAPS_SERVER_KEY,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`google search ${res.status}`);
  const parsed = (await res.json()) as GoogleResp;

  const out: PlaceResult[] = [];
  for (const p of parsed.places ?? []) {
    if (!p.location) continue;
    const clamped = clampLatLng(p.location.latitude, p.location.longitude);
    if (!clamped) continue;
    // googleMapsUri 가 누락되면 place_id 기반 정식 URL 합성. https 스킴 보장.
    const externalUrl =
      p.googleMapsUri && /^https?:\/\//i.test(p.googleMapsUri)
        ? p.googleMapsUri
        : `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(p.id)}`;
    out.push({
      externalId: `google:${p.id}`,
      name: p.displayName?.text ?? "",
      address: p.formattedAddress ?? "",
      lat: clamped[0],
      lng: clamped[1],
      provider: "google",
      externalUrl,
    });
  }
  return out;
}
