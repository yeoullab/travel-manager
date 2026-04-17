"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppBar } from "@/components/ui/app-bar";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

const CURRENCIES = ["KRW", "JPY", "USD", "EUR", "CNY", "THB"];

/**
 * 05 `/trips/new` — 여행 만들기.
 *
 * 필드: 제목 / 목적지 / 시작일 / 종료일 / 국내·해외 / 통화.
 * Phase 0 목업: 저장 없이 1.1초 후 토스트 + /trips 이동.
 */
export default function NewTripPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [isDomestic, setIsDomestic] = useState(false);
  const [currencies, setCurrencies] = useState<string[]>(["KRW"]);
  const [submitting, setSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const valid =
    title.trim().length >= 2 &&
    destination.trim().length >= 1 &&
    start &&
    end &&
    start <= end &&
    currencies.length > 0;

  function toggleCurrency(c: string) {
    setCurrencies((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setShowToast(true);
    setTimeout(() => router.push("/trips"), 1100);
  }

  return (
    <div className="flex min-h-dvh flex-col" style={{ minHeight: "100dvh" }}>
      <AppBar title="새 여행" onBack={() => router.push("/trips")} />
      <form
        className="mx-auto w-full max-w-[560px] flex-1 px-4 pt-4 pb-24"
        onSubmit={handleSubmit}
      >
        <div className="flex flex-col gap-5">
          <TextField
            label="여행 제목"
            placeholder="예: 도쿄 3박 4일"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextField
            label="목적지"
            placeholder="예: 도쿄, 일본"
            required
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="시작일"
              type="date"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
            <TextField
              label="종료일"
              type="date"
              required
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              min={start || undefined}
              error={start && end && start > end ? "종료일이 시작일보다 빨라요" : undefined}
            />
          </div>

          <div>
            <p className="text-ink-700 mb-2 text-[13px] font-medium">여행 종류</p>
            <div className="grid grid-cols-2 gap-2">
              <SegmentedButton active={!isDomestic} onClick={() => setIsDomestic(false)}>
                해외
              </SegmentedButton>
              <SegmentedButton active={isDomestic} onClick={() => setIsDomestic(true)}>
                국내
              </SegmentedButton>
            </div>
          </div>

          <div>
            <p className="text-ink-700 mb-2 text-[13px] font-medium">사용 통화</p>
            <div className="flex flex-wrap gap-2">
              {CURRENCIES.map((c) => {
                const selected = currencies.includes(c);
                return (
                  <button
                    type="button"
                    key={c}
                    onClick={() => toggleCurrency(c)}
                    className={cn(
                      "h-9 rounded-full px-4 text-[13px] font-medium transition-colors",
                      selected
                        ? "bg-ink-900 text-cream"
                        : "bg-surface-400 text-ink-700 hover:text-ink-900",
                    )}
                    aria-pressed={selected}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            <p className="text-ink-600 mt-2 text-[12px]">최소 1개 이상 선택해주세요.</p>
          </div>

          <div className="bg-surface-300/50 border-border-primary rounded-[8px] border p-4">
            <p className="text-ink-600 text-[12px] leading-[1.5]">
              Phase 0 목업 — 저장되지 않으며 생성 버튼은 여행 목록으로 이동하는 연출만
              수행합니다.
            </p>
          </div>
        </div>

        <div className="mt-8">
          <Button type="submit" fullWidth size="lg" disabled={!valid || submitting}>
            {submitting ? "만드는 중..." : "여행 만들기"}
          </Button>
        </div>
      </form>
      {showToast && <Toast message="여행이 생성되었어요 (목업)" tone="success" />}
    </div>
  );
}

function SegmentedButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-11 rounded-[10px] text-[14px] font-medium transition-colors",
        active ? "bg-ink-900 text-cream" : "bg-surface-400 text-ink-700 hover:text-ink-900",
      )}
    >
      {children}
    </button>
  );
}
