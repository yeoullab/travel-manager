"use client";

import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { useEffect, useRef, useState } from "react";

type Props = { inviteUrl: string; onGoSettings: () => void };

export function InviteCopyScreen({ inviteUrl, onGoSettings }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flash(msg: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(msg);
    timerRef.current = setTimeout(() => setToast(null), 1800);
  }

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-12 text-center">
      <p className="text-ink-900 text-[18px] font-semibold">이 링크는 당신이 만들었어요</p>
      <p className="text-ink-700 text-[14px]">파트너에게 보내주세요</p>
      <div className="bg-surface-200 w-full rounded-lg p-3 font-mono text-[12px] break-all">
        {inviteUrl}
      </div>
      <div className="flex w-full gap-3">
        <Button
          variant="ghost"
          fullWidth
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(inviteUrl);
              flash("복사되었어요");
            } catch {
              flash("복사에 실패했어요");
            }
          }}
        >
          링크 복사
        </Button>
        <Button variant="primary" fullWidth onClick={onGoSettings}>
          설정으로
        </Button>
      </div>
      {toast && <Toast message={toast} />}
    </div>
  );
}
