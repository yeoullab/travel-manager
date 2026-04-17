import * as React from "react";
import { cn } from "@/lib/cn";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "line" | "text" | "rect" | "circle";
};

/**
 * Shimmer skeleton placeholder.
 * Base surface-300 with moving gradient (shimmer keyframe in globals.css).
 */
export function Skeleton({ variant = "line", className, style, ...props }: SkeletonProps) {
  const base =
    "relative overflow-hidden bg-surface-300 " +
    "before:absolute before:inset-0 before:content-[''] " +
    "before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)] " +
    "before:bg-[length:200%_100%] before:animate-[shimmer_1500ms_linear_infinite]";

  const shapes = {
    line: "h-3 rounded-[4px]",
    text: "h-4 rounded-[2px]",
    rect: "rounded-[8px]",
    circle: "rounded-full aspect-square",
  } as const;

  return (
    <div
      aria-hidden
      className={cn(base, shapes[variant], className)}
      style={style}
      {...props}
    />
  );
}

/**
 * Card-shaped skeleton preset: avatar + two text lines.
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-surface-400 border-border-primary rounded-[8px] border p-4",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Skeleton variant="circle" className="h-10 w-10" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" className="w-[70%]" />
          <Skeleton variant="text" className="w-[50%]" />
        </div>
      </div>
    </div>
  );
}
