"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Loader2 } from "lucide-react";
import { AppBar } from "@/components/ui/app-bar";
import { Button } from "@/components/ui/button";
import { requestGoogleIdToken } from "@/lib/auth/google-id-token";
import { signInWithGoogle, signInWithGoogleRedirect } from "@/lib/auth/sign-in";
import { installGisPopupBlockedConsoleHandler } from "@/lib/auth/gis-popup-blocked";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<
    "idle" | "signing" | "redirecting" | "error" | "popup_blocked"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const redirectPath = params.get("redirect") ?? "/trips";

  useEffect(() => {
    if (!buttonRef.current) return;
    let cancelled = false;
    const restoreConsole = installGisPopupBlockedConsoleHandler(() => {
      if (cancelled) return;
      setStatus("popup_blocked");
      setErrorMsg("현재 브라우저에서 Google 로그인 팝업을 열 수 없어요.");
    });
    (async () => {
      try {
        const { idToken, rawNonce } = await requestGoogleIdToken(buttonRef.current!);
        if (cancelled) return;
        setStatus("signing");
        await signInWithGoogle({ idToken, rawNonce });
        if (cancelled) return;
        router.replace(redirectPath);
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "로그인 실패");
      }
    })();
    return () => {
      cancelled = true;
      restoreConsole();
    };
  }, [router, redirectPath]);

  async function handleRedirectSignIn() {
    try {
      setStatus("redirecting");
      setErrorMsg(null);
      await signInWithGoogleRedirect({ redirectPath });
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "리다이렉트 로그인 실패");
    }
  }

  return (
    <div className="flex w-full max-w-[360px] flex-col items-center text-center">
      <Image
        src="/icons/icon-with-text.svg"
        alt="travel-manager"
        width={220}
        height={220}
        priority
        className="mb-6 h-auto w-[220px]"
      />
      <p className="text-ink-700 mt-1 text-[15px] leading-[1.5]">
        구글 계정으로 로그인하면 파트너와 여행을 실시간으로 공유할 수 있어요.
      </p>

      <div ref={buttonRef} className="mt-10 w-full" aria-label="Google 로그인" />

      {status === "signing" && (
        <p className="text-ink-600 mt-4 flex items-center justify-center gap-2 text-[13px]">
          <Loader2 size={14} className="animate-spin" /> 로그인 중...
        </p>
      )}
      {status === "redirecting" && (
        <p className="text-ink-600 mt-4 flex items-center justify-center gap-2 text-[13px]">
          <Loader2 size={14} className="animate-spin" /> Google 로그인으로 이동 중...
        </p>
      )}
      {status === "error" && errorMsg && (
        <p className="text-error mt-4 text-[13px]">{errorMsg}</p>
      )}
      {status === "popup_blocked" && errorMsg && (
        <div className="mt-4 w-full space-y-3 text-[13px] leading-[1.55]">
          <div className="text-error space-y-1">
            <p>{errorMsg}</p>
            <p>팝업 없이 같은 탭에서 다시 시도해 주세요.</p>
          </div>
          <Button
            type="button"
            variant="light"
            size="md"
            fullWidth
            onClick={handleRedirectSignIn}
          >
            <ExternalLink size={16} aria-hidden />
            팝업 없이 Google 로그인
          </Button>
          {process.env.NODE_ENV !== "production" && (
            <p className="text-ink-600">
              Chrome에서 HTTP 431이 보이면 localhost 사이트 데이터를 삭제한 뒤 새로고침하세요.
            </p>
          )}
        </div>
      )}
      <p className="text-ink-600 mt-6 text-[12px] leading-[1.55]">
        로그인 시 이용약관과 개인정보 처리방침에 동의하는 것으로 간주됩니다.
      </p>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-dvh flex-col" style={{ minHeight: "100dvh" }}>
      <AppBar onBack={() => router.push("/")} />
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-20">
        <Suspense
          fallback={
            <div className="flex items-center justify-center">
              <Loader2 size={24} className="text-ink-500 animate-spin" />
            </div>
          }
        >
          <LoginInner />
        </Suspense>
      </main>
    </div>
  );
}
