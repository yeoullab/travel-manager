"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Compass, Loader2 } from "lucide-react";
import { AppBar } from "@/components/ui/app-bar";
import { cn } from "@/lib/cn";

/**
 * 02 `/login` — 구글 로그인.
 * Phase 0 목업: GIS 버튼은 더미. 클릭 시 750ms 스피너 후 /trips 로 이동.
 */
export default function LoginPage() {
  const router = useRouter();
  const [signing, setSigning] = useState(false);

  function handleGoogleSignIn() {
    if (signing) return;
    setSigning(true);
    setTimeout(() => router.push("/trips"), 750);
  }

  return (
    <div className="flex min-h-dvh flex-col" style={{ minHeight: "100dvh" }}>
      <AppBar onBack={() => router.push("/")} />

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-20">
        <div className="flex w-full max-w-[360px] flex-col items-center text-center">
          <div
            aria-hidden
            className="bg-surface-300 text-accent-orange mb-6 flex h-14 w-14 items-center justify-center rounded-[16px]"
          >
            <Compass size={26} strokeWidth={1.75} />
          </div>

          <h1 className="text-ink-900 text-[26px] font-semibold tracking-[-0.01em]">
            travel-manager에 오신 것을 환영합니다
          </h1>
          <p className="text-ink-700 mt-3 text-[15px] leading-[1.5]">
            구글 계정으로 로그인하면 파트너와 여행을 실시간으로 공유할 수 있어요.
          </p>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={signing}
            aria-label="Google로 계속하기"
            className={cn(
              "bg-surface-100 border-border-primary mt-10 flex h-12 w-full items-center justify-center gap-3 rounded-[10px] border",
              "text-ink-900 text-[15px] font-medium",
              "shadow-[0_0_16px_rgba(0,0,0,0.02),0_0_8px_rgba(0,0,0,0.008)]",
              "transition-transform duration-[100ms] ease-out active:scale-[0.98]",
              "disabled:pointer-events-none",
            )}
          >
            {signing ? (
              <Loader2 size={18} className="text-ink-600 animate-spin" />
            ) : (
              <GoogleG />
            )}
            <span>{signing ? "로그인 중..." : "Google로 계속하기"}</span>
          </button>

          <p className="text-ink-600 mt-6 text-[12px] leading-[1.55]">
            로그인 시 <span className="text-ink-800 underline-offset-2 hover:underline">이용약관</span>과{" "}
            <span className="text-ink-800 underline-offset-2 hover:underline">개인정보 처리방침</span>에 동의하는
            것으로 간주됩니다.
          </p>

          <div className="bg-surface-300/50 border-border-primary mt-10 w-full rounded-[8px] border px-4 py-3">
            <p className="text-ink-600 text-[12px] leading-[1.5]">
              Phase 0 목업 — 실제 Google 인증은 Phase 1부터 연결됩니다.
              <br />
              버튼 클릭 시 로그인한 것으로 가정하고 여행 목록으로 이동합니다.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

/** 브랜드 컬러 유지한 Google G 마크. */
function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}
