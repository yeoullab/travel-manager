import React from "react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SortableScheduleItem } from "@/components/schedule/sortable-schedule-item";
import type { ScheduleItem } from "@/lib/schedule/use-schedule-list";

function makeItem(): ScheduleItem {
  return {
    id: "item-1",
    trip_day_id: "day-1",
    title: "남산 전망대",
    sort_order: 1,
    time_of_day: null,
    place_name: null,
    place_address: null,
    place_lat: null,
    place_lng: null,
    place_provider: null,
    place_external_id: null,
    place_external_url: null,
    category_code: "sightseeing",
    memo: null,
    url: null,
    created_at: "2026-05-05T00:00:00Z",
    updated_at: "2026-05-05T00:00:00Z",
  } as ScheduleItem;
}

function renderItem(onToggleSelected = vi.fn()) {
  const item = makeItem();
  const sortableChild = React.createElement(SortableScheduleItem, {
    item,
    index: 1,
    isDomestic: true,
    onTap: vi.fn(),
    selectionMode: true,
    selected: false,
    onToggleSelected,
  });
  render(
    React.createElement(
      DndContext,
      null,
      React.createElement(
        SortableContext,
        { items: [item.id] } as React.ComponentProps<typeof SortableContext>,
        sortableChild,
      ),
    ),
  );
  return { item, onToggleSelected };
}

describe("SortableScheduleItem selection mode", () => {
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

  it("renders a checkbox that toggles the selected schedule item", () => {
    const { item, onToggleSelected } = renderItem();

    const checkbox = screen.getByRole("checkbox", { name: "남산 전망대 선택" });
    expect(checkbox).not.toBeNull();

    fireEvent.click(checkbox);

    expect(onToggleSelected).toHaveBeenCalledWith(item);
  });

  it("enters selection mode from a card-body long press", () => {
    vi.useFakeTimers();
    const item = makeItem();
    const onLongPress = vi.fn();
    const onTap = vi.fn();

    render(
      React.createElement(
        DndContext,
        null,
        React.createElement(
          SortableContext,
          { items: [item.id] } as React.ComponentProps<typeof SortableContext>,
          React.createElement(SortableScheduleItem, {
            item,
            index: 1,
            isDomestic: true,
            onTap,
            onLongPress,
            selectionMode: false,
          }),
        ),
      ),
    );

    const card = screen.getByTestId("schedule-card-item-1");
    fireEvent.pointerDown(card, { clientX: 10, clientY: 10, button: 0 });
    act(() => {
      vi.advanceTimersByTime(450);
    });

    expect(onLongPress).toHaveBeenCalledWith(item);
    fireEvent.pointerUp(card);
    fireEvent.click(card);
    expect(onTap).not.toHaveBeenCalled();
  });

  it("offers an accessible button to enter selection mode without a pointer long press", () => {
    const item = makeItem();
    const onLongPress = vi.fn();

    render(
      React.createElement(
        DndContext,
        null,
        React.createElement(
          SortableContext,
          { items: [item.id] } as React.ComponentProps<typeof SortableContext>,
          React.createElement(SortableScheduleItem, {
            item,
            index: 1,
            isDomestic: true,
            onTap: vi.fn(),
            onLongPress,
            selectionMode: false,
          }),
        ),
      ),
    );

    const fallback = screen.getByRole("button", { name: "남산 전망대 선택 모드 시작" });
    expect(fallback.className).toContain("focus:not-sr-only");
    fireEvent.click(fallback);

    expect(onLongPress).toHaveBeenCalledWith(item);
  });
});
