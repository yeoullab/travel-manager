import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Plane, MapPin, Calendar as CalendarIcon, Eye } from "lucide-react";
import { AppBar } from "@/components/ui/app-bar";
import { ScheduleItem, type ScheduleCategory } from "@/components/ui/schedule-item";
import { ExpenseRow, type ExpenseCategory } from "@/components/ui/expense-row";
import { MapPanel } from "@/components/schedule/map-panel";
import { getServerClient } from "@/lib/supabase/server-client";
import { cn } from "@/lib/cn";

type ScheduleItemShare = {
  title: string;
  timeOfDay: string | null;
  placeName: string | null;
  placeAddress: string | null;
  placeLat: number | null;
  placeLng: number | null;
  memo: string | null;
  url: string | null;
  categoryCode: string;
};

type DaySchedule = {
  dayNumber: number;
  date: string;
  items: ScheduleItemShare[];
};

type ExpenseShare = {
  expenseDate: string;
  title: string;
  amount: number;
  currency: string;
  categoryCode: string;
  memo: string | null;
};

type TodoShare = {
  title: string;
  memo: string | null;
  isCompleted: boolean;
};

type RecordShare = {
  title: string;
  content: string;
  date: string;
};

type SharePayload = {
  trip: {
    title: string;
    destination: string;
    startDate: string;
    endDate: string;
    isDomestic: boolean;
  };
  share: {
    showSchedule: boolean;
    showExpenses: boolean;
    showTodos: boolean;
    showRecords: boolean;
  };
  scheduleByDay: DaySchedule[];
  expenses: ExpenseShare[];
  todos: TodoShare[];
  records: RecordShare[];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fetchGuestData(token: string): Promise<SharePayload | null> {
  if (!UUID_RE.test(token)) return null;
  const supabase = await getServerClient();
  // get_guest_trip_data 는 anon GRANT — 세션 없이 호출 가능 (RPC 가 auth.uid() 를 안 씀)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("get_guest_trip_data", {
    p_token: token,
  });
  if (error || !data) return null;
  return data as SharePayload;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const data = await fetchGuestData(token);
  if (!data) return { title: "공유 링크", robots: { index: false, follow: false } };
  return {
    title: `${data.trip.title} · 여행 공유`,
    description: `${data.trip.destination} · ${data.trip.startDate} ~ ${data.trip.endDate}`,
    openGraph: {
      title: data.trip.title,
      description: data.trip.destination,
      type: "website",
    },
    robots: { index: false, follow: false },
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await fetchGuestData(token);
  if (!data) notFound();

  const { trip, share, scheduleByDay, expenses, todos, records } = data;

  return (
    <div className="flex min-h-dvh flex-col pb-28" style={{ minHeight: "100dvh" }}>
      {/* Read-only banner */}
      <div className="bg-ink-900 text-cream flex items-center justify-center gap-2 py-1.5 text-[11px] font-medium tracking-wider uppercase">
        <Eye size={12} />
        Read-only guest view
      </div>

      <AppBar title={trip.title} />

      <main className="mx-auto w-full max-w-[640px] flex-1 px-4 pt-4">
        {/* Trip hero */}
        <section className="bg-surface-100 border-border-primary overflow-hidden rounded-[16px] border p-6">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]",
                trip.isDomestic ? "bg-ti-grep/40 text-ink-800" : "bg-ti-read/40 text-ink-800",
              )}
              aria-hidden
            >
              {trip.isDomestic ? <MapPin size={18} /> : <Plane size={18} />}
            </span>
            <span className="text-ink-600 text-[11px] font-medium tracking-wider uppercase">
              {trip.isDomestic ? "국내 여행" : "해외 여행"}
            </span>
          </div>
          <h1 className="text-ink-900 mt-3 text-[26px] font-semibold tracking-[-0.01em]">
            {trip.title}
          </h1>
          <p className="text-ink-700 mt-1 flex items-center gap-1 text-[14px]">
            <MapPin size={14} className="text-ink-500" />
            {trip.destination}
          </p>
          <p className="text-ink-700 mt-1 flex items-center gap-1 text-[14px]">
            <CalendarIcon size={14} className="text-ink-500" />
            {formatRange(trip.startDate, trip.endDate)}
          </p>
        </section>

        {share.showSchedule && (
          <ScheduleSection days={scheduleByDay} isDomestic={trip.isDomestic} />
        )}
        {share.showExpenses && <ExpensesSection items={expenses} />}
        {share.showTodos && <TodosSection items={todos} />}
        {share.showRecords && <RecordsSection items={records} />}

        <p className="text-ink-500 mt-10 text-center text-[11px]">
          공개 설정은 소유자가 언제든 해제할 수 있습니다
        </p>
      </main>
    </div>
  );
}

