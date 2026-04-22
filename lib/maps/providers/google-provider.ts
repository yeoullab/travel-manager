import type { MapsProvider, MapHandle, MapOptions, MarkerSpec, LatLng } from "../types";

// Phase 1 `lib/auth/google-id-token.ts` 이 `Window.google = { accounts: ... }` 로 선언함.
// 서로 다른 서브필드(maps vs accounts) 를 갖는 두 declaration 을 merge 하려면 같은 파일에서
// optional union 으로 재선언해야 함 (TS2717 회피). 여기서는 런타임 cast 로 해결.
interface GoogleMapsNamespace {
  Map: new (el: HTMLElement, opts: unknown) => GoogleMapInstance;
  LatLng: new (lat: number, lng: number) => unknown;
  LatLngBounds: new () => GoogleBounds;
  marker: {
    AdvancedMarkerElement: new (opts: unknown) => GoogleMarker;
    PinElement: new (opts: unknown) => { element: HTMLElement };
  };
  importLibrary: (name: "maps" | "marker") => Promise<unknown>;
}

function gmaps(): GoogleMapsNamespace | undefined {
  return (window as unknown as { google?: { maps?: GoogleMapsNamespace } }).google?.maps;
}

interface GoogleMapInstance {
  setCenter(latlng: unknown): void;
  fitBounds(bounds: unknown): void;
}
interface GoogleBounds {
  extend(latlng: unknown): void;
}
interface GoogleMarker {
  map: GoogleMapInstance | null;
}

let loadPromise: Promise<void> | null = null;

function injectLoaderScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    // loading=async 필수: importLibrary() 기반 lazy-module 로더 활성화.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly&loading=async`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("google sdk load failed"));
    document.head.appendChild(script);
  });
}

async function loadSdk(): Promise<void> {
  if (typeof window === "undefined") return;
  // 이미 importLibrary 로 maps + marker 모두 로드된 상태면 skip
  if (gmaps()?.LatLng && gmaps()?.marker) return;
  if (loadPromise) return loadPromise;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error("missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"));
  }

  loadPromise = (async () => {
    if (!gmaps()?.importLibrary) {
      await injectLoaderScript(apiKey);
    }
    const g = gmaps();
    if (!g?.importLibrary) throw new Error("google maps importLibrary unavailable");
    // loading=async 모드에서 Map·LatLng·LatLngBounds 는 "maps" 라이브러리에,
    // AdvancedMarkerElement·PinElement 는 "marker" 라이브러리에 담겨 있음.
    await Promise.all([g.importLibrary("maps"), g.importLibrary("marker")]);
  })().catch((err) => {
    loadPromise = null;
    throw err;
  });
  return loadPromise;
}

function renderPinElement(label: string): HTMLElement {
  const gm = gmaps();
  if (!gm) throw new Error("google sdk not loaded");
  const pin = new gm.marker.PinElement({
    glyph: label,
    background: "#F54E00",
    borderColor: "#ffffff",
    glyphColor: "#ffffff",
    scale: 1,
  });
  return pin.element;
}

function createMap(container: HTMLElement, options: MapOptions): MapHandle {
  const gm = gmaps();
  if (!gm) throw new Error("google sdk not loaded");
  const map = new gm.Map(container, {
    center: new gm.LatLng(options.center.lat, options.center.lng),
    zoom: options.zoom,
    mapId: "DEMO_MAP_ID", // AdvancedMarkerElement 는 mapId 필요 — Phase 3 은 데모 ID 사용
    disableDefaultUI: false,
  });
  let markers: GoogleMarker[] = [];

  return {
    setCenter(c: LatLng) {
      map.setCenter(new gm.LatLng(c.lat, c.lng));
    },
    fitBounds(points: LatLng[]) {
      if (points.length === 0) return;
      const bounds = new gm.LatLngBounds();
      points.forEach((p) => bounds.extend(new gm.LatLng(p.lat, p.lng)));
      map.fitBounds(bounds);
    },
    addMarkers(specs: MarkerSpec[]) {
      specs.forEach((spec) => {
        const marker = new gm.marker.AdvancedMarkerElement({
          position: { lat: spec.lat, lng: spec.lng },
          map,
          content: renderPinElement(spec.label),
        });
        if (spec.onClick) {
          (marker as unknown as { addListener: (t: string, fn: () => void) => void }).addListener(
            "click",
            spec.onClick,
          );
        }
        markers.push(marker);
      });
    },
    clearMarkers() {
      markers.forEach((m) => {
        m.map = null;
      });
      markers = [];
    },
    destroy() {
      markers.forEach((m) => {
        m.map = null;
      });
      markers = [];
    },
  };
}

const provider: MapsProvider = { name: "google", loadSdk, createMap };
export default provider;
