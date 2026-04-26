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

// Google Maps JS API "Dynamic Library Import" bootstrap.
// https://developers.google.com/maps/documentation/javascript/load-maps-js-api
// URL-only `loading=async` 로는 importLibrary 가 script onload 시점까지 attach 안 될 수
// 있으므로, 공식 inline bootstrap 을 주입해 google.maps.importLibrary 를 동기적으로 노출.
function injectBootstrap(apiKey: string): void {
  const w = window as unknown as {
    google?: { maps?: { importLibrary?: unknown } };
  };
  if (w.google?.maps?.importLibrary) return;

  ((g: Record<string, string>) => {
    let h: Promise<void> | undefined;
    const w2 = window as unknown as Record<string, unknown>;
    const c = "google";
    const l = "importLibrary";
    const q = "__ib__";
    const mDoc = document;
    const base = (w2[c] ??= {}) as Record<string, unknown>;
    const d = (base.maps ??= {}) as Record<string, unknown>;
    const r = new Set<string>();
    const e = new URLSearchParams();
    const u = () =>
      h ??
      (h = new Promise<void>((resolve, reject) => {
        const a = mDoc.createElement("script");
        e.set("libraries", [...r].join(","));
        for (const k of Object.keys(g)) {
          e.set(k.replace(/[A-Z]/g, (t) => "_" + t[0].toLowerCase()), g[k]);
        }
        e.set("callback", c + ".maps." + q);
        a.src = `https://maps.${c}apis.com/maps/api/js?` + e.toString();
        (d as Record<string, unknown>)[q] = resolve;
        a.onerror = () => reject(new Error("google maps could not load"));
        a.nonce = mDoc.querySelector("script[nonce]")?.getAttribute("nonce") ?? "";
        mDoc.head.append(a);
      }));
    if (d[l]) {
      console.warn("google maps already loaded; ignoring");
    } else {
      d[l] = (f: string, ...n: unknown[]) => {
        r.add(f);
        return u().then(
          () =>
            (d as Record<string, (...a: unknown[]) => Promise<unknown>>)[l](f, ...n),
        );
      };
    }
  })({ key: apiKey, v: "weekly" });
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
    injectBootstrap(apiKey);
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
  // Naver provider 의 renderMarkerHtml 과 동일한 28×28 원형 — 일정 카드 번호와 시각 매칭.
  const el = document.createElement("div");
  el.style.cssText = [
    "background:#F54E00",
    "color:#fff",
    "width:28px",
    "height:28px",
    "border-radius:50%",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "font-weight:600",
    "font-size:13px",
    "box-shadow:0 2px 4px rgba(0,0,0,.25)",
    "border:2px solid #fff",
    "cursor:pointer",
  ].join(";");
  el.textContent = label;
  return el;
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
