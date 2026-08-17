"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getMapsProvider, providerForTrip } from "@/lib/maps/provider";
import { markerColorsFor } from "@/lib/maps/marker-colors";
import { MapLegend } from "@/components/schedule/map-legend";
import type { MapHandle, MarkerVariant } from "@/lib/maps/types";
import { cn } from "@/lib/cn";

type MapItem = {
  id: string;
  place_lat: number;
  place_lng: number;
  label: string;
  /** 일정명 — 마커 호버(웹)/탭(모바일) 시 툴팁으로 노출 */
  title: string;
  /** schedule_items.category_code */
  category: string;
  variant: MarkerVariant;
  /** 후보 탭에서 중복 번호의 소속을 명시적으로 알릴 문구 */
  contextLabel?: string;
};

type Props = {
  isDomestic: boolean;
  items: MapItem[];
  onMarkerClick?: (itemId: string, contextLabel?: string) => void;
  focusItemId?: string | null;
  className?: string;
};

export function MapPanel({ isDomestic, items, onMarkerClick, focusItemId, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<MapHandle | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const provider = await getMapsProvider(providerForTrip(isDomestic));
      if (cancelled || !containerRef.current) return;
      const first = items[0] ?? { place_lat: 37.5665, place_lng: 126.978 };
      handleRef.current = provider.createMap(containerRef.current, {
        center: { lat: first.place_lat, lng: first.place_lng },
        zoom: 13,
      });
      setReady(true);
    })();
    return () => {
      cancelled = true;
      handleRef.current?.destroy();
      handleRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDomestic]);

  useEffect(() => {
    if (!ready || !handleRef.current) return;
    handleRef.current.clearMarkers();
    if (items.length === 0) return;
    handleRef.current.addMarkers(
      items.map((it) => {
        const { fill, textColor } = markerColorsFor(it.category);
        return {
          lat: it.place_lat,
          lng: it.place_lng,
          label: it.label,
          title: it.title,
          color: fill,
          textColor,
          variant: it.variant,
          onClick: onMarkerClick ? () => onMarkerClick(it.id, it.contextLabel) : undefined,
        };
      }),
    );
    handleRef.current.fitBounds(items.map((it) => ({ lat: it.place_lat, lng: it.place_lng })));
  }, [items, ready, onMarkerClick]);

  useEffect(() => {
    if (!ready || !handleRef.current || !focusItemId) return;
    const item = items.find((it) => it.id === focusItemId);
    if (!item) return;
    handleRef.current.setCenter({ lat: item.place_lat, lng: item.place_lng });
  }, [focusItemId, items, ready]);

  const legendCategories = useMemo(
    () => Array.from(new Set(items.map((it) => it.category))),
    [items],
  );

  return (
    <div className={cn("relative mt-3 h-[240px] w-full", className)}>
      <div
        ref={containerRef}
        className="border-border-primary bg-surface-200 h-full w-full overflow-hidden rounded-[10px] border"
        aria-label="지도"
      />
      <MapLegend categories={legendCategories} />
    </div>
  );
}
