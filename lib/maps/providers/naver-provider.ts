import type { MapsProvider, MapHandle, MapOptions, MarkerSpec, LatLng } from "../types";

declare global {
  interface Window {
    naver?: {
      maps: {
        Map: new (el: HTMLElement, opts: unknown) => NaverMapInstance;
        LatLng: new (lat: number, lng: number) => unknown;
        LatLngBounds: new () => NaverBounds;
        Marker: new (opts: unknown) => NaverMarker;
        Event: { addListener(target: unknown, type: string, fn: () => void): void };
      };
    };
  }
}

interface NaverMapInstance {
  setCenter(latlng: unknown): void;
  fitBounds(bounds: unknown): void;
  destroy?: () => void;
}
interface NaverBounds {
  extend(latlng: unknown): void;
}
interface NaverMarker {
  setMap(m: NaverMapInstance | null): void;
}

let loadPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.naver?.maps) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
    if (!clientId) {
      reject(new Error("missing NEXT_PUBLIC_NAVER_MAP_CLIENT_ID"));
      return;
    }
    const script = document.createElement("script");
    // Naver 통합 콘솔 전환(2024~)으로 ncpClientId 는 deprecated. 신규 키는 ncpKeyId 파라미터 사용.
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("naver sdk load failed"));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}

function renderMarkerHtml(label: string): string {
  return `<div style="background:#F54E00;color:#fff;width:28px;height:28px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;font-weight:600;font-size:13px;
    box-shadow:0 2px 4px rgba(0,0,0,.25);border:2px solid #fff">${label}</div>`;
}

function createMap(container: HTMLElement, options: MapOptions): MapHandle {
  if (!window.naver?.maps) throw new Error("naver sdk not loaded");
  const ns = window.naver.maps;
  const map = new ns.Map(container, {
    center: new ns.LatLng(options.center.lat, options.center.lng),
    zoom: options.zoom,
  });
  let markers: NaverMarker[] = [];

  return {
    setCenter(c: LatLng) {
      map.setCenter(new ns.LatLng(c.lat, c.lng));
    },
    fitBounds(points: LatLng[]) {
      if (points.length === 0) return;
      const bounds = new ns.LatLngBounds();
      points.forEach((p) => bounds.extend(new ns.LatLng(p.lat, p.lng)));
      map.fitBounds(bounds);
    },
    addMarkers(specs: MarkerSpec[]) {
      specs.forEach((spec) => {
        const marker = new ns.Marker({
          position: new ns.LatLng(spec.lat, spec.lng),
          map,
          icon: { content: renderMarkerHtml(spec.label) },
        });
        if (spec.onClick) ns.Event.addListener(marker, "click", spec.onClick);
        markers.push(marker);
      });
    },
    clearMarkers() {
      markers.forEach((m) => m.setMap(null));
      markers = [];
    },
    destroy() {
      markers.forEach((m) => m.setMap(null));
      markers = [];
      map.destroy?.();
    },
  };
}

const provider: MapsProvider = { name: "naver", loadSdk, createMap };
export default provider;
