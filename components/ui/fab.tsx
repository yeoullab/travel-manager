import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";

type FabProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: React.ReactNode;
};

/**
 * Floating Action Button. 56×56pt, accent orange, cream icon.
 * Anchored bottom-right with safe-area + 16px offset above bottom tab bar.
 * (레이아웃에 tab bar가 없으면 bottom만 환경에 맞게 오버라이드)
 */
export function Fab({ icon, className, "aria-label": ariaLabel, ...props }: FabProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel ?? "추가"}
      className={cn(
        "fixed z-40 flex h-14 w-14 items-center justify-center",
        "bg-accent-orange text-cream rounded-full",
        "shadow-[0_28px_70px_rgba(0,0,0,0.14),0_14px_32px_rgba(0,0,0,0.1),0_0_0_1px_rgba(38,37,30,0.1)]",
        "transition-transform duration-[100ms] ease-out active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:shadow-[0_4px_12px_rgba(0,0,0,0.1)]",
        className,
      )}
      style={{
        right: "calc(16px + env(safe-area-inset-right))",
        bottom: "calc(72px + env(safe-area-inset-bottom))",
      }}
      {...props}
    >
      {icon ?? <Plus size={24} strokeWidth={2} />}
    </button>
  );
}
