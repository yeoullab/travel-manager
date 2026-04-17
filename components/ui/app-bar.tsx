import * as React from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/cn";

type AppBarProps = {
  title?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onBack?: () => void;
  scrolled?: boolean;
  className?: string;
};

/**
 * Sticky header. 56pt height + backdrop blur.
 * `scrolled=true` 시 하단 보더 150ms 페이드 인 (DESIGN.md §10.8).
 */
export function AppBar({
  title,
  leading,
  trailing,
  onBack,
  scrolled = false,
  className,
}: AppBarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-2 px-2",
        "bg-surface-200/80 backdrop-blur-md",
        "border-b transition-colors duration-150",
        scrolled ? "border-border-primary" : "border-transparent",
        className,
      )}
      style={{ paddingTop: "max(0px, env(safe-area-inset-top))" }}
    >
      <div className="flex min-w-[44px] items-center">
        {leading ??
          (onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="뒤로"
              className="text-ink-900 flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:text-error"
            >
              <ChevronLeft size={22} strokeWidth={2} />
            </button>
          ))}
      </div>
      <h1 className="text-ink-900 flex-1 truncate text-center text-[17px] font-semibold">
        {title}
      </h1>
      <div className="flex min-w-[44px] items-center justify-end">{trailing}</div>
    </header>
  );
}
