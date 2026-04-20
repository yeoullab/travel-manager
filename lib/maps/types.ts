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
