"use client";

import * as React from "react";
import {
  Dialog as HDialog,
  DialogPanel,
  DialogTitle,
  Description,
} from "@headlessui/react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  destructive?: boolean;
};

/**
 * Confirm / Alert dialog.
 * Centered 340pt max, 16 radius, Level 3 shadow.
 * Destructive primary = error text on surface-300 bg.
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  children,
  primaryLabel = "확인",
  onPrimary,
  secondaryLabel = "취소",
  onSecondary,
  destructive,
}: DialogProps) {
  return (
    <HDialog open={open} onClose={onClose} className="relative z-50">
      <div
        className="fixed inset-0 bg-[rgba(38,37,30,0.55)] backdrop-blur-[2px]"
        aria-hidden="true"
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          className={cn(
            "bg-surface-200 w-full max-w-[340px] rounded-[16px] p-6",
            "shadow-[0_28px_70px_rgba(0,0,0,0.14),0_14px_32px_rgba(0,0,0,0.1),0_0_0_1px_rgba(38,37,30,0.1)]",
          )}
        >
          <DialogTitle className="text-ink-900 text-[18px] font-semibold">
            {title}
          </DialogTitle>
          {description && (
            <Description className="text-ink-800 mt-2 text-[15px] leading-[1.5]">
              {description}
            </Description>
          )}
          {children && <div className="mt-3 text-[14px] text-ink-700">{children}</div>}
          <div className="mt-6 flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={onSecondary ?? onClose}>
              {secondaryLabel}
            </Button>
            <Button
              variant="primary"
              onClick={onPrimary}
              className={destructive ? "text-error" : undefined}
            >
              {primaryLabel}
            </Button>
          </div>
        </DialogPanel>
      </div>
    </HDialog>
  );
}
