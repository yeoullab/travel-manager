"use client";

import { useEffect, useRef, useState } from "react";
import { getMapsProvider, providerForTrip } from "@/lib/maps/provider";
import type { MapHandle } from "@/lib/maps/types";

type MapItem = { id: string; place_lat: number; place_lng: number; label: string };

type Props = {
  isDomestic: boolean;
  items: MapItem[];
  onMarkerClick?: (itemId: string) => void;
};

export function MapPanel({ isDomestic, items, onMarkerClick }: Props) {
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
      items.map((it) => ({
        lat: it.place_lat,
        lng: it.place_lng,
        label: it.label,
        onClick: onMarkerClick ? () => onMarkerClick(it.id) : undefined,
      })),
    );
    handleRef.current.fitBounds(items.map((it) => ({ lat: it.place_lat, lng: it.place_lng })));
  }, [items, ready, onMarkerClick]);

  return (
    <div
      ref={containerRef}
      className="bg-surface-200 mt-3 h-[240px] w-full overflow-hidden rounded-[12px]"
      aria-label="지도"
    />
  );
}
