"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppBar } from "@/components/ui/app-bar";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { InviteCopyScreen } from "@/components/invite/invite-copy-screen";
import { useAcceptInvite } from "@/lib/group/use-accept-invite";
import { extractInviteCode, buildInviteUrl } from "@/lib/group/invite-url";

type InviteState =
  | { type: "loading" }
  | { type: "success" }
  | { type: "own_invite"; inviteUrl: string }
  | { type: "already_connected" }
  | { type: "invalid" };

export default function InvitePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const acceptInvite = useAcceptInvite();
  const validCode = extractInviteCode(params.code);
  const [state, setState] = useState<InviteState>(
    validCode ? { type: "loading" } : { type: "invalid" },
  );
  const [toast, setToast] = useState<string | null>(null);
  const hasRun = useRef(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!validCode || hasRun.current) return;
    hasRun.current = true;

    acceptInvite
      .mutateAsync(validCode)
      .then(() => {
        setState({ type: "success" });
        setToast("파트너와 연결되었어요");
        redirectTimer.current = setTimeout(() => router.push("/trips"), 1500);
      })
      .catch((err: Error) => {
        if (err.message === "cannot_accept_own_invite") {
          setState({
            type: "own_invite",
            inviteUrl: buildInviteUrl(validCode, window.location.origin),
          });
        } else if (err.message === "already_in_active_group") {
          setState({ type: "already_connected" });
        } else {
          setState({ type: "invalid" });
        }
      });
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
    // 마운트 시 1회만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-dvh flex-col" style={{ minHeight: "100dvh" }}>
      <AppBar title="초대" onBack={() => router.push("/trips")} />
      <main className="mx-auto w-full max-w-[560px] flex-1 px-4 pt-6">
        {state.type === "loading" && (
          <p className="text-ink-600 mt-12 text-center">초대를 확인하는 중...</p>
        )}
        {state.type === "success" && (
          <p className="text-ink-900 mt-12 text-center text-[18px] font-semibold">연결되었어요!</p>
        )}
        {state.type === "own_invite" && (
          <InviteCopyScreen
            inviteUrl={state.inviteUrl}
            onGoSettings={() => router.push("/settings/couple")}
          />
        )}
        {state.type === "already_connected" && (
          <div className="mt-12 flex flex-col items-center gap-4 text-center">
            <p className="text-ink-900 text-[16px] font-semibold">이미 파트너와 연결되어 있어요</p>
            <p className="text-ink-700 text-[14px]">기존 연결을 먼저 해제해주세요</p>
            <Button variant="primary" onClick={() => router.push("/settings/couple")}>
              설정 &gt; 파트너
            </Button>
          </div>
        )}
        {state.type === "invalid" && (
          <div className="mt-12 flex flex-col items-center gap-4 text-center">
            <p className="text-ink-900 text-[16px] font-semibold">초대 링크가 만료되었어요</p>
            <p className="text-ink-700 text-[14px]">상대방에게 새 링크를 요청해주세요</p>
            <Button variant="primary" onClick={() => router.push("/trips")}>
              여행 목록으로
            </Button>
          </div>
        )}
      </main>
      {toast && <Toast message={toast} tone="success" />}
    </div>
  );
}
