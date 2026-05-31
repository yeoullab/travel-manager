import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLongPress } from "@/lib/hooks/use-long-press";

function TestButton({
  onLongPress,
  disabled = false,
}: {
  onLongPress: () => void;
  disabled?: boolean;
}) {
  const handlers = useLongPress<HTMLButtonElement>({ onLongPress, delay: 400, disabled });
  return (
    <button type="button" {...handlers}>
      target
    </button>
  );
}

describe("useLongPress", () => {
  const nativePointerEvent = window.PointerEvent;

  beforeEach(() => {
    if (!window.PointerEvent) {
      window.PointerEvent = MouseEvent as unknown as typeof PointerEvent;
    }
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.PointerEvent = nativePointerEvent;
  });

  it("fires after the configured delay", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    render(<TestButton onLongPress={onLongPress} />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "target" }), {
      clientX: 10,
      clientY: 10,
      button: 0,
    });
    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(onLongPress).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("cancels when released early", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    render(<TestButton onLongPress={onLongPress} />);

    const button = screen.getByRole("button", { name: "target" });
    fireEvent.pointerDown(button, { clientX: 10, clientY: 10, button: 0 });
    fireEvent.pointerUp(button);
    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("cancels when movement exceeds tolerance", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    render(<TestButton onLongPress={onLongPress} />);

    const button = screen.getByRole("button", { name: "target" });
    fireEvent.pointerDown(button, { clientX: 10, clientY: 10, button: 0 });
    fireEvent.pointerMove(button, { clientX: 30, clientY: 10 });
    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("clears pending timers on unmount", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const { unmount } = render(<TestButton onLongPress={onLongPress} />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "target" }), {
      clientX: 10,
      clientY: 10,
      button: 0,
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("clears an existing timer before starting another press", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    render(<TestButton onLongPress={onLongPress} />);

    const button = screen.getByRole("button", { name: "target" });
    fireEvent.pointerDown(button, { clientX: 10, clientY: 10, button: 0 });
    fireEvent.pointerDown(button, { clientX: 12, clientY: 12, button: 0 });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending timer when disabled becomes true", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const { rerender } = render(<TestButton onLongPress={onLongPress} />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "target" }), {
      clientX: 10,
      clientY: 10,
      button: 0,
    });
    rerender(<TestButton onLongPress={onLongPress} disabled />);
    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });
});
