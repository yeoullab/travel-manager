import type { PlaceResult } from "@/lib/maps/types";
import { getServerEnv } from "@/lib/env";
import { tm128ToWgs84 } from "@/lib/maps/tm128";
import { stripHtmlTags } from "@/lib/maps/strip-html";
import { clampLatLng } from "@/lib/maps/rate-limit";

const ENDPOINT = "https://openapi.naver.com/v1/search/local.json";

// Naver Local Search 의 mapx/mapy 포맷 자동 감지 임계값.
// - TM128 (레거시): x ≈ 100k~500k, y ≈ 200k~800k (전부 < 10M)
// - WGS84 × 10^7 (현행): Korea 기준 lng×10^7 ≈ 1.26e9, lat×10^7 ≈ 3.5e8 (전부 > 10M)
const WGS84_SCALE_THRESHOLD = 10_000_000;

type NaverItem = {
  title: string;
  link?: string;
  address?: string;
  roadAddress?: string;
  mapx: string;
  mapy: string;
};

function parseNaverCoord(mapx: number, mapy: number): [lng: number, lat: number] | null {
  if (!Number.isFinite(mapx) || !Number.isFinite(mapy)) return null;
  // 현행 Naver API: mapx=lng*10^7, mapy=lat*10^7
  if (Math.abs(mapx) > WGS84_SCALE_THRESHOLD || Math.abs(mapy) > WGS84_SCALE_THRESHOLD) {
    return [mapx / 10_000_000, mapy / 10_000_000];
  }
  // 레거시 TM128 응답
  const [lng, lat] = tm128ToWgs84(mapx, mapy);
  return [lng, lat];
}

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
    const coord = parseNaverCoord(Number(item.mapx), Number(item.mapy));
    if (!coord) continue;
    const [lng, lat] = coord;
    const clamped = clampLatLng(lat, lng);
    if (!clamped) continue;
    // §6.13: Naver Local API 의 link 필드. 모바일 deeplink (nmap://, applinks 등) 일 수
    // 있으므로 https?:// 스킴만 externalUrl 로 노출. 그 외는 undefined → place-link 헬퍼 fallback.
    const externalUrl =
      item.link && /^https?:\/\//i.test(item.link) ? item.link : undefined;
    out.push({
      externalId: `naver:${item.link || `${item.mapx},${item.mapy}`}`,
      name: stripHtmlTags(item.title),
      address: item.roadAddress || item.address || "",
      lat: clamped[0],
      lng: clamped[1],
      provider: "naver",
      externalUrl,
    });
  }
  return out;
}
