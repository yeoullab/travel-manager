import React from "react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
  it("renders a checkbox that toggles the selected schedule item", () => {
    const { item, onToggleSelected } = renderItem();

    const checkbox = screen.getByRole("checkbox", { name: "남산 전망대 선택" });
    expect(checkbox).not.toBeNull();

    fireEvent.click(checkbox);

    expect(onToggleSelected).toHaveBeenCalledWith(item);
  });
});
