"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Check,
  Heart,
  Trash2,
  UserMinus,
  Link as LinkIcon,
  CalendarDays,
  MapPin,
  Type,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { TextField } from "@/components/ui/text-field";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Toast } from "@/components/ui/toast";
import { getTripById, getGuestShareByTripId, getProfileName } from "@/lib/mocks";
import type { Trip } from "@/lib/types";
import { PROFILE_PARTNER_ID } from "@/lib/mocks/profiles";
import { cn } from "@/lib/cn";

type Props = { tripId: string };

type DialogKind = "delete" | "disconnect" | null;
type SheetKind = "info" | null;

/**
 * 11 /trips/[id]?tab=manage
 *
 * 여행 정보 편집 / 파트너 공유 토글 / 게스트 링크 / 위험 영역(삭제·커플 해제).
 * Phase 0 목업: 모든 변경은 토스트 연출만.
 */
export function ManageTab({ tripId }: Props) {
  const router = useRouter();
  const trip = useMemo(() => getTripById(tripId), [tripId]);
  const guestShare = useMemo(() => getGuestShareByTripId(tripId), [tripId]);

  const [partnerShared, setPartnerShared] = useState(true);
  const [guestActive, setGuestActive] = useState(Boolean(guestShare?.isActive));
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!trip) return null;

  const partnerName = getProfileName(PROFILE_PARTNER_ID);
  const shareUrl = guestShare
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${guestShare.token}`
    : "";

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard?.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      flash("링크가 복사되었어요");
    } catch {
      flash("복사할 수 없어요");
    }
  }

  function handleDelete() {
    setDialog(null);
    flash("여행이 삭제되었어요 (목업)");
    setTimeout(() => router.push("/trips"), 900);
  }

  function handleDisconnect() {
    setDialog(null);
    flash("커플 연결이 해제되었어요 (목업)");
  }

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
          value={formatRange(trip.startDate, trip.endDate)}
        />
      </ManageSection>
      <div className="mt-3">
        <Button fullWidth variant="secondary" onClick={() => setSheet("info")}>
          여행 정보 수정
        </Button>
      </div>

      {/* 파트너 공유 */}
      <ManageSection label="파트너 공유">
        <ToggleRow
          icon={<Heart size={18} className="text-error" />}
          label={`${partnerName}와 실시간 공유`}
          description={
            partnerShared
              ? "변경 사항이 파트너에게 즉시 반영돼요."
              : "파트너는 현재 이 여행을 볼 수 없어요."
          }
          value={partnerShared}
          onChange={(v) => {
            setPartnerShared(v);
            flash(v ? "파트너 공유가 켜졌어요" : "파트너 공유가 꺼졌어요");
          }}
        />
      </ManageSection>

      {/* 게스트 링크 */}
      <ManageSection label="게스트 링크">
        <ToggleRow
          icon={<Share2 size={18} className="text-ink-600" />}
          label="링크로 공유"
          description={
            guestActive
              ? "링크가 있는 누구나 읽기 전용으로 볼 수 있어요."
              : "링크를 꺼서 아무도 접근할 수 없어요."
          }
          value={guestActive}
          onChange={(v) => {
            setGuestActive(v);
            flash(v ? "링크가 활성화되었어요" : "링크가 비활성화되었어요");
          }}
        />
        {guestActive && guestShare && (
          <div className="border-border-primary border-t px-4 py-3">
            <div className="flex items-center gap-2">
              <LinkIcon size={14} className="text-ink-500 shrink-0" />
              <code className="text-ink-800 flex-1 truncate font-mono text-[12px]">
                /share/{guestShare.token}
              </code>
              <button
                type="button"
                onClick={copyShareUrl}
                aria-label="링크 복사"
                className={cn(
                  "flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-[12px] font-medium transition-colors",
                  copied
                    ? "bg-success text-cream"
                    : "bg-surface-400 text-ink-700 hover:text-ink-900",
                )}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "복사됨" : "복사"}
              </button>
            </div>
            <p className="text-ink-600 mt-2 text-[12px]">
              공개 항목: 일정
              {guestShare.showExpenses && " · 경비"}
              {guestShare.showTodos && " · 할 일"}
              {guestShare.showRecords && " · 기록"}
              {guestShare.expiresAt && (
                <>
                  {" · 만료 "}
                  {guestShare.expiresAt.slice(0, 10)}
                </>
              )}
            </p>
          </div>
        )}
      </ManageSection>

      {/* 위험 영역 */}
      <ManageSection label="위험 영역">
        <DangerRow
          icon={<UserMinus size={18} />}
          label="커플 해제"
          description="파트너가 더 이상 이 여행에 접근할 수 없어요."
          onClick={() => setDialog("disconnect")}
        />
        <DangerRow
          icon={<Trash2 size={18} />}
          label="여행 삭제"
          description="모든 일정·경비·기록이 함께 삭제됩니다."
          onClick={() => setDialog("delete")}
        />
      </ManageSection>

      <ConfirmDialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        title="여행을 삭제하시겠어요?"
        description="파트너의 데이터도 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다."
        primaryLabel="삭제"
        secondaryLabel="취소"
        destructive
        onPrimary={handleDelete}
      />

      <ConfirmDialog
        open={dialog === "disconnect"}
        onClose={() => setDialog(null)}
        title="커플 연결을 해제하시겠어요?"
        description="파트너가 더 이상 이 여행에 접근할 수 없어요. 생성자의 데이터는 유지됩니다."
        primaryLabel="해제"
        secondaryLabel="취소"
        destructive
        onPrimary={handleDisconnect}
      />

      <EditInfoSheet
        open={sheet === "info"}
        onClose={() => setSheet(null)}
        trip={trip}
        onSaved={() => {
          setSheet(null);
          flash("저장되었어요 (목업)");
        }}
      />

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

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  value: boolean;
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
      <Switch value={value} onChange={onChange} />
    </div>
  );
}

function Switch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200",
        value ? "bg-accent-orange" : "bg-surface-500",
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

function EditInfoSheet({
  open,
  onClose,
  trip,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  trip: Trip;
  onSaved: () => void;
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="여행 정보 수정"
      footer={
        <Button fullWidth variant="primary" onClick={onSaved}>
          저장
        </Button>
      }
    >
      <div className="space-y-4">
        <TextField label="제목" defaultValue={trip.title} />
        <TextField label="목적지" defaultValue={trip.destination} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="시작일" type="date" defaultValue={trip.startDate} />
          <TextField label="종료일" type="date" defaultValue={trip.endDate} />
        </div>
        <p className="text-ink-500 text-[12px]">Phase 0 목업 — 입력은 저장되지 않습니다.</p>
      </div>
    </BottomSheet>
  );
}

function formatRange(start: string, end: string): string {
  const [ys, ms, ds] = start.split("-");
  const [ye, me, de] = end.split("-");
  if (ys === ye && ms === me) return `${Number(ms)}월 ${Number(ds)}일 - ${Number(de)}일`;
  if (ys === ye) return `${Number(ms)}월 ${Number(ds)}일 - ${Number(me)}월 ${Number(de)}일`;
  return `${ys}. ${Number(ms)}. ${Number(ds)}. - ${ye}. ${Number(me)}. ${Number(de)}.`;
}
