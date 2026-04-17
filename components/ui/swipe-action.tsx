import * as React from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";

type SwipeActionProps = {
  /** 실제 드래그 거리(px). Phase 0 프리뷰에서는 static 값 대입. */
  offset?: number;
  children: React.ReactNode;
  className?: string;
  onDelete?: () => void;
};

/**
 * Swipe-to-delete 정적 프리뷰.
 * DESIGN.md §10.6: 80px 임계, bg error + trash icon, 80px 드래그 시 삭제.
 *
 * Phase 0에서는 offset prop을 받아 고정 상태(프리뷰)만 렌더.
 * 실제 드래그 gesture는 Phase 1 이상에서 pointer events로 구현.
 */
export function SwipeAction({ offset = 0, children, className, onDelete }: SwipeActionProps) {
  const clamped = Math.max(0, offset);
  return (
    <div className={cn("relative overflow-hidden rounded-[8px]", className)}>
      {/* Underlay */}
      <div
        aria-hidden
        className="bg-error absolute inset-0 flex items-center justify-end pr-4"
      >
        <button
          type="button"
          onClick={onDelete}
          aria-label="삭제"
          className="text-cream flex h-11 w-11 items-center justify-center"
        >
          <Trash2 size={22} strokeWidth={2} />
        </button>
      </div>
      {/* Foreground item */}
      <div
        className="bg-surface-400 relative transition-transform duration-[250ms]"
        style={{ transform: `translateX(-${clamped}px)`, transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}
      >
        {children}
      </div>
    </div>
  );
}
