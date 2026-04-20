"use client";

import { useRouter } from "next/navigation";
import { AppBar } from "@/components/ui/app-bar";
import { ProfileDisplayName } from "@/components/settings/profile-display-name";
import { ColorPalette } from "@/components/settings/color-palette";
import { useMyProfile } from "@/lib/profile/use-profile";
import { profileColorSchema } from "@/lib/profile/color-schema";

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { data: me } = useMyProfile();
  return (
    <div className="flex min-h-dvh flex-col" style={{ minHeight: "100dvh" }}>
      <AppBar title="프로필" onBack={() => router.push("/settings")} />
      <main className="mx-auto w-full max-w-[560px] flex-1 px-4 pt-6 pb-24 flex flex-col gap-8">
        <ProfileDisplayName />
        {me && <ColorPalette currentColor={profileColorSchema.parse(me.color)} userId={me.id} />}
      </main>
    </div>
  );
}
