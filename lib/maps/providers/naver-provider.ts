import type { MapsProvider, MapHandle, MapOptions, MarkerSpec, LatLng } from "../types";
import {
  buildMarkerElement,
  closeAllMarkerTips,
  isNoHoverDevice,
  toggleMarkerTip,
} from "./marker-dom";

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
  /** 렌더된 마커 컨텐츠 DOM — 모바일 탭 툴팁 토글에 사용. */
  getElement?(): HTMLElement | null;
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

function createMap(container: HTMLElement, options: MapOptions): MapHandle {
  if (!window.naver?.maps) throw new Error("naver sdk not loaded");
  const ns = window.naver.maps;
  const map = new ns.Map(container, {
    center: new ns.LatLng(options.center.lat, options.center.lng),
    zoom: options.zoom,
  });
  // 지도 빈 곳 탭 → 열린 모바일 툴팁 모두 닫기.
  ns.Event.addListener(map, "click", () => closeAllMarkerTips());
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
        // 검증된 문자열 content 경로 유지 (naver HtmlIcon). 상호작용은 getElement() 로 재획득해 배선.
        const marker = new ns.Marker({
          position: new ns.LatLng(spec.lat, spec.lng),
          map,
          icon: { content: buildMarkerElement(spec).outerHTML },
        });
        ns.Event.addListener(marker, "click", () => {
          if (spec.title && isNoHoverDevice()) {
            const node = marker.getElement?.()?.querySelector<HTMLElement>(".tm-marker");
            if (node) toggleMarkerTip(node);
          }
          spec.onClick?.();
        });
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
