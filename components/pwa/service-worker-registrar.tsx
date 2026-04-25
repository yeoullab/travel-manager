"use client";

import { useEffect } from "react";

/**
 * Service Worker 등록 — production 에서만 동작.
 *
 * @serwist/turbopack 가 build 시점에 /sw.js 라우트를 정적 생성하지만,
 * 실제 등록 (`navigator.serviceWorker.register`) 은 런타임 코드가 호출해야 함.
 *
 * 정책:
 *  - process.env.NODE_ENV !== "production" → noop (dev/test 에선 SW 비활성화, HMR 충돌 회피)
 *  - 미지원 브라우저 → noop
 *  - 등록 실패 → console.warn 후 noop (PWA 미설치 상태로 우아하게 폴백)
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => {
          console.warn("[pwa] SW registration failed:", err);
        });
    };
    if (document.readyState === "complete") {
      onLoad();
    } else {
      window.addEventListener("load", onLoad, { once: true });
      return () => window.removeEventListener("load", onLoad);
    }
  }, []);
  return null;
}
