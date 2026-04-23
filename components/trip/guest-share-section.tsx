"use client";

import { useState } from "react";
import { Copy, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useGuestShare } from "@/lib/guest/use-guest-share";
import { useCreateGuestShare } from "@/lib/guest/use-create-guest-share";
import { useUpdateGuestShare } from "@/lib/guest/use-update-guest-share";
import { useDeactivateGuestShare } from "@/lib/guest/use-deactivate-guest-share";
import { buildShareUrl } from "@/lib/guest/build-share-url";
import { cn } from "@/lib/cn";

type Props = {
  tripId: string;
  onFlash: (message: string) => void;
};

/**
 * manage-tab 하위 섹션. no-share / active 2 상태 분기.
 * - no-share: "게스트 링크 생성" 버튼
 * - active: 링크 표시 + 복사 + show_* 4 토글 + 비활성화 (2단 confirm)
 */
export function GuestShareSection({ tripId, onFlash }: Props) {
  const { data: share, isLoading } = useGuestShare(tripId);
  const createShare = useCreateGuestShare();
  const updateShare = useUpdateGuestShare();
  const deactivate = useDeactivateGuestShare();

  const [confirmOff, setConfirmOff] = useState(false);

  const handleCreate = async () => {
    try {
      await createShare.mutateAsync({ tripId });
      onFlash("게스트 링크를 생성했어요");
    } catch (err) {
      onFlash(err instanceof Error ? err.message : "링크 생성에 실패했어요");
    }
  };

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      onFlash("링크를 복사했어요");
    } catch {
      onFlash("복사에 실패했어요");
    }
  };

  const handleTogglePart = async (
    part: "showSchedule" | "showExpenses" | "showTodos" | "showRecords",
    next: boolean,
  ) => {
    if (!share) return;
    try {
      await updateShare.mutateAsync({
        tripId,
        shareId: share.id,
        [part]: next,
      });
    } catch (err) {
      onFlash(err instanceof Error ? err.message : "변경에 실패했어요");
    }
  };

  const handleDeactivate = async () => {
    if (!share) return;
    try {
      await deactivate.mutateAsync({ tripId, shareId: share.id });
      setConfirmOff(false);
      onFlash("게스트 공유를 비활성화했어요");
    } catch (err) {
      setConfirmOff(false);
      onFlash(err instanceof Error ? err.message : "비활성화에 실패했어요");
    }
  };

  return (
    <>
      {!share ? (
        <div className="flex flex-col gap-3 px-4 py-4">
          <p className="text-ink-700 text-[13px] leading-[1.5]">
            친구에게 링크를 보내 로그인 없이 여행을 공유할 수 있어요.
          </p>
          <Button
            variant="primary"
            onClick={() => void handleCreate()}
            disabled={createShare.isPending || isLoading}
          >
            <LinkIcon size={16} />
            게스트 링크 생성
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-4 py-4">
          <ShareLinkRow token={share.token} onCopy={handleCopy} />
          <div className="flex flex-col gap-0">
            <VisibilityToggle
              label="일정"
              value={share.show_schedule}
              disabled={updateShare.isPending}
              onChange={(v) => void handleTogglePart("showSchedule", v)}
            />
            <VisibilityToggle
              label="경비"
              value={share.show_expenses}
              disabled={updateShare.isPending}
              onChange={(v) => void handleTogglePart("showExpenses", v)}
            />
            <VisibilityToggle
              label="할 일"
              value={share.show_todos}
              disabled={updateShare.isPending}
              onChange={(v) => void handleTogglePart("showTodos", v)}
            />
            <VisibilityToggle
              label="기록"
              value={share.show_records}
              disabled={updateShare.isPending}
              onChange={(v) => void handleTogglePart("showRecords", v)}
            />
          </div>
          <Button
            variant="ghost"
            onClick={() => setConfirmOff(true)}
            disabled={deactivate.isPending}
            className="text-error"
          >
            게스트 공유 비활성화
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOff}
        onClose={() => setConfirmOff(false)}
        title="게스트 공유를 비활성화할까요?"
        description="현재 링크가 즉시 사용 불가해집니다. 다시 켜면 새 링크가 발급돼요."
        primaryLabel="비활성화"
        secondaryLabel="취소"
        destructive
        onPrimary={handleDeactivate}
      />
    </>
  );
}

function ShareLinkRow({
  token,
  onCopy,
}: {
  token: string;
  onCopy: (url: string) => void;
}) {
  const url = buildShareUrl(token);
  return (
    <div className="bg-surface-200 border-border-primary flex items-center gap-2 rounded-[8px] border px-3 py-2">
      <p className="text-ink-800 min-w-0 flex-1 truncate font-mono text-[12px]">{url}</p>
      <button
        type="button"
        aria-label="링크 복사"
        onClick={() => onCopy(url)}
        className="text-ink-600 hover:text-error shrink-0 rounded-md p-1.5 transition-colors"
      >
        <Copy size={16} />
      </button>
    </div>
  );
}

function VisibilityToggle({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="border-border-primary flex items-center justify-between border-b py-2 last:border-b-0">
      <p className="text-ink-900 text-[14px]">{label} 표시</p>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={cn(
          "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors",
          value ? "bg-accent-orange" : "bg-surface-500",
          disabled && "opacity-50",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "bg-cream absolute top-0.5 h-5 w-5 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform",
            value ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}
