import * as React from "react";
import { cn } from "@/lib/cn";

export type BottomTab = {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  onClick?: () => void;
};

type BottomTabBarProps = {
  tabs: BottomTab[];
  activeKey: string;
  className?: string;
};

/**
 * Bottom tab bar. 56pt + safe-area-bottom. Max 5 tabs.
 * Active: accent orange + scale(1.05). Inactive: 55% ink.
 */
export function BottomTabBar({ tabs, activeKey, className }: BottomTabBarProps) {
  return (
    <nav
      className={cn(
        "fixed right-0 bottom-0 left-0 z-40",
        "bg-surface-200/80 backdrop-blur-md",
        "border-border-primary border-t",
        className,
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex h-14 items-stretch">
        {tabs.slice(0, 5).map((tab) => {
          const Icon = tab.icon;
          const active = tab.key === activeKey;
          return (
            <li key={tab.key} className="flex-1">
              <button
                type="button"
                onClick={tab.onClick}
                aria-current={active ? "page" : undefined}
                aria-label={tab.label}
                className={cn(
                  "flex h-full w-full flex-col items-center justify-center gap-0.5 transition-transform",
                  active ? "text-accent-orange scale-[1.05]" : "text-ink-600",
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.25 : 1.75} />
                <span
                  className={cn(
                    "text-[11px]",
                    active ? "font-medium" : "font-normal",
                  )}
                >
                  {tab.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
