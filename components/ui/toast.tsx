import * as React from "react";
import { cn } from "@/lib/cn";

type ToastProps = React.HTMLAttributes<HTMLDivElement> & {
  message: React.ReactNode;
  tone?: "info" | "error" | "success";
};

/**
 * Visual Toast component. 실제 표시/사라짐 로직은 Phase 1의 toast provider에서.
 * DESIGN.md §10.8: bg ink-900, cream text, 16 radius, Level 2 ambient, slide-up-enter.
 */
export function Toast({ message, tone = "info", className, ...props }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed left-1/2 z-50 -translate-x-1/2",
        "bg-ink-900 text-cream rounded-[16px]",
        "shadow-[0_0_16px_rgba(0,0,0,0.02),0_0_8px_rgba(0,0,0,0.008)]",
        "flex items-center gap-3 px-4 py-3",
        "animate-[slide-up-enter_250ms_ease-out]",
        "max-w-[min(400px,calc(100vw-32px))]",
        className,
      )}
      style={{ bottom: "calc(16px + env(safe-area-inset-bottom))" }}
      {...props}
    >
      {tone === "error" && (
        <span className="bg-error h-2 w-2 shrink-0 rounded-full" aria-hidden />
      )}
      {tone === "success" && (
        <span className="bg-success h-2 w-2 shrink-0 rounded-full" aria-hidden />
      )}
      <p className="text-[15px] leading-[1.4] font-medium">{message}</p>
    </div>
  );
}
