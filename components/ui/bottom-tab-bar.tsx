"use client";

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
 * - Active: accent orange + scale(1.05).
 * - Pressed: bg-ink-200 + scale(0.95) — 즉각 시각 ack (router.push roundtrip 보다 빠름).
 * - Optimistic active: 클릭 직후 activeKey 가 props 로 도착하기 전까지 자체 state 로 active 표시.
 */
export function BottomTabBar({ tabs, activeKey, className }: BottomTabBarProps) {
  // router.push 는 RSC payload fetch 동안 activeKey props 갱신이 지연됨. 사용자가
  // 누른 즉시 active 표시를 보여주기 위해 optimisticKey 를 자체 보유. 실제 props 가
  // 따라오면 자동 sync.
  const [optimisticKey, setOptimisticKey] = React.useState(activeKey);
  /* eslint-disable react-hooks/set-state-in-effect */
  // 부모의 activeKey props 가 RSC roundtrip 후 도착하면 optimistic state 와 sync.
  // React 19 의 set-state-in-effect 규칙은 cascade 렌더 위험 경고지만, 여기선 props →
  // local state 의 controlled-uncontrolled mirroring 패턴으로 의도된 동기화. 추가 렌더는
  // 1회만 발생하고 무한 loop 위험 없음 (deps = [activeKey]).
  React.useEffect(() => {
    setOptimisticKey(activeKey);
  }, [activeKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
          const active = tab.key === optimisticKey;
          return (
            <li key={tab.key} className="flex-1">
              <button
                type="button"
                onClick={() => {
                  setOptimisticKey(tab.key);
                  tab.onClick?.();
                }}
                aria-current={active ? "page" : undefined}
                aria-label={tab.label}
                className={cn(
                  "flex h-full w-full flex-col items-center justify-center gap-0.5",
                  "transition-all duration-150",
                  "active:scale-[0.92] active:bg-ink-200/40",
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