function ScheduleSection({
  days,
  isDomestic,
}: {
  days: DaySchedule[];
  isDomestic: boolean;
}) {
  const nonEmpty = days.filter((d) => d.items.length > 0);
  if (nonEmpty.length === 0) return null;
  return (
    <Section title="일정">
      <div className="flex flex-col gap-6">
        {nonEmpty.map((d) => {
          const mapItems = d.items
            .map((it, idx) => {
              if (it.placeLat == null || it.placeLng == null) return null;
              return {
                id: `${d.dayNumber}-${idx}`,
                place_lat: it.placeLat,
                place_lng: it.placeLng,
                label: String(idx + 1),
              };
            })
            .filter(
              (v): v is { id: string; place_lat: number; place_lng: number; label: string } =>
                v !== null,
            );
          return (
            <div key={d.dayNumber}>
              <div className="mb-2 flex items-baseline gap-2">
                <span className="bg-accent-orange text-cream rounded-full px-2 py-0.5 text-[11px] font-medium">
                  Day {d.dayNumber}
                </span>
                <span className="text-ink-600 font-mono text-[12px]">{d.date}</span>
              </div>
              {mapItems.length > 0 && (
                <MapPanel isDomestic={isDomestic} items={mapItems} />
              )}
              <ul className="mt-3 flex flex-col gap-2">
                {d.items.map((it, idx) => (
                  <li key={`${d.dayNumber}-${idx}`} className="flex items-start gap-2">
                    {/* 카드 번호: 22×22 accent-orange (#f54e00) + cream 글자. 지도 마커와 동일 톤. */}
                    <div className="bg-accent-orange text-cream mt-2.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <ScheduleItem
                        category={toScheduleCategory(it.categoryCode)}
                        title={it.title}
                        time={it.timeOfDay?.slice(0, 5) ?? undefined}
                        placeName={it.placeName ?? undefined}
                        memo={it.memo ?? undefined}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function ExpensesSection({ items }: { items: ExpenseShare[] }) {
  if (items.length === 0) return null;
  return (
    <Section title="경비">
      <div className="bg-surface-100 border-border-primary overflow-hidden rounded-[12px] border">
        {items.map((e, idx) => (
          <ExpenseRow
            key={`${e.expenseDate}-${idx}`}
            category={toExpenseCategory(e.categoryCode)}
            title={e.title}
            amount={Number(e.amount)}
            currency={e.currency}
            memo={e.memo ?? undefined}
          />
        ))}
      </div>
    </Section>
  );
}

function TodosSection({ items }: { items: TodoShare[] }) {
  if (items.length === 0) return null;
  return (
    <Section title="할 일">
      <ul className="bg-surface-100 border-border-primary divide-border-primary flex flex-col divide-y overflow-hidden rounded-[12px] border">
        {items.map((t, idx) => (
          <li key={idx} className="flex items-center gap-3 px-4 py-3">
            <span
              aria-hidden
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border",
                t.isCompleted
                  ? "bg-accent-orange border-accent-orange text-cream"
                  : "border-border-medium",
              )}
            >
              {t.isCompleted && "✓"}
            </span>
            <div className="min-w-0">
              <p
                className={cn(
                  "text-[14px]",
                  t.isCompleted ? "text-ink-500 line-through" : "text-ink-900",
                )}
              >
                {t.title}
              </p>
              {t.memo && <p className="text-ink-600 mt-0.5 truncate text-[12px]">{t.memo}</p>}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function RecordsSection({ items }: { items: RecordShare[] }) {
  if (items.length === 0) return null;
  return (
    <Section title="기록">
      <div className="flex flex-col gap-3">
        {items.map((r, idx) => (
          <article
            key={idx}
            className="bg-surface-100 border-border-primary rounded-[12px] border p-4"
          >
            <div className="flex items-baseline justify-between">
              <h3 className="text-ink-900 text-[15px] font-semibold">{r.title}</h3>
              <time className="text-ink-600 ml-3 font-mono text-[11px]">{r.date}</time>
            </div>
            <p className="text-ink-800 mt-2 text-[13px] leading-[1.6] whitespace-pre-wrap">
              {r.content}
            </p>
          </article>
        ))}
      </div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-ink-900 mb-3 text-[17px] font-semibold tracking-[-0.005em]">{title}</h2>
      {children}
    </section>
  );
}

const SCHEDULE_CATEGORIES: ScheduleCategory[] = [
  "transport",
  "sightseeing",
  "food",
  "lodging",
  "shopping",
  "other",
];
const EXPENSE_CATEGORY_SET: ExpenseCategory[] = [
  "food",
  "transport",
  "lodging",
  "shopping",
  "activity",
  "other",
];

function toScheduleCategory(code: string): ScheduleCategory {
  return (SCHEDULE_CATEGORIES as readonly string[]).includes(code)
    ? (code as ScheduleCategory)
    : "other";
}
function toExpenseCategory(code: string): ExpenseCategory {
  return (EXPENSE_CATEGORY_SET as readonly string[]).includes(code)
    ? (code as ExpenseCategory)
    : "other";
}

function formatRange(start: string, end: string): string {
  const [ys, ms, ds] = start.split("-");
  const [ye, me, de] = end.split("-");
  if (ys === ye && ms === me) return `${Number(ms)}월 ${Number(ds)}일 - ${Number(de)}일`;
  if (ys === ye) return `${Number(ms)}월 ${Number(ds)}일 - ${Number(me)}월 ${Number(de)}일`;
  return `${ys}. ${Number(ms)}. ${Number(ds)}. - ${ye}. ${Number(me)}. ${Number(de)}.`;
}
