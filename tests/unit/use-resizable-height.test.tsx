import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useResizableHeight } from "@/lib/hooks/use-resizable-height";

const KEY = "test:map-height";

function Harness() {
  const { height, handleProps } = useResizableHeight({
    storageKey: KEY,
    defaultHeight: 280,
    min: 160,
    max: 600,
  });
  return (
    <div>
      <div data-testid="height">{height}</div>
      <div data-testid="handle" {...handleProps} />
    </div>
  );
}

function startDrag(handle: HTMLElement, fromY: number) {
  fireEvent.pointerDown(handle, { clientY: fromY, button: 0 });
}

describe("useResizableHeight", () => {
  // jsdom does not implement PointerEvent; polyfill with MouseEvent so that
  // @testing-library/dom can attach clientY / clientX to pointer events.
  const nativePointerEvent = window.PointerEvent;

  beforeEach(() => {
    if (!window.PointerEvent) {
      window.PointerEvent = MouseEvent as unknown as typeof PointerEvent;
    }
    window.localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    window.PointerEvent = nativePointerEvent;
    window.localStorage.clear();
  });

  it("starts at the default height when storage is empty", () => {
    render(<Harness />);
    expect(screen.getByTestId("height").textContent).toBe("280");
  });

  it("restores a saved height from localStorage on mount", () => {
    window.localStorage.setItem(KEY, "340");
    render(<Harness />);
    expect(screen.getByTestId("height").textContent).toBe("340");
  });

  it("increases height as the handle is dragged downward", () => {
    render(<Harness />);
    const handle = screen.getByTestId("handle");
    startDrag(handle, 100);
    act(() => {
      fireEvent.pointerMove(window, { clientY: 150 });
    });
    expect(screen.getByTestId("height").textContent).toBe("330");
  });

  it("clamps to min and max", () => {
    render(<Harness />);
    const handle = screen.getByTestId("handle");
    startDrag(handle, 500);
    act(() => {
      fireEvent.pointerMove(window, { clientY: 0 });
    });
    expect(screen.getByTestId("height").textContent).toBe("160");
    startDrag(handle, 0);
    act(() => {
      fireEvent.pointerMove(window, { clientY: 5000 });
    });
    expect(screen.getByTestId("height").textContent).toBe("600");
  });

  it("persists the height to localStorage on pointer up", () => {
    render(<Harness />);
    const handle = screen.getByTestId("handle");
    startDrag(handle, 100);
    act(() => {
      fireEvent.pointerMove(window, { clientY: 140 });
      fireEvent.pointerUp(window);
    });
    expect(window.localStorage.getItem(KEY)).toBe("320");
  });

  it("adjusts height with ArrowUp / ArrowDown keys", () => {
    render(<Harness />);
    const handle = screen.getByTestId("handle");
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(screen.getByTestId("height").textContent).toBe("268");
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(screen.getByTestId("height").textContent).toBe("292");
  });
});
