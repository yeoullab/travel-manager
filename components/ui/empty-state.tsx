import * as React from "react";
import { cn } from "@/lib/cn";

type EmptyStateProps = {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  cta?: React.ReactNode;
  className?: string;
};

/**
 * Empty state pattern. Icon(48pt) + title(17/500) + description(14/400) + CTA.
 * DESIGN.md §10.8 + spec §7 Empty State Pattern.
 */
export function EmptyState({ icon, title, description, cta, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1 px-6 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <div className="text-ink-500 mb-3 text-[48px] leading-none" aria-hidden>
          {icon}
        </div>
      )}
      <p className="text-ink-900 text-[17px] font-medium">{title}</p>
      {description && (
        <p className="text-ink-600 text-[14px] leading-[1.5]">{description}</p>
      )}
      {cta && <div className="mt-6">{cta}</div>}
    </div>
  );
}
