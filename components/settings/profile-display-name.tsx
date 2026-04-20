"use client";

import { useState } from "react";
import { useMyProfile } from "@/lib/profile/use-profile";
import { useUpdateDisplayName } from "@/lib/profile/use-update-display-name";
import { Toast } from "@/components/ui/toast";
import { TextField } from "@/components/ui/text-field";

export function ProfileDisplayName() {
  const { data: profile } = useMyProfile();
  const updateDisplayName = useUpdateDisplayName();

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    tone: "info" | "error" | "success";
  } | null>(null);

  function flash(message: string, tone: "info" | "error" | "success" = "info") {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 1800);
  }

  function startEdit() {
    setValue(profile?.display_name ?? "");
    setEditing(true);
  }

  async function handleSave() {
    const trimmed = value.trim();
    if (!trimmed) {
      flash("이름을 비워두었어요", "info");
      return;
    }
    try {
      await updateDisplayName.mutateAsync(trimmed);
      setEditing(false);
      flash("저장되었어요", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "저장 중 오류가 발생했어요";
      flash(msg, "error");
    }
  }

  function handleCancel() {
    setEditing(false);
  }

  return (
    <section>
      <h2 className="text-ink-700 mb-2 text-[13px] font-medium">표시 이름</h2>

      {editing ? (
        <div className="flex flex-col gap-3">
          <TextField
            label="이름"
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, 36))}
            placeholder="표시 이름을 입력하세요"
            maxLength={36}
            hint={`${value.length}/36`}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="bg-surface-300 text-ink-700 flex-1 rounded-[10px] py-3 text-[15px] font-medium transition-opacity active:opacity-70"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={updateDisplayName.isPending}
              className="bg-ink-900 text-cream flex-1 rounded-[10px] py-3 text-[15px] font-medium transition-opacity active:opacity-70 disabled:opacity-50"
            >
              {updateDisplayName.isPending ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      ) : (
        <div className="border-border-primary bg-surface-100 flex items-center justify-between rounded-[10px] border px-4 py-3">
          <span className="text-ink-900 text-[15px]">{profile?.display_name ?? "이름 없음"}</span>
          <button
            type="button"
            onClick={startEdit}
            className="text-ink-600 text-[13px] font-medium underline-offset-2 hover:underline"
          >
            편집
          </button>
        </div>
      )}

      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </section>
  );
}
