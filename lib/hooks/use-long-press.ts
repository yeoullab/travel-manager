"use client";

import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent } from "react";

type UseLongPressOptions = {
  onLongPress: () => void;
  delay?: number;
  moveTolerance?: number;
  disabled?: boolean;
};

type Point = { x: number; y: number };

export function useLongPress<T extends HTMLElement>({
  onLongPress,
  delay = 450,
  moveTolerance = 8,
  disabled = false,
}: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<Point | null>(null);
  const didLongPressRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  const onPointerDown = useCallback(
    (event: PointerEvent<T>) => {
      if (disabled || event.button !== 0) return;
      clear();
      didLongPressRef.current = false;
      startRef.current = { x: event.clientX, y: event.clientY };
      timerRef.current = setTimeout(() => {
        didLongPressRef.current = true;
        onLongPress();
      }, delay);
    },
    [clear, delay, disabled, onLongPress],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<T>) => {
      const start = startRef.current;
      if (!start) return;
      const dx = Math.abs(event.clientX - start.x);
      const dy = Math.abs(event.clientY - start.y);
      if (dx > moveTolerance || dy > moveTolerance) clear();
    },
    [clear, moveTolerance],
  );

  const onClickCapture = useCallback((event: MouseEvent<T>) => {
    if (!didLongPressRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    didLongPressRef.current = false;
  }, []);

  useEffect(() => {
    if (disabled) clear();
  }, [clear, disabled]);

  useEffect(() => clear, [clear]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onContextMenu: clear,
    onClickCapture,
  };
}
