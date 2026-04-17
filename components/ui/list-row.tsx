import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

type ListRowProps = React.HTMLAttributes<HTMLDivElement> & {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  chevron?: boolean;
};

/**
 * Generic list row. 44pt min height (touch target).
 * leading(icon/avatar) + title + subtitle + trailing(meta/chevron).
 */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  chevron,
  className,
  ...props
}: ListRowProps) {
  return (
    <div
      className={cn(
        "border-border-primary flex min-h-11 items-center gap-3 border-b bg-transparent px-4 py-3 last:border-b-0",
        "active:bg-surface-300 transition-colors",
        className,
      )}
      {...props}
    >
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <p className="text-ink-900 truncate text-[15px] font-medium">{title}</p>
        {subtitle && (
          <p className="text-ink-600 mt-0.5 truncate text-[13px]">{subtitle}</p>
        )}
      </div>
      {trailing && <div className="text-ink-600 shrink-0 text-[13px]">{trailing}</div>}
      {chevron && (
        <ChevronRight size={18} className="text-ink-500 shrink-0" aria-hidden />
      )}
    </div>
  );
}
