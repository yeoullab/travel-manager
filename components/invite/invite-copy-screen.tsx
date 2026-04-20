"use client";

import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { useState } from "react";

type Props = { inviteUrl: string; onGoSettings: () => void };

export function InviteCopyScreen({ inviteUrl, onGoSettings }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-center gap-6 py-12 px-4 text-center">
      <p className="text-ink-900 text-[18px] font-semibold">이 링크는 당신이 만들었어요</p>
      <p className="text-ink-700 text-[14px]">파트너에게 보내주세요</p>
      <div className="bg-surface-200 rounded-lg p-3 font-mono text-[12px] break-all w-full">{inviteUrl}</div>
      <div className="flex gap-3 w-full">
        <Button variant="ghost" fullWidth onClick={() => {
          void navigator.clipboard.writeText(inviteUrl);
          setToast("복사되었어요");
          setTimeout(() => setToast(null), 1800);
        }}>링크 복사</Button>
        <Button variant="primary" fullWidth onClick={onGoSettings}>설정으로</Button>
      </div>
      {toast && <Toast message={toast} />}
    </div>
  );
}
