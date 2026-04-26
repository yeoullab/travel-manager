"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CheckSquare, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { TextField, TextArea } from "@/components/ui/text-field";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import { Fab } from "@/components/ui/fab";
import { chipClassForColor } from "@/lib/profile/colors";
import { useTripMembers } from "@/lib/profile/use-trip-members";
import { useTodoList, type Todo } from "@/lib/todo/use-todo-list";
import { useCreateTodo } from "@/lib/todo/use-create-todo";
import { useUpdateTodo } from "@/lib/todo/use-update-todo";
import { useToggleTodo } from "@/lib/todo/use-toggle-todo";
import { useDeleteTodo } from "@/lib/todo/use-delete-todo";
import { todoMemoSchema, todoTitleSchema } from "@/lib/todo/schema";
import { useUiStore } from "@/lib/store/ui-store";
import type { ProfileColor } from "@/lib/profile/color-schema";
import { cn } from "@/lib/cn";

type Props = { tripId: string };

type SheetMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; todo: Todo };

type FormValue = {
  title: string;
  memo: string;
  assignedTo: string | null;
};

/**
 * 09 /trips/[id]?tab=todos
 *
 * 할 일 체크리스트. is_completed 오름차순 → 미완료 먼저.
 * 체크박스 토글은 useToggleTodo 로 optimistic.
 */
