import * as React from "react";
import { cn } from "@/lib/cn";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  elevated?: boolean;
  compact?: boolean;
};

const base = "bg-surface-400 border border-border-primary transition-shadow duration-200";

export function Card({ elevated, compact, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        base,
        compact ? "rounded-[4px] p-3" : "rounded-[8px] p-4",
        elevated &&
          "shadow-[0_28px_70px_rgba(0,0,0,0.14),0_14px_32px_rgba(0,0,0,0.1)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
