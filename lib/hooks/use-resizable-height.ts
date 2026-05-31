"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

type UseResizableHeightOptions = {
  storageKey: string;
  defaultHeight: number;
  min: number;
  max: number;
  step?: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readStorage(key: string): number | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function useResizableHeight({
  storageKey,
  defaultHeight,
  min,
  max,
  step = 12,
}: UseResizableHeightOptions) {
  // SSR-safe: read localStorage in the lazy initializer (only runs client-side).
  const [height, setHeightState] = useState(() => {
    if (typeof window === "undefined") return clamp(defaultHeight, min, max);
    const saved = readStorage(storageKey);
    return clamp(saved ?? defaultHeight, min, max);
  });

  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  // Keep a stable ref to the current handler functions so we can remove them
  // without creating circular useCallback dependencies.
  const pointerMoveRef = useRef<((e: globalThis.PointerEvent) => void) | null>(null);
  const pointerUpRef = useRef<(() => void) | null>(null);

  const persist = useCallback(
    (value: number) => {
      window.localStorage.setItem(storageKey, String(value));
    },
    [storageKey],
  );

  const setHeight = useCallback(
    (value: number) => {
      const next = clamp(value, min, max);
      setHeightState(next);
      return next;
    },
    [min, max],
  );

  // Build stable handlers via refs to avoid circular deps between move/up.
  useEffect(() => {
    const handleMove = (event: globalThis.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = event.clientY - drag.startY;
      setHeight(drag.startHeight + delta);
    };

    const handleUp = () => {
      dragRef.current = null;
      if (pointerMoveRef.current) {
        window.removeEventListener("pointermove", pointerMoveRef.current);
      }
      if (pointerUpRef.current) {
        window.removeEventListener("pointerup", pointerUpRef.current);
      }
      setHeightState((current) => {
        persist(current);
        return current;
      });
    };

    pointerMoveRef.current = handleMove;
    pointerUpRef.current = handleUp;
  }, [setHeight, persist]);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      dragRef.current = { startY: event.clientY, startHeight: height };
      if (pointerMoveRef.current) {
        window.addEventListener("pointermove", pointerMoveRef.current);
      }
      if (pointerUpRef.current) {
        window.addEventListener("pointerup", pointerUpRef.current);
      }
    },
    [height],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHeightState((current) => {
          const next = clamp(current - step, min, max);
          persist(next);
          return next;
        });
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setHeightState((current) => {
          const next = clamp(current + step, min, max);
          persist(next);
          return next;
        });
      }
    },
    [step, min, max, persist],
  );

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (pointerMoveRef.current) {
        window.removeEventListener("pointermove", pointerMoveRef.current);
      }
      if (pointerUpRef.current) {
        window.removeEventListener("pointerup", pointerUpRef.current);
      }
    };
  }, []);

  return {
    height,
    setHeight,
    handleProps: {
      onPointerDown,
      onKeyDown,
      role: "separator" as const,
      "aria-orientation": "horizontal" as const,
      tabIndex: 0,
    },
  };
}
