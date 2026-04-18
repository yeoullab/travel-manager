"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CHIP_TONE_BY_COLOR } from "@/lib/profile/colors";
import { PROFILE_COLORS, type ProfileColor } from "@/lib/profile/color-schema";
import { getBrowserClient } from "@/lib/supabase/browser-client";
import { queryKeys } from "@/lib/query/keys";
import { useUiStore } from "@/lib/store/ui-store";
import { cn } from "@/lib/cn";

type Props = {
  currentColor: ProfileColor;
  userId: string;
};

export function ColorPalette({ currentColor, userId }: Props) {
  const [selected, setSelected] = useState<ProfileColor>(currentColor);
  const queryClient = useQueryClient();
  const showToast = useUiStore((s) => s.showToast);

  const mutation = useMutation({
    mutationFn: async (color: ProfileColor) => {
      const supabase = getBrowserClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("profiles")
        .update({ color })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.me });
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.byId(userId) });
      showToast("색상을 저장했어요", "success");
    },
    onError: () => showToast("색상 저장에 실패했어요", "error"),
  });

  function pick(color: ProfileColor) {
    setSelected(color);
    mutation.mutate(color);
  }

  return (
    <fieldset className="px-4 py-3">
      <legend className="text-ink-700 text-[13px] font-medium">프로필 색상</legend>
      <p className="text-ink-600 mt-1 text-[12px]">
        결제자·담당자 칩에 사용됩니다. 변경 효과는 다음 단계에서 모든 화면에 적용됩니다.
      </p>
      <div role="radiogroup" aria-label="프로필 색상 팔레트" className="mt-3 flex flex-wrap gap-2">
        {PROFILE_COLORS.map((color) => {
          const tone = CHIP_TONE_BY_COLOR[color];
          const isSelected = selected === color;
          return (
            <button
              key={color}
              role="radio"
              aria-checked={isSelected}
              aria-label={color}
              type="button"
              onClick={() => pick(color)}
              disabled={mutation.isPending}
              className={cn(
                "h-11 w-11 rounded-full transition-transform",
                tone.bg,
                mutation.isPending && "opacity-60",
                isSelected && "ring-2 ring-ink-900 ring-offset-2 ring-offset-surface-100 scale-105",
              )}
            />
          );
        })}
      </div>
    </fieldset>
  );
}
