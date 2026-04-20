"use client";

import { useMutation } from "@tanstack/react-query";
import type { PlaceResult, MapsProviderName, LatLng } from "@/lib/maps/types";

type SearchInput = {
  query: string;
  provider: MapsProviderName;
  near?: LatLng;
};

type Resp = { results: PlaceResult[] } | { error: string; detail?: string };

export function usePlaceSearch() {
  return useMutation({
    mutationFn: async (input: SearchInput): Promise<PlaceResult[]> => {
      const res = await fetch("/api/maps/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = (await res.json()) as Resp;
      if (!res.ok || "error" in body) {
        const msg = "error" in body ? body.error : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      return body.results;
    },
  });
}
