export type MapsProviderName = "naver" | "google";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface PlaceResult {
  externalId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  provider: MapsProviderName;
  /** 검색 결과 출처 URL — Naver Place / Google Maps Place 페이지. https?:// 스킴만. §6.13 V1. */
  externalUrl?: string;
}

export interface MarkerSpec {
  lat: number;
  lng: number;
  label: string;
  onClick?: () => void;
}

export interface MapOptions {
  center: LatLng;
  zoom: number;
}

export interface MapHandle {
  setCenter(center: LatLng): void;
  fitBounds(points: LatLng[]): void;
  addMarkers(markers: MarkerSpec[]): void;
  clearMarkers(): void;
  destroy(): void;
}

export interface MapsProvider {
  readonly name: MapsProviderName;
  loadSdk(): Promise<void>;
  createMap(container: HTMLElement, options: MapOptions): MapHandle;
}
