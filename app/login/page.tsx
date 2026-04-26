"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AppBar } from "@/components/ui/app-bar";
import { requestGoogleIdToken } from "@/lib/auth/google-id-token";
import { signInWithGoogle } from "@/lib/auth/sign-in";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "signing" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!buttonRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const { idToken, rawNonce } = await requestGoogleIdToken(buttonRef.current!);
        if (cancelled) return;
        setStatus("signing");
        await signInWithGoogle({ idToken, rawNonce });
        if (cancelled) return;
        const redirect = params.get("redirect") ?? "/trips";
        router.replace(redirect);
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "로그인 실패");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, params]);

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
      {status === "error" && errorMsg && (
        <p className="text-error mt-4 text-[13px]">{errorMsg}</p>
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
