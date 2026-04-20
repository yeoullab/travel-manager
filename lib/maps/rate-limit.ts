const WINDOW_MS = 60_000;
const LIMIT = 30;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function tryAcquireRateSlot(userId: string): boolean {
  const now = Date.now();
  const existing = buckets.get(userId);
  if (!existing || existing.resetAt <= now) {
    buckets.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (existing.count >= LIMIT) return false;
  existing.count += 1;
  return true;
}

export function __resetRateLimitForTest(): void {
  buckets.clear();
}

export function clampLatLng(lat: number, lng: number): [number, number] | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;
  return [lat, lng];
}
