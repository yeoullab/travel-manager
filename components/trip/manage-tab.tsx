"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Heart,
  Trash2,
  CalendarDays,
  MapPin,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Toast } from "@/components/ui/toast";
import { useTripDetail } from "@/lib/trip/use-trip-detail";
import { useMyGroup } from "@/lib/group/use-my-group";
import { usePartnerShareToggle } from "@/lib/trip/use-partner-share-toggle";
import { useDeleteTrip } from "@/lib/trip/use-delete-trip";
import { EditTripModal } from "@/components/trip/edit-trip-modal";
import { DeleteTripDialog } from "@/components/trip/delete-trip-dialog";
import { GuestShareSection } from "@/components/trip/guest-share-section";
import { cn } from "@/lib/cn";

type Props = { tripId: string };

type DialogKind = "delete" | "share-off" | null;
type SheetKind = "edit" | null;

/**
 * 11 /trips/[id]?tab=manage
 *
 * 여행 정보 편집 / 파트너 공유 토글 / 여행 삭제.
 * 게스트 링크는 Phase 6으로 이관(placeholder 배너).
 */
export function ManageTab({ tripId }: Props) {
  const router = useRouter();
  const { data: trip } = useTripDetail(tripId);
  const { data: myGroup } = useMyGroup();
  const partnerShareToggle = usePartnerShareToggle();
  const deleteTrip = useDeleteTrip();

  const [dialog, setDialog] = useState<DialogKind>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [toast, setToast] = useState<string | null>(null);

  if (!trip) return null;

  const myGroupId = myGroup?.group.id ?? null;
  const isShared = trip.group_id !== null;

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }

  async function setShareOn() {
    if (!myGroupId) {
      flash("파트너 연결이 필요해요");
      return;
    }
    try {
      await partnerShareToggle.mutateAsync({ tripId, groupId: myGroupId });
      flash("파트너 공유가 켜졌어요");
    } catch {
      flash("공유 변경에 실패했어요");
    }
  }

  async function confirmShareOff() {
    try {
      await partnerShareToggle.mutateAsync({ tripId, groupId: null });
      setDialog(null);
      flash("파트너 공유가 꺼졌어요");
    } catch {
      setDialog(null);
      flash("공유 변경에 실패했어요");
    }
  }

  async function confirmDelete() {
    try {
      await deleteTrip.mutateAsync(tripId);
      setDialog(null);
      router.push("/trips");
    } catch {
      setDialog(null);
      flash("삭제에 실패했어요");
    }
  }

  const canShare = Boolean(myGroupId);

  return (
    <div className="px-4 pt-4 pb-28">
      {/* 여행 정보 */}
      <ManageSection label="여행 정보">
        <InfoRow
          icon={<Type size={18} className="text-ink-600" />}
          label="제목"
          value={trip.title}
        />
        <InfoRow
          icon={<MapPin size={18} className="text-ink-600" />}
          label="목적지"
          value={trip.destination}
        />
        <InfoRow
          icon={<CalendarDays size={18} className="text-ink-600" />}
          label="기간"
          value={formatRange(trip.start_date, trip.end_date)}
        />
      </ManageSection>
      <div className="mt-3">
        <Button fullWidth variant="secondary" onClick={() => setSheet("edit")}>
          여행 정보 수정
        </Button>
      </div>

      {/* 파트너 공유 */}
      {canShare && (
        <ManageSection label="파트너 공유">
          <ToggleRow
            icon={<Heart size={18} className="text-error" />}
            label="파트너와 실시간 공유"
            description={
              isShared
                ? "변경 사항이 파트너에게 즉시 반영돼요."
                : "파트너는 현재 이 여행을 볼 수 없어요."
            }
            value={isShared}
            disabled={partnerShareToggle.isPending}
            onChange={(next) => {
              if (!next) {
                setDialog("share-off");
              } else {
                void setShareOn();
              }
            }}
          />
        </ManageSection>
      )}

      {/* 게스트 링크 */}
      <ManageSection label="게스트 링크">
        <GuestShareSection tripId={tripId} onFlash={flash} />
      </ManageSection>

      {/* 위험 영역 */}
      <ManageSection label="위험 영역">
        <DangerRow
          icon={<Trash2 size={18} />}
          label="여행 삭제"
          description="모든 일정·경비·기록이 함께 삭제됩니다."
          onClick={() => setDialog("delete")}
        />
      </ManageSection>

      <DeleteTripDialog
        open={dialog === "delete"}
        tripTitle={trip.title}
        isShared={isShared}
        onConfirm={confirmDelete}
        onCancel={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog === "share-off"}
        onClose={() => setDialog(null)}
        title="파트너 공유를 끌까요?"
        description="파트너가 이 여행을 더 이상 볼 수 없게 됩니다."
        primaryLabel="확인"
        secondaryLabel="취소"
        destructive
        onPrimary={confirmShareOff}
      />

      <BottomSheet
        open={sheet === "edit"}
        onClose={() => setSheet(null)}
        title="여행 정보 수정"
      >
        {sheet === "edit" && (
          <EditTripModal
            trip={trip}
            onClose={() => setSheet(null)}
            onSaved={() => flash("저장되었어요")}
          />
        )}
      </BottomSheet>

      {toast && <Toast message={toast} tone="success" />}
    </div>
  );
}

function ManageSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="text-ink-600 mb-2 text-[11px] font-semibold tracking-wider uppercase">
        {label}
      </h3>
      <div className="bg-surface-100 border-border-primary divide-border-primary flex flex-col divide-y overflow-hidden rounded-[12px] border">
        {children}
      </div>
    </section>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div aria-hidden className="shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-ink-600 text-[11px] tracking-wider uppercase">{label}</p>
        <p className="text-ink-900 mt-0.5 truncate text-[15px] font-medium">{value}</p>
      </div>
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  value,
  disabled,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  value: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div aria-hidden className="shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-ink-900 text-[15px] font-medium">{label}</p>
        {description && (
          <p className="text-ink-600 mt-0.5 text-[12px] leading-[1.4]">{description}</p>
        )}
      </div>
      <Switch value={value} disabled={disabled} onChange={onChange} />
    </div>
  );
}

function Switch({
  value,
  disabled,
  onChange,
}: {
  value: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200",
        value ? "bg-accent-orange" : "bg-surface-500",
        disabled && "opacity-50",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "bg-cream absolute top-0.5 h-6 w-6 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform duration-200",
          value ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function DangerRow({
  icon,
  label,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="active:bg-surface-300 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
    >
      <div aria-hidden className="text-error shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-error text-[15px] font-medium">{label}</p>
        {description && (
          <p className="text-ink-600 mt-0.5 text-[12px] leading-[1.4]">{description}</p>
        )}
      </div>
    </button>
  );
}

function formatRange(start: string, end: string): string {
  const [ys, ms, ds] = start.split("-");
  const [ye, me, de] = end.split("-");
  if (ys === ye && ms === me) return `${Number(ms)}월 ${Number(ds)}일 - ${Number(de)}일`;
  if (ys === ye) return `${Number(ms)}월 ${Number(ds)}일 - ${Number(me)}월 ${Number(de)}일`;
  return `${ys}. ${Number(ms)}. ${Number(ds)}. - ${ye}. ${Number(me)}. ${Number(de)}.`;
}
