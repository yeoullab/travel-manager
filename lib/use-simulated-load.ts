"use client";

import { useEffect, useState } from "react";

/**
 * Phase 0 전용 — mount 후 `delay`ms 동안 skeleton을 보이고 실데이터로 전환.
 * Phase 1 이후 실제 네트워크 응답으로 교체되며 훅은 제거된다.
 */
export function useSimulatedLoad(delay = 500): boolean {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return loaded;
}
