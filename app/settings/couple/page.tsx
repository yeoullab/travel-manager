"use client";

import { useRouter } from "next/navigation";
import { AppBar } from "@/components/ui/app-bar";
import { CoupleSection } from "@/components/settings/couple-section";

export default function CoupleSettingsPage() {
  const router = useRouter();
  return (
    <div className="flex min-h-dvh flex-col" style={{ minHeight: "100dvh" }}>
      <AppBar title="파트너 연결" onBack={() => router.push("/settings")} />
      <main className="mx-auto w-full max-w-[560px] flex-1 px-4 pt-6 pb-24 flex flex-col gap-8">
        <CoupleSection />
      </main>
    </div>
  );
}
