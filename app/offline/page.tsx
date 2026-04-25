import type { Metadata } from "next";
import { RefreshButton } from "./refresh-button";

export const metadata: Metadata = {
  title: "오프라인 — travel-manager",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="text-6xl" aria-hidden>
        ✈️
      </div>
      <h1 className="text-2xl font-semibold text-ink-900">
        오프라인 상태예요
      </h1>
      <p className="max-w-xs text-sm leading-6 text-ink-700">
        인터넷 연결이 끊어졌어요. 이미 본 일정은 계속 보이지만, 새 정보를
        불러오려면 연결을 확인해주세요.
      </p>
      <RefreshButton />
    </main>
  );
}
