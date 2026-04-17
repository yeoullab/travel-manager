import * as React from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "ghost" | "light";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

const base =
  "inline-flex items-center justify-center gap-2 font-medium transition-colors duration-[150ms] ease-out active:scale-[0.97] transition-transform disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none";

const variants: Record<ButtonVariant, string> = {
  // Primary — warm surface CTA
  primary:
    "bg-surface-300 text-ink-900 hover:text-error rounded-[8px]",
  // Secondary pill — used for filters/tags
  secondary:
    "bg-surface-400 text-ink-700 hover:text-error rounded-full",
  // Tertiary pill — selected/active filter state
  tertiary:
    "bg-surface-500 text-ink-700 hover:text-error rounded-full",
  // Ghost — transparent
  ghost:
    "bg-ink-200 text-ink-600 hover:text-error rounded-[8px]",
  // Light surface — minimal
  light:
    "bg-surface-100 text-ink-900 hover:text-error rounded-[8px]",
};

const sizes: Record<ButtonSize, string> = {
  // 44x44 min touch target at sm size (adjust padding so height >=44 on mobile)
  sm: "h-9 px-3 text-[14px]",
  md: "h-11 px-4 text-[15px]", // 44pt — meets HIG min
  lg: "h-12 px-5 text-[16px]",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", fullWidth, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], fullWidth && "w-full", className)}
      {...props}
    >
      {children}
    </button>
  );
});
