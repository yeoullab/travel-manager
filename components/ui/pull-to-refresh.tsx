import * as React from "react";
import { cn } from "@/lib/cn";

type State = "idle" | "pulling" | "ready" | "refreshing" | "done";

type PullToRefreshIndicatorProps = {
  state?: State;
  /** pulling 진행률 0~1 (progress ring rotation에 사용). */
  progress?: number;
  className?: string;
};

/**
 * Pull-to-refresh 인디케이터 시각 컴포넌트 (Phase 0 정적 프리뷰).
 * 실제 제스처 처리는 Phase 1 이상에서 Framer Motion + touchstart로 구현.
 */
export function PullToRefreshIndicator({
  state = "idle",
  progress = 0,
  className,
}: PullToRefreshIndicatorProps) {
  const rotation = Math.min(360, progress * 360);
  return (
    <div
      className={cn("flex h-12 items-center justify-center gap-2", className)}
      aria-live="polite"
    >
      <div
        className={cn(
          "border-accent-orange h-[30px] w-[30px] rounded-full border-[2.5px] border-t-transparent",
          state === "refreshing" && "animate-spin",
        )}
        style={
          state !== "refreshing"
            ? { transform: `rotate(${rotation}deg)` }
            : undefined
        }
        aria-hidden
      />
      <span className="text-ink-600 text-[13px]">
        {state === "idle" && "당겨서 새로고침"}
        {state === "pulling" && "더 당겨주세요"}
        {state === "ready" && "놓으면 새로고침"}
        {state === "refreshing" && "새로고침 중..."}
        {state === "done" && "최신 상태입니다"}
      </span>
    </div>
  );
}
