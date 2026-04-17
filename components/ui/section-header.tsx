import * as React from "react";
import { cn } from "@/lib/cn";

type SectionHeaderProps = React.HTMLAttributes<HTMLHeadingElement> & {
  as?: "h2" | "h3";
};

/**
 * "진행 중" / "다가오는 여행" 같은 리스트 그룹 헤더.
 * 14px semibold warm text with 24px top margin pattern.
 */
export function SectionHeader({
  as: Tag = "h2",
  className,
  children,
  ...props
}: SectionHeaderProps) {
  return (
    <Tag
      className={cn(
        "mt-6 mb-2 text-[14px] font-semibold uppercase tracking-wider text-ink-600",
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
