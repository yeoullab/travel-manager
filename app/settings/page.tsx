"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMyProfile } from "@/lib/profile/use-profile";
import { ColorPalette } from "@/components/settings/color-palette";
import { profileColorSchema } from "@/lib/profile/color-schema";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import {
  User,
  Heart,
  Tag,
  LogOut,
  ChevronRight,
  Mail,
} from "lucide-react";
import { AppBar } from "@/components/ui/app-bar";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { Group } from "@/lib/types";

// Phase 2 Task 9: mock groups 데이터 삭제. Task 16이 이 페이지를 `useMyGroup`으로 재작성하기 전까지 빈 리스트 스텁을 사용한다.
const groups: Group[] = [];

/**
 * 12 `/settings` — 설정 메뉴.
 * 프로필 / 파트너 연결 / 카테고리 관리 / 로그아웃.
 */
export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useMyProfile();
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    void getBrowserClient().auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);
  const myGroup = groups.find((g) => g.status === "active");
  const partnerConnected = Boolean(myGroup);

  const [logoutOpen, setLogoutOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }

  async function handleLogout() {
    setLogoutOpen(false);
    try {
      const res = await fetch("/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error("logout failed");
      queryClient.clear();
      flash("로그아웃되었어요");
      setTimeout(() => router.push("/"), 600);
    } catch {
      flash("로그아웃 중 문제가 발생했어요");
    }
  }

  return (
    <div className="flex min-h-dvh flex-col" style={{ minHeight: "100dvh" }}>
      <AppBar title="설정" onBack={() => router.push("/trips")} />
      <main className="mx-auto w-full max-w-[560px] flex-1 px-4 pt-4 pb-16">
        {/* Profile card */}
        <section className="bg-surface-100 border-border-primary overflow-hidden rounded-[12px] border">
          <div className="flex items-center gap-4 p-4">
            <div
              aria-hidden
              className="bg-surface-400 text-ink-800 flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[22px] font-semibold"
            >
              {me?.display_name?.slice(0, 1) ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-ink-900 truncate text-[17px] font-semibold">
                {me?.display_name ?? "Guest"}
              </p>
              <p className="text-ink-600 mt-1 flex items-center gap-1 truncate text-[12px]">
                <Mail size={12} />
                {email ?? "—"}
              </p>
            </div>
          </div>
          {me && (
            <ColorPalette
              currentColor={profileColorSchema.parse(me.color)}
              userId={me.id}
            />
          )}
        </section>

        <SettingsGroup>
          <SettingsRow
            icon={<User size={20} className="text-ink-600" />}
            title="프로필"
            subtitle="이름, 아바타 편집"
            onClick={() => flash("프로필 편집은 Phase 1에서 연결됩니다")}
          />
          <SettingsRow
            icon={<Heart size={20} className="text-error" />}
            title="파트너 연결"
            subtitle={
              partnerConnected
                ? `${myGroup?.name} · 연결됨`
                : "초대 코드로 파트너와 연결해보세요"
            }
            trailing={
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  partnerConnected
                    ? "bg-success/15 text-success"
                    : "bg-surface-400 text-ink-700",
                )}
              >
                {partnerConnected ? "연결됨" : "미연결"}
              </span>
            }
            onClick={() => flash("파트너 연결 관리는 Phase 6에서 연결됩니다")}
          />
          <SettingsRow
            icon={<Tag size={20} className="text-ink-600" />}
            title="카테고리 관리"
            subtitle="일정·경비 카테고리 커스터마이즈"
            onClick={() => flash("카테고리 관리는 Phase 6에서 연결됩니다")}
          />
        </SettingsGroup>

        <SettingsGroup>
          <SettingsRow
            icon={<LogOut size={20} className="text-error" />}
            title="로그아웃"
            danger
            onClick={() => setLogoutOpen(true)}
          />
        </SettingsGroup>

        <div className="bg-surface-300/50 border-border-primary mt-6 rounded-[8px] border px-4 py-3">
          <p className="text-ink-600 text-[12px] leading-[1.5]">
            Phase 0 목업 — 설정 변경은 저장되지 않습니다. 실제 연결은 Phase 1 이후에
            활성화됩니다.
          </p>
        </div>

        <p className="text-ink-500 mt-8 text-center text-[11px]">
          travel-manager · Phase 0 preview · v0.1.0
        </p>

        <div className="mt-4 text-center">
          <Link
            href="/design"
            className="text-ink-600 hover:text-error text-[12px] underline-offset-2 hover:underline"
          >
            디자인 시스템 팔레트 보기
          </Link>
        </div>
      </main>

      <ConfirmDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title="로그아웃하시겠어요?"
        description="다시 로그인하려면 Google 계정이 필요해요."
        primaryLabel="로그아웃"
        secondaryLabel="취소"
        destructive
        onPrimary={handleLogout}
      />

      {toast && <Toast message={toast} tone="info" />}
    </div>
  );
}

function SettingsGroup({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-surface-100 border-border-primary divide-border-primary mt-4 flex flex-col divide-y overflow-hidden rounded-[12px] border">
      {children}
    </section>
  );
}

function SettingsRow({
  icon,
  title,
  subtitle,
  trailing,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="active:bg-surface-300 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
    >
      <div aria-hidden className="shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[15px] font-medium",
            danger ? "text-error" : "text-ink-900",
          )}
        >
          {title}
        </p>
        {subtitle && (
          <p className="text-ink-600 mt-0.5 truncate text-[12px]">{subtitle}</p>
        )}
      </div>
      {trailing}
      {!danger && (
        <ChevronRight size={18} className="text-ink-500 shrink-0" aria-hidden />
      )}
    </button>
  );
}