export function TodosTab({ tripId }: Props) {
  const [sheet, setSheet] = useState<SheetMode>({ kind: "closed" });
  const { data: todos = [], isLoading, error } = useTodoList(tripId);
  const { data: members = [], lookup: lookupMember } = useTripMembers(tripId);
  const createTodo = useCreateTodo();
  const updateTodo = useUpdateTodo();
  const toggleTodo = useToggleTodo();
  const deleteTodo = useDeleteTodo();
  const showToast = useUiStore((s) => s.showToast);

  const { incomplete, complete } = useMemo(() => {
    const incomp: Todo[] = [];
    const comp: Todo[] = [];
    for (const t of todos) (t.is_completed ? comp : incomp).push(t);
    return { incomplete: incomp, complete: comp };
  }, [todos]);

  const openCreate = () => setSheet({ kind: "create" });
  const openEdit = (todo: Todo) => setSheet({ kind: "edit", todo });
  const closeSheet = () => setSheet({ kind: "closed" });

  const handleToggle = (todo: Todo) => {
    toggleTodo.mutate(
      { tripId, todoId: todo.id, complete: !todo.is_completed },
      {
        onError: (err) =>
          showToast(
            err instanceof Error ? err.message : "토글 중 오류가 발생했어요",
            "error",
          ),
      },
    );
  };

  if (error) {
    return (
      <div className="px-4 pb-28">
        <EmptyState
          className="py-16"
          icon={<CheckSquare size={48} strokeWidth={1.5} />}
          title="할 일을 불러오지 못했어요"
          description={error.message}
        />
      </div>
    );
  }

  if (isLoading) {
    return <ListSkeleton rows={4} />;
  }

  if (todos.length === 0) {
    return (
      <div className="px-4 pb-28">
        <EmptyState
          className="py-16"
          icon={<CheckSquare size={48} strokeWidth={1.5} />}
          title="할 일이 없어요"
          description="여행 전 챙겨야 할 항목을 추가해보세요."
          cta={
            <Button variant="primary" onClick={openCreate}>
              + 할 일 추가
            </Button>
          }
        />
        <TodoSheet
          mode={sheet}
          members={members}
          onClose={closeSheet}
          onSubmitCreate={async (v) => {
            try {
              await createTodo.mutateAsync({
                tripId,
                title: v.title,
                memo: v.memo.trim() === "" ? null : v.memo,
                assignedTo: v.assignedTo,
              });
              showToast("할 일을 추가했어요", "success");
              closeSheet();
            } catch (err) {
              showToast(
                err instanceof Error ? err.message : "할 일 추가 중 오류가 발생했어요",
                "error",
              );
            }
          }}
          onSubmitUpdate={async () => {
            /* not reachable in empty state */
          }}
          onDelete={async () => {
            /* not reachable */
          }}
          isSaving={createTodo.isPending}
          isDeleting={false}
        />
        <Fab aria-label="할 일 추가" onClick={openCreate} />
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-28">
      <TodoProgress incomplete={incomplete.length} total={todos.length} />

      {incomplete.length > 0 && (
        <TodoSection label="해야 할 일">
          {incomplete.map((t) => (
            <TodoRow
              key={t.id}
              title={t.title}
              memo={t.memo}
              assigneeName={lookupMember(t.assigned_to)?.display_name ?? null}
              chipClass={chipClassForColor(
                (lookupMember(t.assigned_to)?.color ?? null) as ProfileColor | null,
              )}
              checked={false}
              onToggle={() => handleToggle(t)}
              onOpen={() => openEdit(t)}
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
              assigneeName={lookupMember(t.assigned_to)?.display_name ?? null}
              chipClass={chipClassForColor(
                (lookupMember(t.assigned_to)?.color ?? null) as ProfileColor | null,
              )}
              checked
              onToggle={() => handleToggle(t)}
              onOpen={() => openEdit(t)}
            />
          ))}
        </TodoSection>
      )}

      <Fab aria-label="할 일 추가" onClick={openCreate} />

      <TodoSheet
        mode={sheet}
        members={members}
        onClose={closeSheet}
        onSubmitCreate={async (v) => {
          try {
            await createTodo.mutateAsync({
              tripId,
              title: v.title,
              memo: v.memo.trim() === "" ? null : v.memo,
              assignedTo: v.assignedTo,
            });
            showToast("할 일을 추가했어요", "success");
            closeSheet();
          } catch (err) {
            showToast(
              err instanceof Error ? err.message : "할 일 추가 중 오류가 발생했어요",
              "error",
            );
          }
        }}
        onSubmitUpdate={async (v, todoId) => {
          try {
            await updateTodo.mutateAsync({
              tripId,
              todoId,
              title: v.title,
              memo: v.memo.trim() === "" ? null : v.memo,
              assignedTo: v.assignedTo,
            });
            showToast("할 일을 수정했어요", "success");
            closeSheet();
          } catch (err) {
            showToast(
              err instanceof Error ? err.message : "할 일 수정 중 오류가 발생했어요",
              "error",
            );
          }
        }}
        onDelete={async (todoId) => {
          try {
            await deleteTodo.mutateAsync({ tripId, todoId });
            showToast("할 일을 삭제했어요", "success");
            closeSheet();
          } catch (err) {
            showToast(
              err instanceof Error ? err.message : "할 일 삭제 중 오류가 발생했어요",
              "error",
            );
          }
        }}
        isSaving={createTodo.isPending || updateTodo.isPending}
        isDeleting={deleteTodo.isPending}
      />
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
  assigneeName,
  chipClass,
  checked,
  onToggle,
  onOpen,
}: {
  title: string;
  memo: string | null;
  assigneeName: string | null;
  chipClass: ReturnType<typeof chipClassForColor>;
  checked: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <li>
      <div
        className={cn(
          "active:bg-surface-300 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={checked}
          aria-label={checked ? "완료 해제" : "완료 처리"}
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border transition-colors",
            checked
              ? "bg-accent-orange border-accent-orange text-cream"
              : "border-border-medium bg-surface-200",
          )}
        >
          {checked && <Check size={14} strokeWidth={3} />}
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 text-left"
        >
          <p
            className={cn(
              "truncate text-[15px] font-medium transition-colors",
              checked ? "text-ink-500 line-through" : "text-ink-900",
            )}
          >
            {title}
          </p>
          {memo && <p className="text-ink-600 mt-0.5 truncate text-[12px]">{memo}</p>}
        </button>
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
      </div>
    </li>
  );
}

type SheetProps = {
  mode: SheetMode;
  members: Array<{ id: string | null; display_name: string | null; color: string | null }>;
  onClose: () => void;
  onSubmitCreate: (v: FormValue) => Promise<void>;
  onSubmitUpdate: (v: FormValue, todoId: string) => Promise<void>;
  onDelete: (todoId: string) => Promise<void>;
  isSaving: boolean;
  isDeleting: boolean;
};

function TodoSheet({
  mode,
  members,
  onClose,
  onSubmitCreate,
  onSubmitUpdate,
  onDelete,
  isSaving,
  isDeleting,
}: SheetProps) {
  const [values, setValues] = useState<FormValue>(() => buildInitialTodoValues(mode));
  const [errors, setErrors] = useState<Partial<Record<keyof FormValue, string>>>({});

  const sheetKey =
    mode.kind === "edit" ? `edit:${mode.todo.id}` : mode.kind === "create" ? "create" : "closed";
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (mode.kind === "closed") return;
    setValues(buildInitialTodoValues(mode));
    setErrors({});
  }, [sheetKey]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const open = mode.kind !== "closed";
  const isEdit = mode.kind === "edit";

  const update = <K extends keyof FormValue>(key: K, v: FormValue[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const validate = (): FormValue | null => {
    const next: Partial<Record<keyof FormValue, string>> = {};
    const titleRes = todoTitleSchema.safeParse(values.title);
    if (!titleRes.success) next.title = titleRes.error.issues[0]?.message ?? "제목 오류";
    const memoRes = todoMemoSchema.safeParse(values.memo);
    if (!memoRes.success) next.memo = memoRes.error.issues[0]?.message ?? "메모 오류";
    setErrors(next);
    return Object.keys(next).length === 0 ? values : null;
  };

  const handleSubmit = async () => {
    const valid = validate();
    if (!valid) return;
    if (mode.kind === "edit") await onSubmitUpdate(valid, mode.todo.id);
    else if (mode.kind === "create") await onSubmitCreate(valid);
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={isEdit ? "할 일 수정" : "할 일 추가"}
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
                if (confirm("이 할 일을 삭제할까요?")) void onDelete(mode.todo.id);
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
          placeholder="예: 환전하기"
          value={values.title}
          onChange={(e) => update("title", e.target.value)}
          error={errors.title}
          maxLength={100}
        />
        <TextArea
          label="메모"
          placeholder="세부 내용 (선택)"
          value={values.memo}
          onChange={(e) => update("memo", e.target.value)}
          error={errors.memo}
          maxLength={1000}
        />
        <div>
          <p className="text-ink-700 mb-2 text-[13px] font-medium">담당자</p>
          <div
            role="radiogroup"
            aria-label="담당자 선택"
            className="flex flex-wrap gap-2"
          >
            <button
              type="button"
              role="radio"
              aria-checked={values.assignedTo === null}
              onClick={() => update("assignedTo", null)}
              className={cn(
                "h-9 rounded-full px-3 text-[13px] font-medium transition-colors",
                values.assignedTo === null
                  ? "bg-ink-900 text-cream"
                  : "bg-surface-400 text-ink-700 hover:text-ink-900",
              )}
            >
              공동
            </button>
            {members.map((m) => {
              const active = values.assignedTo === m.id;
              return (
                <button
                  key={m.id ?? "unknown"}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => m.id && update("assignedTo", m.id)}
                  className={cn(
                    "h-9 rounded-full px-3 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-ink-900 text-cream"
                      : "bg-surface-400 text-ink-700 hover:text-ink-900",
                  )}
                >
                  {m.display_name ?? "이름 없음"}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}

function buildInitialTodoValues(mode: SheetMode): FormValue {
  if (mode.kind === "edit") {
    return {
      title: mode.todo.title,
      memo: mode.todo.memo ?? "",
      assignedTo: mode.todo.assigned_to,
    };
  }
  return { title: "", memo: "", assignedTo: null };
}
