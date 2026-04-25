/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  Serwist,
  CacheFirst,
  NetworkOnly,
  StaleWhileRevalidate,
} from "serwist";
import { RUNTIME_CACHE_POLICIES } from "@/lib/pwa/runtime-caching";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const strategyFor = (handler: string, cacheName?: string) => {
  switch (handler) {
    case "CacheFirst":
      return new CacheFirst({ cacheName });
    case "StaleWhileRevalidate":
      return new StaleWhileRevalidate({ cacheName });
    case "NetworkOnly":
    default:
      return new NetworkOnly();
  }
};

const runtimeCaching = RUNTIME_CACHE_POLICIES.map((p) => ({
  matcher: ({ url, request }: { url: URL; request: Request }) =>
    p.match(url, request.destination as RequestDestination | undefined),
  handler: strategyFor(p.handler, p.cacheName),
  method: "GET" as const,
}));

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [...runtimeCaching, ...defaultCache],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }: { request: Request }) =>
          request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
