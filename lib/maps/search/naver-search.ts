import type { PlaceResult } from "@/lib/maps/types";
import { getServerEnv } from "@/lib/env";
import { tm128ToWgs84 } from "@/lib/maps/tm128";
import { stripHtmlTags } from "@/lib/maps/strip-html";
import { clampLatLng } from "@/lib/maps/rate-limit";

const ENDPOINT = "https://openapi.naver.com/v1/search/local.json";

type NaverItem = {
  title: string;
  link?: string;
  address?: string;
  roadAddress?: string;
  mapx: string;
  mapy: string;
};

export async function searchNaver(query: string): Promise<PlaceResult[]> {
  const { NAVER_SEARCH_CLIENT_ID, NAVER_SEARCH_CLIENT_SECRET } = getServerEnv();
  if (!NAVER_SEARCH_CLIENT_ID || !NAVER_SEARCH_CLIENT_SECRET) {
    throw new Error("naver_search_credentials_missing");
  }

  const url = `${ENDPOINT}?query=${encodeURIComponent(query)}&display=10`;
  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": NAVER_SEARCH_CLIENT_ID,
      "X-Naver-Client-Secret": NAVER_SEARCH_CLIENT_SECRET,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`naver search ${res.status}`);
  const body = (await res.json()) as { items?: NaverItem[] };

  const out: PlaceResult[] = [];
  for (const item of body.items ?? []) {
    const x = Number(item.mapx);
    const y = Number(item.mapy);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const [lng, lat] = tm128ToWgs84(x, y);
    const clamped = clampLatLng(lat, lng);
    if (!clamped) continue;
    out.push({
      externalId: `naver:${item.link || `${item.mapx},${item.mapy}`}`,
      name: stripHtmlTags(item.title),
      address: item.roadAddress || item.address || "",
      lat: clamped[0],
      lng: clamped[1],
      provider: "naver",
    });
  }
  return out;
}
