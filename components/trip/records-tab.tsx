"use client";

import { useMemo, useState } from "react";
import { FileText, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { TextField, TextArea } from "@/components/ui/text-field";
import { EmptyState } from "@/components/ui/empty-state";
import { Fab } from "@/components/ui/fab";
import { getRecordsByTripId } from "@/lib/mocks";
import { cn } from "@/lib/cn";

type Props = { tripId: string };

/**
 * 10 /trips/[id]?tab=records
 *
 * 여행 기록(자유 텍스트). 카드 3줄 프리뷰 + 펼치기.
 * Phase 0 목업: 저장 연출 없음.
 */
export function RecordsTab({ tripId }: Props) {
  const records = useMemo(() => getRecordsByTripId(tripId), [tripId]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sheetOpen, setSheetOpen] = useState(false);

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
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
            <Button variant="primary" onClick={() => setSheetOpen(true)}>
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
                  <header className="flex items-baseline justify-between px-4 pt-4">
                    <h3 className="text-ink-900 flex-1 truncate text-[17px] font-semibold tracking-[-0.005em]">
                      {r.title}
                    </h3>
                    <time className="text-ink-600 ml-3 shrink-0 font-mono text-[12px]">
                      {formatDate(r.date)}
                    </time>
                  </header>
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
                      className={cn(
                        "transition-transform duration-200",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <Fab aria-label="기록 추가" onClick={() => setSheetOpen(true)} />

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="기록 추가"
        footer={
          <Button fullWidth variant="primary" onClick={() => setSheetOpen(false)}>
            저장
          </Button>
        }
      >
        <div className="space-y-4">
          <TextField label="제목" placeholder="예: 첫날 후기" />
          <TextField label="날짜" type="date" />
          <TextArea label="내용" placeholder="오늘 있었던 일을 자유롭게 적어보세요." />
          <p className="text-ink-500 text-[12px]">
            Phase 0 목업 — 입력은 저장되지 않습니다.
          </p>
        </div>
      </BottomSheet>
    </div>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${y.slice(2)}. ${Number(m)}. ${Number(d)}.`;
}
