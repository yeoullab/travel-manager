"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { TextField, TextArea } from "@/components/ui/text-field";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import { Fab } from "@/components/ui/fab";
import { useTripDetail } from "@/lib/trip/use-trip-detail";
import {
  useRecordList,
  type TripRecord,
} from "@/lib/record/use-record-list";
import { useCreateRecord } from "@/lib/record/use-create-record";
import { useUpdateRecord } from "@/lib/record/use-update-record";
import { useDeleteRecord } from "@/lib/record/use-delete-record";
import {
  buildRecordDateSchema,
  recordContentSchema,
  recordTitleSchema,
} from "@/lib/record/schema";
import { useUiStore } from "@/lib/store/ui-store";
import { cn } from "@/lib/cn";

type Props = { tripId: string };

type SheetMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; record: TripRecord };

type FormValue = {
  title: string;
  content: string;
  date: string;
};

/**
 * 10 /trips/[id]?tab=records
 *
 * 여행 기록(자유 텍스트). 카드 3줄 프리뷰 + 펼치기.
 * 제목/내용/날짜 검증 — 날짜는 trip 기간 범위 내만 허용.
 */
export function RecordsTab({ tripId }: Props) {
  const { data: trip } = useTripDetail(tripId);
  const { data: records = [], isLoading, error } = useRecordList(tripId);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sheet, setSheet] = useState<SheetMode>({ kind: "closed" });

  const createRecord = useCreateRecord();
  const updateRecord = useUpdateRecord();
  const deleteRecord = useDeleteRecord();
  const showToast = useUiStore((s) => s.showToast);

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const openCreate = () => setSheet({ kind: "create" });
  const openEdit = (record: TripRecord) => setSheet({ kind: "edit", record });
  const closeSheet = () => setSheet({ kind: "closed" });

  if (error) {
    return (
      <div className="px-4 pb-28">
        <EmptyState
          className="py-16"
          icon={<FileText size={48} strokeWidth={1.5} />}
          title="기록을 불러오지 못했어요"
          description={error.message}
        />
      </div>
    );
  }

  if (isLoading) {
    return <ListSkeleton rows={4} />;
  }

  return (
    <div className="px-4 pt-4 pb-28">
      {records.length === 0 ? (
        <EmptyState
          className="py-16"
          icon={<FileText size={48} strokeWidth={1.5} />}
          title="기록이 아직 없어요"
          description="하루를 마치고 짧은 소감을 남겨보세요."
          cta={
            <Button variant="primary" onClick={openCreate}>
              + 기록 추가
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {records.map((r) => {
            const isOpen = expanded[r.id] ?? false;
            return (
              <li key={r.id}>
                <article className="bg-surface-100 border-border-primary overflow-hidden rounded-[12px] border">
                  <button
                    type="button"
                    onClick={() => openEdit(r)}
                    className="w-full px-4 pt-4 text-left"
                  >
                    <header className="flex items-baseline justify-between">
                      <h3 className="text-ink-900 flex-1 truncate text-[17px] font-semibold tracking-[-0.005em]">
                        {r.title}
                      </h3>
                      <time className="text-ink-600 ml-3 shrink-0 font-mono text-[12px]">
                        {formatDate(r.date)}
                      </time>
                    </header>
                  </button>
                  <p
                    className={cn(
                      "text-ink-800 px-4 pt-2 text-[14px] leading-[1.6] whitespace-pre-wrap",
                      !isOpen && "line-clamp-3",
                    )}
                  >
                    {r.content}
                  </p>
                  <button
                    type="button"
                    onClick={() => toggleExpand(r.id)}
                    aria-expanded={isOpen}
                    className="text-ink-600 hover:text-error flex w-full items-center justify-center gap-1 px-4 py-3 text-[12px] font-medium transition-colors"
                  >
                    {isOpen ? "접기" : "펼쳐 보기"}
                    <ChevronDown
                      size={14}
                      className={cn("transition-transform duration-200", isOpen && "rotate-180")}
                    />
                  </button>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <Fab aria-label="기록 추가" onClick={openCreate} />

      <RecordSheet
        mode={sheet}
        tripStartDate={trip?.start_date ?? ""}
        tripEndDate={trip?.end_date ?? ""}
        onClose={closeSheet}
        onSubmitCreate={async (v) => {
          try {
            await createRecord.mutateAsync({
              tripId,
              title: v.title,
              content: v.content,
              date: v.date,
            });
            showToast("기록을 추가했어요", "success");
            closeSheet();
          } catch (err) {
            showToast(
              err instanceof Error ? err.message : "기록 추가 중 오류가 발생했어요",
              "error",
            );
          }
        }}
        onSubmitUpdate={async (v, recordId) => {
          try {
            await updateRecord.mutateAsync({
              tripId,
              recordId,
              title: v.title,
              content: v.content,
              date: v.date,
            });
            showToast("기록을 수정했어요", "success");
            closeSheet();
          } catch (err) {
            showToast(
              err instanceof Error ? err.message : "기록 수정 중 오류가 발생했어요",
              "error",
            );
          }
        }}
        onDelete={async (recordId) => {
          try {
            await deleteRecord.mutateAsync({ tripId, recordId });
            showToast("기록을 삭제했어요", "success");
            closeSheet();
          } catch (err) {
            showToast(
              err instanceof Error ? err.message : "기록 삭제 중 오류가 발생했어요",
              "error",
            );
          }
        }}
        isSaving={createRecord.isPending || updateRecord.isPending}
        isDeleting={deleteRecord.isPending}
      />
    </div>
  );
}

type SheetProps = {
  mode: SheetMode;
  tripStartDate: string;
  tripEndDate: string;
  onClose: () => void;
  onSubmitCreate: (v: FormValue) => Promise<void>;
  onSubmitUpdate: (v: FormValue, recordId: string) => Promise<void>;
  onDelete: (recordId: string) => Promise<void>;
  isSaving: boolean;
  isDeleting: boolean;
};

function RecordSheet({
  mode,
  tripStartDate,
  tripEndDate,
  onClose,
  onSubmitCreate,
  onSubmitUpdate,
  onDelete,
  isSaving,
  isDeleting,
}: SheetProps) {
  const [values, setValues] = useState<FormValue>(() =>
    buildInitialRecordValues(mode, tripStartDate),
  );
  const [errors, setErrors] = useState<Partial<Record<keyof FormValue, string>>>({});

  const sheetKey =
    mode.kind === "edit"
      ? `edit:${mode.record.id}`
      : mode.kind === "create"
        ? "create"
        : "closed";
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (mode.kind === "closed") return;
    setValues(buildInitialRecordValues(mode, tripStartDate));
    setErrors({});
  }, [sheetKey]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const dateSchema = useMemo(
    () => buildRecordDateSchema(tripStartDate, tripEndDate),
    [tripStartDate, tripEndDate],
  );

  const open = mode.kind !== "closed";
  const isEdit = mode.kind === "edit";

  const update = <K extends keyof FormValue>(key: K, v: FormValue[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const validate = (): FormValue | null => {
    const next: Partial<Record<keyof FormValue, string>> = {};
    const titleRes = recordTitleSchema.safeParse(values.title);
    if (!titleRes.success) next.title = titleRes.error.issues[0]?.message ?? "제목 오류";
    const contentRes = recordContentSchema.safeParse(values.content);
    if (!contentRes.success)
      next.content = contentRes.error.issues[0]?.message ?? "내용 오류";
    if (tripStartDate && tripEndDate) {
      const dateRes = dateSchema.safeParse(values.date);
      if (!dateRes.success) next.date = dateRes.error.issues[0]?.message ?? "날짜 오류";
    } else if (!values.date) {
      next.date = "날짜를 선택해주세요";
    }
    setErrors(next);
    return Object.keys(next).length === 0 ? values : null;
  };

  const handleSubmit = async () => {
    const valid = validate();
    if (!valid) return;
    if (mode.kind === "edit") await onSubmitUpdate(valid, mode.record.id);
    else if (mode.kind === "create") await onSubmitCreate(valid);
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={isEdit ? "기록 수정" : "기록 추가"}
      footer={
        <div className="flex w-full flex-col gap-2">
          <Button
            fullWidth
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={isSaving || isDeleting}
          >
            {isSaving ? "저장 중…" : "저장"}
          </Button>
          {isEdit && (
            <Button
              fullWidth
              size="sm"
              variant="ghost"
              onClick={() => {
                if (mode.kind !== "edit") return;
                if (confirm("이 기록을 삭제할까요?")) void onDelete(mode.record.id);
              }}
              disabled={isDeleting || isSaving}
            >
              삭제
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <TextField
          label="제목"
          placeholder="예: 첫날 후기"
          value={values.title}
          onChange={(e) => update("title", e.target.value)}
          error={errors.title}
          maxLength={100}
        />
        <TextField
          label="날짜"
          type="date"
          min={tripStartDate || undefined}
          max={tripEndDate || undefined}
          value={values.date}
          onChange={(e) => update("date", e.target.value)}
          error={errors.date}
          hint={
            !errors.date && tripStartDate && tripEndDate
              ? `${tripStartDate} ~ ${tripEndDate} 사이로 선택해주세요`
              : undefined
          }
        />
        <TextArea
          label="내용"
          placeholder="오늘 있었던 일을 자유롭게 적어보세요."
          value={values.content}
          onChange={(e) => update("content", e.target.value)}
          error={errors.content}
          rows={8}
          maxLength={20000}
          hint={!errors.content ? `${values.content.length.toLocaleString()} / 20,000자` : undefined}
        />
      </div>
    </BottomSheet>
  );
}

function buildInitialRecordValues(mode: SheetMode, tripStart: string): FormValue {
  if (mode.kind === "edit") {
    return {
      title: mode.record.title,
      content: mode.record.content,
      date: mode.record.date,
    };
  }
  return {
    title: "",
    content: "",
    date: tripStart || todayIso(),
  };
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${y.slice(2)}. ${Number(m)}. ${Number(d)}.`;
}
