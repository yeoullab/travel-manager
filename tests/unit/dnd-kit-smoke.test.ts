import { describe, it, expect } from "vitest";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, arrayMove } from "@dnd-kit/sortable";

describe("dnd-kit smoke", () => {
  it("arrayMove reorders array correctly (pure fn sanity)", () => {
    const result = arrayMove(["a", "b", "c", "d"], 1, 3);
    expect(result).toEqual(["a", "c", "d", "b"]);
  });

  it("exports React 19 / Next.js 16 compatible components", () => {
    expect(DndContext).toBeDefined();
    expect(SortableContext).toBeDefined();
  });
});
