import { describe, it, expect, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  handleScheduleChange,
  __resetScheduleChannelForTest,
} from "@/lib/realtime/schedule-channel";
import { useUiStore } from "@/lib/store/ui-store";
import { queryKeys } from "@/lib/query/keys";

describe("handleScheduleChange — drag-suspend invalidate", () => {
  beforeEach(() => {
    __resetScheduleChannelForTest();
    useUiStore.setState({
      toast: null,
      showToast: () => {},
      clearToast: () => {},
      isDraggingSchedule: false,
      setDraggingSchedule: () => {},
      pendingScheduleInvalidate: false,
      setPendingScheduleInvalidate: () => {},
    });
  });

  it("드래그 중이 아니면 모든 schedule 쿼리를 invalidate 한다", () => {
    const qc = new QueryClient();
    qc.setQueryData(queryKeys.schedule.byTripId("t1"), []);
    qc.setQueryData(queryKeys.schedule.byTripId("t2"), []);
    let invalidatedCount = 0;
    const spyQc = {
      invalidateQueries: (arg: { predicate?: (q: { queryKey: unknown[] }) => boolean }) => {
        for (const q of qc.getQueryCache().getAll()) {
          if (arg.predicate?.({ queryKey: q.queryKey as unknown[] })) invalidatedCount += 1;
        }
      },
    } as unknown as QueryClient;

    handleScheduleChange(spyQc);
    expect(invalidatedCount).toBe(2);
  });

  it("드래그 중이면 pendingScheduleInvalidate 만 true 로, invalidate 는 건너뛴다", () => {
    let pending = false;
    useUiStore.setState({
      toast: null,
      showToast: () => {},
      clearToast: () => {},
      isDraggingSchedule: true,
      setDraggingSchedule: () => {},
      pendingScheduleInvalidate: false,
      setPendingScheduleInvalidate: (v: boolean) => {
        pending = v;
      },
    });
    let invalidateCalled = false;
    const qc = {
      invalidateQueries: () => {
        invalidateCalled = true;
      },
    } as unknown as QueryClient;

    handleScheduleChange(qc);
    expect(invalidateCalled).toBe(false);
    expect(pending).toBe(true);
  });
});
