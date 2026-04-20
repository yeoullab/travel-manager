import { describe, it, expect } from "vitest";
import { resolveTripsVisibilityAction } from "@/lib/realtime/trips-channel";

describe("resolveTripsVisibilityAction", () => {
  const ctx = { currentUserId: "u1", currentGroupId: "g1" };

  it("INSERT visible → invalidateList + detail", () => {
    const a = resolveTripsVisibilityAction(
      { eventType: "INSERT", old: null, new: { id: "t1", group_id: "g1", created_by: "u1" } },
      ctx,
    );
    expect(a).toEqual({ invalidateList: true, invalidateDetailId: "t1", markUnavailableId: null });
  });

  it("INSERT 비가시 → no-op", () => {
    const a = resolveTripsVisibilityAction(
      { eventType: "INSERT", old: null, new: { id: "t2", group_id: "other", created_by: "ux" } },
      ctx,
    );
    expect(a).toEqual({ invalidateList: false, invalidateDetailId: null, markUnavailableId: null });
  });

  it("UPDATE share-OFF (wasVisible && !isVisibleNow) → markUnavailable", () => {
    const a = resolveTripsVisibilityAction(
      {
        eventType: "UPDATE",
        old: { id: "t1", group_id: "g1", created_by: "ux" },
        new: { id: "t1", group_id: null, created_by: "ux" },
      },
      ctx,
    );
    expect(a).toEqual({ invalidateList: true, invalidateDetailId: null, markUnavailableId: "t1" });
  });

  it("UPDATE share-ON (!wasVisible && isVisibleNow) → invalidate detail", () => {
    const a = resolveTripsVisibilityAction(
      {
        eventType: "UPDATE",
        old: { id: "t1", group_id: null, created_by: "ux" },
        new: { id: "t1", group_id: "g1", created_by: "ux" },
      },
      ctx,
    );
    expect(a).toEqual({ invalidateList: true, invalidateDetailId: "t1", markUnavailableId: null });
  });

  it("UPDATE visible→visible → invalidate detail", () => {
    const a = resolveTripsVisibilityAction(
      {
        eventType: "UPDATE",
        old: { id: "t1", group_id: "g1", created_by: "u1" },
        new: { id: "t1", group_id: "g1", created_by: "u1" },
      },
      ctx,
    );
    expect(a).toEqual({ invalidateList: true, invalidateDetailId: "t1", markUnavailableId: null });
  });

  it("DELETE visible → markUnavailable", () => {
    const a = resolveTripsVisibilityAction(
      { eventType: "DELETE", old: { id: "t1", group_id: "g1", created_by: "u1" }, new: null },
      ctx,
    );
    expect(a).toEqual({ invalidateList: true, invalidateDetailId: null, markUnavailableId: "t1" });
  });

  it("DELETE 비가시 → no-op", () => {
    const a = resolveTripsVisibilityAction(
      { eventType: "DELETE", old: { id: "t9", group_id: "other", created_by: "ux" }, new: null },
      ctx,
    );
    expect(a).toEqual({ invalidateList: false, invalidateDetailId: null, markUnavailableId: null });
  });
});
