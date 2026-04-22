"use client";

import * as React from "react";
import { Dialog as HDialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { cn } from "@/lib/cn";

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  /** 하단 sticky CTA 영역 (선택). */
  footer?: React.ReactNode;
  className?: string;
};

/**
 * Mobile bottom sheet modal.
 * DESIGN.md §10.3: 16px top radius, drag handle, backdrop 55% ink with blur(2px),
 * sheet-enter 300ms, max-height 85vh inner-scroll, padding-bottom = safe-area + 16.
 *
 * V1에서는 실제 drag-to-dismiss는 없음(Phase 0). backdrop 클릭/ESC로 닫힘.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: BottomSheetProps) {
  return (
    <HDialog open={open} onClose={onClose} className="relative z-[100]">
      <div
        aria-hidden
        className="fixed inset-0 bg-[rgba(38,37,30,0.55)] backdrop-blur-[2px] transition-opacity duration-200"
      />
      <div className="fixed inset-x-0 bottom-0 flex justify-center">
        <DialogPanel
          className={cn(
            "bg-surface-200 w-full max-w-[640px]",
            "rounded-t-[16px]",
            "shadow-[0_-8px_32px_rgba(0,0,0,0.08)]",
            "animate-[sheet-enter_300ms_ease-out]",
            "flex max-h-[85vh] flex-col",
            className,
          )}
          style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-2 pb-3">
            <div
              aria-hidden
              className="bg-ink-400 h-1 w-10 rounded-full"
            />
          </div>
          {title && (
            <DialogTitle className="text-ink-900 px-5 pb-3 text-[17px] font-semibold">
              {title}
            </DialogTitle>
          )}
          <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
          {footer && (
            <div className="border-border-primary border-t px-5 pt-3">{footer}</div>
          )}
        </DialogPanel>
      </div>
    </HDialog>
  );
}
