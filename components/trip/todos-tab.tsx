"use client";

import { useMemo, useState } from "react";
import { Check, CheckSquare, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { TextField, TextArea } from "@/components/ui/text-field";
import { EmptyState } from "@/components/ui/empty-state";
import { Fab } from "@/components/ui/fab";
import { getTodosByTripId } from "@/lib/mocks";
import { chipClassForColor } from "@/lib/profile/colors";
import { useTripMembers } from "@/lib/profile/use-trip-members";
import { cn } from "@/lib/cn";

type Props = { tripId: string };

/**
 * 09 /trips/[id]?tab=todos
 *
 * 할 일 체크리스트. 미완료 우선 정렬(mock helper).
 * Phase 0에서는 로컬 상태 토글만 (저장 없음).
 */
export function TodosTab({ tripId }: Props) {
  const initial = useMemo(() => getTodosByTripId(tripId), [tripId]);
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initial.map((t) => [t.id, t.isCompleted])),
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const { lookup: lookupMember } = useTripMembers(tripId);

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const incomplete = initial.filter((t) => !checked[t.id]);
  const complete = initial.filter((t) => checked[t.id]);

  if (initial.length === 0) {
    return (
      <div className="px-4 pb-28">
        <EmptyState
          className="py-16"
          icon={<CheckSquare size={48} strokeWidth={1.5} />}
          title="할 일이 없어요"
          description="여행 전 챙겨야 할 항목을 추가해보세요."
          cta={
            <Button variant="primary" onClick={() => setSheetOpen(true)}>
              + 할 일 추가
            </Button>
          }
        />
        <AddSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
        <Fab aria-label="할 일 추가" onClick={() => setSheetOpen(true)} />
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-28">
      <TodoProgress incomplete={incomplete.length} total={initial.length} />

      {incomplete.length > 0 && (
        <TodoSection label="해야 할 일">
          {incomplete.map((t) => (
            <TodoRow
              key={t.id}
              title={t.title}
              memo={t.memo}
              assignedTo={t.assignedTo}
              assigneeName={lookupMember(t.assignedTo)?.display_name ?? null}
              chipClass={chipClassForColor(lookupMember(t.assignedTo)?.color as Parameters<typeof chipClassForColor>[0])}
              checked={false}
              onToggle={() => toggle(t.id)}
            />
          ))}
        </TodoSection>
      )}

      {complete.length > 0 && (
        <TodoSection label="완료">
          {complete.map((t) => (
            <TodoRow
              key={t.id}
              title={t.title}
              memo={t.memo}
              assignedTo={t.assignedTo}
              assigneeName={lookupMember(t.assignedTo)?.display_name ?? null}
              chipClass={chipClassForColor(lookupMember(t.assignedTo)?.color as Parameters<typeof chipClassForColor>[0])}
              checked
              onToggle={() => toggle(t.id)}
            />
          ))}
        </TodoSection>
      )}

      <Fab aria-label="할 일 추가" onClick={() => setSheetOpen(true)} />
      <AddSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}

function TodoProgress({ incomplete, total }: { incomplete: number; total: number }) {
  const done = total - incomplete;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="bg-surface-100 border-border-primary rounded-[12px] border p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-ink-600 text-[11px] font-medium tracking-wider uppercase">진행도</p>
        <p className="text-ink-900 font-mono text-[18px] font-semibold">
          {done}
          <span className="text-ink-500 text-[12px] font-normal"> / {total}</span>
        </p>
      </div>
      <div className="bg-surface-300 relative mt-2 h-1.5 overflow-hidden rounded-full">
        <div
          className="bg-accent-orange h-full rounded-full transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function TodoSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="text-ink-600 mb-2 text-[11px] font-semibold tracking-wider uppercase">
        {label}
      </h3>
      <ul className="bg-surface-100 border-border-primary divide-border-primary flex flex-col divide-y overflow-hidden rounded-[12px] border">
        {children}
      </ul>
    </section>
  );
}

function TodoRow({
  title,
  memo,
  assignedTo,
  assigneeName,
  chipClass,
  checked,
  onToggle,
}: {
  title: string;
  memo: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  chipClass: ReturnType<typeof chipClassForColor>;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={checked}
        className={cn(
          "active:bg-surface-300 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
        )}
      >
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border transition-colors",
            checked
              ? "bg-accent-orange border-accent-orange text-cream"
              : "border-border-medium bg-surface-200",
          )}
          aria-hidden
        >
          {checked && <Check size={14} strokeWidth={3} />}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-[15px] font-medium transition-colors",
              checked ? "text-ink-500 line-through" : "text-ink-900",
            )}
          >
            {title}
          </p>
          {memo && <p className="text-ink-600 mt-0.5 truncate text-[12px]">{memo}</p>}
        </div>
        {assigneeName ? (
          <span
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium",
              chipClass.bg,
              chipClass.text,
            )}
          >
            <User size={10} />
            {assigneeName}
          </span>
        ) : (
          <span className="text-ink-500 flex shrink-0 items-center gap-1 text-[11px]">
            <Users size={10} />
            공동
          </span>
        )}
      </button>
    </li>
  );
}

function AddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="할 일 추가"
      footer={
        <Button fullWidth variant="primary" onClick={onClose}>
          저장
        </Button>
      }
    >
      <div className="space-y-4">
        <TextField label="제목" placeholder="예: 환전하기" />
        <TextArea label="메모" placeholder="세부 내용 (선택)" />
        <p className="text-ink-500 text-[12px]">Phase 0 목업 — 입력은 저장되지 않습니다.</p>
      </div>
    </BottomSheet>
  );
}
