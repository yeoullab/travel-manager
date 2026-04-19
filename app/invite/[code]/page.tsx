"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, AlertCircle, Check } from "lucide-react";
import { AppBar } from "@/components/ui/app-bar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Toast } from "@/components/ui/toast";
import { getProfileById } from "@/lib/mocks";
import type { Group } from "@/lib/types";

// Phase 2 Task 9: mock groups 데이터 삭제. Task 17이 이 페이지를 `useGroupByInviteCode`로 재작성하기 전까지 빈 리스트 스텁을 사용한다.
const groups: Group[] = [];

/**
 * 13 `/invite/[code]` — 초대 수락.
 *
 * 유효 코드는 mock의 활성 그룹 invite_code. 수락 시 연결 연출 → /trips.
 * 유효하지 않으면 안내 + 홈으로.
 */
export default function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();

  const group = useMemo(
    () => groups.find((g) => g.inviteCode === code && g.status === "active"),
    [code],
  );
  const inviter = group ? getProfileById(group.createdBy) : undefined;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function handleAccept() {
    setConfirmOpen(false);
    setAccepted(true);
    setToast("파트너와 연결되었어요 (목업)");
    setTimeout(() => router.push("/trips"), 1100);
  }

  if (!group || !inviter) {
    return (
      <div className="flex min-h-dvh flex-col" style={{ minHeight: "100dvh" }}>
        <AppBar title="초대 확인" onBack={() => router.push("/")} />
        <main className="flex-1">
          <EmptyState
            className="py-24"
            icon={<AlertCircle size={48} strokeWidth={1.5} />}
            title="유효하지 않은 초대 링크"
            description="링크가 만료되었거나 이미 사용되었을 수 있어요."
            cta={
              <Link href="/">
                <Button variant="primary">홈으로</Button>
              </Link>
            }
          />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col" style={{ minHeight: "100dvh" }}>
      <AppBar title="초대 수락" onBack={() => router.push("/")} />
      <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col items-center px-6 pt-10 pb-20 text-center">
        <div
          aria-hidden
          className="bg-surface-300 text-error mb-6 flex h-16 w-16 items-center justify-center rounded-[20px]"
          style={{
            boxShadow:
              "0 28px 70px rgba(0,0,0,0.14), 0 14px 32px rgba(0,0,0,0.1), 0 0 0 1px rgba(38,37,30,0.1)",
          }}
        >
          <Heart size={30} strokeWidth={1.75} />
        </div>

        <p className="text-ink-600 text-[11px] font-medium tracking-[0.2em] uppercase">
          Partner invite
        </p>
        <h1
          className="text-ink-900 mt-2 text-[26px] font-semibold tracking-[-0.01em]"
          style={{ lineHeight: 1.3 }}
        >
          {inviter.displayName}님이
          <br />
          함께 여행을 계획하자고 해요
        </h1>
        <p className="text-ink-700 mt-4 text-[14px] leading-[1.55]">
          수락하면 파트너의 모든 여행을 실시간으로 함께 보고 편집할 수 있어요.
          언제든 해제할 수 있습니다.
        </p>

        {/* Inviter card */}
        <div className="bg-surface-100 border-border-primary mt-8 flex w-full items-center gap-4 rounded-[12px] border p-4 text-left">
          <div
            aria-hidden
            className="bg-surface-400 text-ink-800 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[18px] font-semibold"
          >
            {inviter.displayName.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-ink-900 truncate text-[15px] font-medium">
              {inviter.displayName}
            </p>
            <p className="text-ink-600 mt-0.5 truncate text-[12px]">{inviter.email}</p>
          </div>
          <span className="bg-surface-400 text-ink-700 rounded-full px-2 py-0.5 text-[11px]">
            {group.name}
          </span>
        </div>

        <div className="mt-8 flex w-full flex-col gap-3">
          <Button
            size="lg"
            fullWidth
            variant="primary"
            disabled={accepted}
            onClick={() => setConfirmOpen(true)}
          >
            {accepted ? (
              <>
                <Check size={18} /> 연결되었어요
              </>
            ) : (
              "수락하고 함께하기"
            )}
          </Button>
          <Button variant="ghost" fullWidth size="md" onClick={() => router.push("/")}>
            나중에 하기
          </Button>
        </div>

        <p className="text-ink-500 mt-10 text-[11px]">
          초대 코드: <span className="font-mono">{code}</span> · Phase 0 목업
        </p>
      </main>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="파트너 연결을 수락하시겠어요?"
        description={`${inviter.displayName}님과 모든 여행을 실시간으로 공유하게 됩니다.`}
        primaryLabel="수락"
        secondaryLabel="취소"
        onPrimary={handleAccept}
      />

      {toast && <Toast message={toast} tone="success" />}
    </div>
  );
}
