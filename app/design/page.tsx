"use client";

/**
 * /design — 디자인 시스템 팔레트 (Phase 0 Step 2~3)
 *
 * 목적: 이식된 DESIGN.md 토큰과 구현된 UI 컴포넌트를 한 페이지에서 검증.
 * 유저/팀이 전체 톤과 컴포넌트 상태를 확인하는 기준 페이지.
 */

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField, TextArea } from "@/components/ui/text-field";
import { SectionHeader } from "@/components/ui/section-header";
import { AppBar } from "@/components/ui/app-bar";
import { BottomTabBar, type BottomTab } from "@/components/ui/bottom-tab-bar";
import { Fab } from "@/components/ui/fab";
import { Calendar, Wallet, CheckSquare, FileText, Settings, Luggage } from "lucide-react";
import { useState } from "react";
import { Toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

const demoTabs: BottomTab[] = [
  { key: "schedule", label: "일정", icon: Calendar },
  { key: "expenses", label: "경비", icon: Wallet },
  { key: "todos", label: "할 일", icon: CheckSquare },
  { key: "records", label: "기록", icon: FileText },
  { key: "manage", label: "관리", icon: Settings },
];

type ColorChipProps = {
  name: string;
  value: string;
  className: string;
  textColor?: string;
};

function ColorChip({ name, value, className, textColor = "text-ink-900" }: ColorChipProps) {
  return (
    <div className="flex flex-col gap-1">
      <div
        className={`${className} border-border-primary flex h-20 items-end rounded-[8px] border p-3`}
      >
        <span className={`text-xs font-medium ${textColor}`}>{name}</span>
      </div>
      <code className="text-ink-600 text-[11px]">{value}</code>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-ink-900 text-[1.375rem] font-semibold">{title}</h2>
        {description && <p className="text-ink-600 mt-1 text-sm">{description}</p>}
      </div>
      <div>{children}</div>
    </section>
  );
}

export default function DesignPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  return (
    <main className="mx-auto max-w-5xl space-y-16 px-6 py-12">
      <header className="space-y-2">
        <p className="text-ink-600 text-[11px] font-medium tracking-wider uppercase">
          Phase 0 · Step 2
        </p>
        <h1 className="text-ink-900 text-4xl font-semibold tracking-tight">
          travel-manager Design System
        </h1>
        <p className="text-ink-700 text-base">
          DESIGN.md 토큰 이식본. 유저/팀이 전체 톤을 한 페이지에서 검증하기 위한 내부 라우트입니다.
        </p>
      </header>

      {/* Surface scale */}
      <Section
        title="Surface Scale"
        description="따뜻한 크림 톤. 페이지 배경(200), 버튼 기본(300), 카드(400) 순으로 깊어집니다."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <ColorChip name="surface-100" value="#f7f7f4" className="bg-surface-100" />
          <ColorChip name="surface-200" value="#f2f1ed" className="bg-surface-200" />
          <ColorChip name="surface-300" value="#ebeae5" className="bg-surface-300" />
          <ColorChip name="surface-400" value="#e6e5e0" className="bg-surface-400" />
          <ColorChip name="surface-500" value="#e1e0db" className="bg-surface-500" />
        </div>
      </Section>

      {/* Ink scale */}
      <Section
        title="Ink (Text) Scale"
        description="warm near-black 기반. 900=본문, 600=보조, 400=비활성."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <ColorChip name="ink-900" value="#26251e" className="bg-ink-900" textColor="text-cream" />
          <ColorChip
            name="ink-800"
            value="rgba(38,37,30,.75)"
            className="bg-ink-800"
            textColor="text-cream"
          />
          <ColorChip
            name="ink-600"
            value="rgba(38,37,30,.55)"
            className="bg-ink-600"
            textColor="text-cream"
          />
          <ColorChip name="ink-400" value="rgba(38,37,30,.2)" className="bg-ink-400" />
        </div>
      </Section>

      {/* Accent & Semantic */}
      <Section
        title="Accent & Semantic"
        description="CTA는 Orange, 위험/hover는 crimson Error, 성공은 warm teal."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <ColorChip
            name="accent-orange"
            value="#f54e00"
            className="bg-accent-orange"
            textColor="text-cream"
          />
          <ColorChip
            name="accent-gold"
            value="#c08532"
            className="bg-accent-gold"
            textColor="text-cream"
          />
          <ColorChip name="error" value="#cf2d56" className="bg-error" textColor="text-cream" />
          <ColorChip name="success" value="#1f8a65" className="bg-success" textColor="text-cream" />
        </div>
      </Section>

      {/* Timeline (AI ops) */}
      <Section
        title="Timeline / Feature Colors"
        description="AI 작업 단계를 가이드하는 pastel set. V1에서는 카테고리 뱃지에 차용 예정."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <ColorChip name="thinking" value="#dfa88f" className="bg-ti-thinking" />
          <ColorChip name="grep" value="#9fc9a2" className="bg-ti-grep" />
          <ColorChip name="read" value="#9fbbe0" className="bg-ti-read" />
          <ColorChip name="edit" value="#c0a8dd" className="bg-ti-edit" />
        </div>
      </Section>

      {/* Typography */}
      <Section
        title="Typography Scale"
        description="Pretendard primary. CursorGothic/jjannon/berkeleyMono은 Phase 1 이후 라이선스 확보 시 교체 예정."
      >
        <div className="border-border-primary bg-surface-100 space-y-4 rounded-[8px] border p-6">
          <div>
            <p className="text-ink-600 mb-1 text-[11px] font-medium tracking-wider uppercase">
              Display · 72px
            </p>
            <p style={{ fontSize: "4.5rem", lineHeight: 1.1, letterSpacing: "-0.03em" }}>
              여행을 계획하다
            </p>
          </div>
          <div>
            <p className="text-ink-600 mb-1 text-[11px] font-medium tracking-wider uppercase">
              Section · 36px
            </p>
            <p
              className="font-semibold"
              style={{ fontSize: "2.25rem", lineHeight: 1.2, letterSpacing: "-0.02em" }}
            >
              다가오는 여행
            </p>
          </div>
          <div>
            <p className="text-ink-600 mb-1 text-[11px] font-medium tracking-wider uppercase">
              Sub · 26px
            </p>
            <p style={{ fontSize: "1.625rem", lineHeight: 1.25 }}>도쿄 3박 4일</p>
          </div>
          <div>
            <p className="text-ink-600 mb-1 text-[11px] font-medium tracking-wider uppercase">
              Title · 22px
            </p>
            <p style={{ fontSize: "1.375rem", lineHeight: 1.3 }}>첫째 날 일정</p>
          </div>
          <div>
            <p className="text-ink-600 mb-1 text-[11px] font-medium tracking-wider uppercase">
              Body · 17px
            </p>
            <p style={{ fontSize: "1.08rem", lineHeight: 1.35 }}>
              아침 9시에 호텔에서 출발하여 아사쿠사로 이동합니다. 센소지에서 약 1시간 정도 둘러본 뒤
              근처 카페에서 커피 한 잔 마시고 다음 장소로 향합니다.
            </p>
          </div>
          <div>
            <p className="text-ink-600 mb-1 text-[11px] font-medium tracking-wider uppercase">
              Label · 14px
            </p>
            <p style={{ fontSize: "0.875rem", lineHeight: 1 }}>저장하기</p>
          </div>
          <div>
            <p className="text-ink-600 mb-1 text-[11px] font-medium tracking-wider uppercase">
              Caption · 13px
            </p>
            <p style={{ fontSize: "0.8125rem", lineHeight: 1.33 }}>
              파트너와 실시간으로 공유됩니다
            </p>
          </div>
          <div>
            <p className="text-ink-600 mb-1 text-[11px] font-medium tracking-wider uppercase">
              Micro · 11px
            </p>
            <p style={{ fontSize: "0.6875rem", lineHeight: 1.5 }}>2026-04-17 기준</p>
          </div>
        </div>
      </Section>

      {/* Radius */}
      <Section title="Border Radius Scale" description="micro→pill까지 7단계.">
        <div className="flex flex-wrap gap-4">
          {[
            { label: "micro · 1.5", className: "rounded-[1.5px]" },
            { label: "sm · 2", className: "rounded-[2px]" },
            { label: "md · 3", className: "rounded-[3px]" },
            { label: "std · 4", className: "rounded-[4px]" },
            { label: "comfy · 8", className: "rounded-[8px]" },
            { label: "feat · 10", className: "rounded-[10px]" },
            { label: "sheet · 16", className: "rounded-[16px]" },
            { label: "pill", className: "rounded-full" },
          ].map((r) => (
            <div key={r.label} className="flex flex-col items-center gap-2">
              <div
                className={`${r.className} border-border-primary bg-surface-400 h-16 w-16 border`}
              />
              <code className="text-ink-600 text-[11px]">{r.label}</code>
            </div>
          ))}
        </div>
      </Section>

      {/* Shadows */}
      <Section title="Depth / Elevation" description="borders + atmospheric shadows.">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="flex flex-col items-center gap-2">
            <div
              className="bg-surface-100 h-24 w-full rounded-[8px]"
              style={{ boxShadow: "0 0 0 1px rgba(38,37,30,0.1)" }}
            />
            <code className="text-ink-600 text-[11px]">border (L1)</code>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div
              className="bg-surface-100 h-24 w-full rounded-[8px]"
              style={{
                boxShadow: "0 0 16px rgba(0,0,0,0.02), 0 0 8px rgba(0,0,0,0.008)",
              }}
            />
            <code className="text-ink-600 text-[11px]">ambient (L2)</code>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div
              className="bg-surface-100 h-24 w-full rounded-[8px]"
              style={{
                boxShadow:
                  "0 28px 70px rgba(0,0,0,0.14), 0 14px 32px rgba(0,0,0,0.1), 0 0 0 1px rgba(38,37,30,0.1)",
              }}
            />
            <code className="text-ink-600 text-[11px]">elevated (L3)</code>
          </div>
        </div>
      </Section>

      {/* Motion preview */}
      <Section
        title="Motion Tokens (Preview)"
        description="값만 표시. 실제 인터랙션은 Step 3 컴포넌트에서."
      >
        <div className="border-border-primary bg-surface-100 text-ink-700 space-y-2 rounded-[8px] border p-4 font-mono text-xs">
          <div>press-scale: transform scale(0.97); 100ms ease-out</div>
          <div>drag-lift: scale(1.03) rotate(-1.5deg); opacity 0.95</div>
          <div>slide-up-enter: translateY(20px → 0) + fade; 250ms ease-out</div>
          <div>sheet-enter: translateY(100% → 0); 300ms ease-out</div>
          <div>backdrop-fade: opacity 0 → 1; 200ms ease-out</div>
          <div>toast-hold: 3000ms / toast-exit: 150ms ease-out</div>
          <div>spring-back: cubic-bezier(0.2, 0.8, 0.2, 1); 250ms</div>
        </div>
      </Section>

      {/* Components — Batch 1 primitives */}
      <Section
        title="Components · Primitives (Batch 1)"
        description="Button / Card / TextField / SectionHeader"
      >
        <div className="space-y-8">
          <div>
            <p className="text-ink-600 mb-3 text-[11px] font-medium tracking-wider uppercase">
              Button variants
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="tertiary">Tertiary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="light">Light</Button>
              <Button variant="primary" disabled>
                Disabled
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="md">Medium (44pt)</Button>
              <Button size="lg">Large</Button>
              <Button fullWidth>Full width</Button>
            </div>
          </div>

          <div>
            <p className="text-ink-600 mb-3 text-[11px] font-medium tracking-wider uppercase">
              Card
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Card>
                <p className="text-ink-900 text-[15px] font-medium">Standard</p>
                <p className="text-ink-600 mt-1 text-sm">bg surface-400, border, 8px radius.</p>
              </Card>
              <Card compact>
                <p className="text-ink-900 text-[14px] font-medium">Compact</p>
                <p className="text-ink-600 mt-1 text-[12px]">p-3, 4px radius.</p>
              </Card>
              <Card elevated>
                <p className="text-ink-900 text-[15px] font-medium">Elevated</p>
                <p className="text-ink-600 mt-1 text-sm">Level 3 atmospheric shadow.</p>
              </Card>
            </div>
          </div>

          <div>
            <p className="text-ink-600 mb-3 text-[11px] font-medium tracking-wider uppercase">
              Text field / Textarea
            </p>
            <div className="grid max-w-md grid-cols-1 gap-4">
              <TextField label="여행 제목" placeholder="예: 도쿄 3박 4일" />
              <TextField
                label="목적지"
                placeholder="도시를 입력하세요"
                hint="국내/해외 모두 가능합니다."
              />
              <TextField
                label="이메일"
                placeholder="user@example.com"
                error="이메일 형식이 올바르지 않습니다."
              />
              <TextArea label="메모" placeholder="자유롭게 메모하세요" />
            </div>
          </div>

          <div>
            <p className="text-ink-600 mb-3 text-[11px] font-medium tracking-wider uppercase">
              Section header
            </p>
            <div className="border-border-primary bg-surface-100 rounded-[8px] border p-6">
              <SectionHeader>진행 중</SectionHeader>
              <p className="text-ink-700 text-sm">여행 그룹 헤더 스타일.</p>
              <SectionHeader>다가오는 여행</SectionHeader>
              <p className="text-ink-700 text-sm">14px semibold, uppercase, 60% ink.</p>
            </div>
          </div>
        </div>
      </Section>

      {/* Components — Batch 2 navigation */}
      <Section
        title="Components · Navigation (Batch 2)"
        description="AppBar / BottomTabBar / FAB — 실제 포지션(fixed/sticky)은 해제한 프리뷰 프레임"
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <p className="text-ink-600 mb-3 text-[11px] font-medium tracking-wider uppercase">
              AppBar (scrolled=false)
            </p>
            <div className="bg-surface-100 border-border-primary relative overflow-hidden rounded-[16px] border [&_header]:!static">
              <AppBar title="도쿄 3박 4일" onBack={() => {}} scrolled={false} />
              <div className="text-ink-600 h-24 p-4 text-sm">콘텐츠 영역</div>
            </div>
          </div>
          <div>
            <p className="text-ink-600 mb-3 text-[11px] font-medium tracking-wider uppercase">
              AppBar (scrolled=true)
            </p>
            <div className="bg-surface-100 border-border-primary relative overflow-hidden rounded-[16px] border [&_header]:!static">
              <AppBar title="여행 목록" scrolled />
              <div className="text-ink-600 h-24 p-4 text-sm">스크롤 시 하단 보더 페이드 인</div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-ink-600 mb-3 text-[11px] font-medium tracking-wider uppercase">
            BottomTabBar + FAB (5 tabs, active=일정)
          </p>
          <div className="bg-surface-100 border-border-primary relative mx-auto h-[240px] w-full max-w-[375px] overflow-hidden rounded-[24px] border [&>button]:!absolute [&>nav]:!absolute">
            <div className="text-ink-500 p-4 text-xs">프리뷰 영역 (실제 fixed 해제)</div>
            <Fab aria-label="일정 추가" style={{ right: "16px", bottom: "72px" }} />
            <BottomTabBar tabs={demoTabs} activeKey="schedule" />
          </div>
        </div>
      </Section>

      {/* Components — Batch 3 feedback */}
      <Section
        title="Components · Feedback (Batch 3)"
        description="Toast / Dialog / EmptyState / Skeleton"
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <p className="text-ink-600 mb-3 text-[11px] font-medium tracking-wider uppercase">
              Toast variants (position overridden to relative)
            </p>
            <div className="border-border-primary bg-surface-100 relative flex h-32 items-end justify-center overflow-hidden rounded-[16px] border [&>div]:!static [&>div]:!translate-x-0">
              <Toast message="변경 사항이 저장되었습니다" tone="success" />
            </div>
            <div className="border-border-primary bg-surface-100 relative mt-3 flex h-32 items-end justify-center overflow-hidden rounded-[16px] border [&>div]:!static [&>div]:!translate-x-0">
              <Toast message="변경 사항을 저장하지 못했습니다" tone="error" />
            </div>
          </div>

          <div>
            <p className="text-ink-600 mb-3 text-[11px] font-medium tracking-wider uppercase">
              ConfirmDialog (open 토글)
            </p>
            <div className="border-border-primary bg-surface-100 flex h-32 items-center justify-center rounded-[16px] border">
              <Button variant="primary" onClick={() => setDialogOpen(true)}>
                다이얼로그 열기
              </Button>
            </div>
            <ConfirmDialog
              open={dialogOpen}
              onClose={() => setDialogOpen(false)}
              title="여행을 삭제하시겠어요?"
              description="파트너의 데이터도 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다."
              primaryLabel="삭제"
              secondaryLabel="취소"
              destructive
              onPrimary={() => setDialogOpen(false)}
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <p className="text-ink-600 mb-3 text-[11px] font-medium tracking-wider uppercase">
              EmptyState
            </p>
            <div className="border-border-primary bg-surface-100 overflow-hidden rounded-[16px] border">
              <EmptyState
                icon={<Luggage size={48} strokeWidth={1.5} />}
                title="아직 여행이 없어요"
                description="첫 여행을 만들어 파트너와 함께 계획해보세요."
                cta={<Button variant="primary">+ 새 여행 만들기</Button>}
              />
            </div>
          </div>

          <div>
            <p className="text-ink-600 mb-3 text-[11px] font-medium tracking-wider uppercase">
              Skeleton
            </p>
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
              <div className="flex gap-3">
                <Skeleton variant="rect" className="h-20 flex-1" />
                <Skeleton variant="rect" className="h-20 flex-1" />
              </div>
            </div>
          </div>
        </div>
      </Section>

      <footer className="border-border-primary text-ink-600 border-t pt-6 text-xs">
        <p>
          이 페이지는 내부 검증용입니다. 프로덕션에는 노출되지 않아야 하며, Phase 1 이후에도 토큰
          변경 시 이 페이지로 회귀 검증합니다.
        </p>
      </footer>
    </main>
  );
}
