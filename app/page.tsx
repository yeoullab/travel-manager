import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 01 `/` — 랜딩 (로그인 CTA).
 * Phase 0 목업: 정적 hero + /login 으로 이동.
 */
export default function LandingPage() {
  return (
    <main
      className="flex flex-col items-center justify-center px-6 pt-16 pb-20"
      style={{ minHeight: "100dvh" }}
    >
      <div className="flex w-full max-w-[520px] flex-col items-center text-center">
        <div
          aria-hidden
          className="bg-surface-300 text-accent-orange mb-8 flex h-16 w-16 items-center justify-center rounded-[20px]"
          style={{
            boxShadow:
              "0 28px 70px rgba(0,0,0,0.14), 0 14px 32px rgba(0,0,0,0.1), 0 0 0 1px rgba(38,37,30,0.1)",
          }}
        >
          <Compass size={32} strokeWidth={1.75} />
        </div>

        <p className="text-ink-600 mb-3 text-[11px] font-medium tracking-[0.2em] uppercase">
          travel-manager · phase 0 mockup
        </p>

        <h1
          className="text-ink-900 font-semibold"
          style={{
            fontSize: "clamp(2.5rem, 8vw, 3.75rem)",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          함께 떠나는 여행,
          <br />
          한눈에 계획하다
        </h1>

        <p className="text-ink-700 mt-6 max-w-[380px] text-[16px] leading-[1.55]">
          커플·소그룹을 위한 여행 플래너. 일정·경비·할 일·기록을 한 곳에서,
          파트너와 실시간으로 함께.
        </p>

        <div className="mt-10 flex w-full max-w-[320px] flex-col gap-3">
          <Link href="/login" className="block w-full">
            <Button size="lg" fullWidth variant="primary">
              시작하기
            </Button>
          </Link>
          <Link href="/design" className="block w-full">
            <Button size="md" fullWidth variant="ghost">
              디자인 시스템 보기
            </Button>
          </Link>
        </div>

        <p className="text-ink-500 mt-10 text-[12px] leading-[1.5]">
          이 페이지는 프로토타입입니다. 실제 데이터는 저장되지 않습니다.
        </p>
      </div>
    </main>
  );
}
