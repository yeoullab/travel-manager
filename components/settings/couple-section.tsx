"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useMyGroup } from "@/lib/group/use-my-group";
import { useCreateInvite } from "@/lib/group/use-create-invite";
import { useCancelInvite } from "@/lib/group/use-cancel-invite";
import { useDissolveGroup } from "@/lib/group/use-dissolve-group";
import { buildInviteUrl } from "@/lib/group/invite-url";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Toast } from "@/components/ui/toast";

export function CoupleSection() {
  const { data: groupData, isLoading } = useMyGroup();
  const createInvite = useCreateInvite();
  const cancelInvite = useCancelInvite();
  const dissolveGroup = useDissolveGroup();

  const [dissolveOpen, setDissolveOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "info" | "error" | "success" } | null>(null);

  function flash(message: string, tone: "info" | "error" | "success" = "info") {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 1800);
  }

  async function handleCreateInvite() {
    try {
      await createInvite.mutateAsync();
    } catch {
      flash("초대 링크 생성 중 오류가 발생했어요", "error");
    }
  }

  async function handleCancel() {
    try {
      await cancelInvite.mutateAsync();
      flash("초대를 취소했어요");
    } catch {
      flash("초대 취소 중 오류가 발생했어요", "error");
    }
  }

  async function handleDissolve() {
    try {
      await dissolveGroup.mutateAsync();
      setDissolveOpen(false);
      flash("파트너 연결을 해제했어요");
    } catch {
      flash("파트너 연결 해제 중 오류가 발생했어요", "error");
    }
  }

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      flash("클립보드 복사에 실패했어요", "error");
    }
  }

  if (isLoading) {
    return (
      <div className="text-ink-500 py-8 text-center text-[14px]">불러오는 중…</div>
    );
  }

  const status = groupData?.group.status;

  // No group at all
  if (!groupData || status === "dissolved") {
    return (
      <div className="flex flex-col gap-4">
        <div className="border-border-primary bg-surface-100 rounded-[12px] border px-4 py-6 text-center">
          <p className="text-ink-700 text-[15px] font-medium">파트너가 연결되지 않았어요</p>
          <p className="text-ink-500 mt-1 text-[13px]">초대 링크를 생성해 파트너와 함께 여행을 계획해보세요.</p>
        </div>
        <button
          type="button"
          onClick={handleCreateInvite}
          disabled={createInvite.isPending}
          className="bg-ink-900 text-cream w-full rounded-[12px] py-3.5 text-[15px] font-medium transition-opacity active:opacity-70 disabled:opacity-50"
        >
          {createInvite.isPending ? "생성 중…" : "초대 링크 만들기"}
        </button>
        {toast && <Toast message={toast.message} tone={toast.tone} />}
      </div>
    );
  }

  // Pending — invite code available
  if (status === "pending") {
    const inviteCode = groupData.inviteCode;
    const inviteUrl = inviteCode
      ? buildInviteUrl(inviteCode, typeof window !== "undefined" ? window.location.origin : "")
      : null;

    return (
      <div className="flex flex-col gap-4">
        <div className="border-border-primary bg-surface-100 rounded-[12px] border px-4 py-5">
          <p className="text-ink-700 text-[13px] font-medium">초대 링크</p>
          <p className="text-ink-500 mt-1 text-[12px]">파트너가 이 링크로 접속하면 연결돼요.</p>

          {inviteUrl ? (
            <div className="border-border-primary bg-surface-200 mt-3 flex items-center gap-2 overflow-hidden rounded-[8px] border px-3 py-2">
              <p className="text-ink-800 min-w-0 flex-1 truncate text-[13px]">{inviteUrl}</p>
              <button
                type="button"
                onClick={() => handleCopy(inviteUrl)}
                className="text-ink-600 shrink-0 transition-opacity active:opacity-70"
                aria-label="링크 복사"
              >
                {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
              </button>
            </div>
          ) : (
            <p className="text-ink-500 mt-3 text-[13px]">초대 코드를 불러오는 중…</p>
          )}
        </div>

        <button
          type="button"
          onClick={handleCancel}
          disabled={cancelInvite.isPending}
          className="text-error w-full rounded-[12px] border border-current py-3.5 text-[15px] font-medium transition-opacity active:opacity-70 disabled:opacity-50"
        >
          {cancelInvite.isPending ? "취소 중…" : "초대 취소"}
        </button>

        {toast && <Toast message={toast.message} tone={toast.tone} />}
      </div>
    );
  }

  // Active — partner connected
  const partner = groupData.members.find((m) => m.role === "member");
  const partnerName = partner?.profile?.display_name ?? "파트너";

  return (
    <div className="flex flex-col gap-4">
      <div className="border-border-primary bg-surface-100 rounded-[12px] border px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="bg-success/15 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <span className="text-success text-[18px] font-semibold">
              {partnerName.slice(0, 1)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-ink-900 truncate text-[15px] font-semibold">{partnerName}</p>
            <p className="text-success mt-0.5 text-[12px] font-medium">연결됨</p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setDissolveOpen(true)}
        className="text-error w-full rounded-[12px] border border-current py-3.5 text-[15px] font-medium transition-opacity active:opacity-70"
      >
        파트너 연결 해제
      </button>

      <ConfirmDialog
        open={dissolveOpen}
        onClose={() => setDissolveOpen(false)}
        title="파트너 연결을 해제하시겠어요?"
        description="공유 중인 여행이 파트너에게서 사라집니다. 이 작업은 되돌릴 수 없어요."
        primaryLabel="해제하기"
        onPrimary={handleDissolve}
        secondaryLabel="취소"
        onSecondary={() => setDissolveOpen(false)}
        destructive
      />

      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </div>
  );
}
