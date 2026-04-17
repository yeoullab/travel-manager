/**
 * /design — 디자인 시스템 팔레트 (Phase 0 Step 2)
 *
 * 목적: 현재 이식된 DESIGN.md 토큰을 시각적으로 확인하고, 유저/팀이 톤을 검증하는 기준 페이지.
 * 본격 컴포넌트 카탈로그는 Step 3에서 추가.
 */

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
        className={`${className} flex h-20 items-end rounded-[8px] border border-border-primary p-3`}
      >
        <span className={`text-xs font-medium ${textColor}`}>{name}</span>
      </div>
      <code className="text-[11px] text-ink-600">{value}</code>
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
        <h2 className="text-[1.375rem] font-semibold text-ink-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-ink-600">{description}</p>}
      </div>
      <div>{children}</div>
    </section>
  );
}

export default function DesignPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12 space-y-16">
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-ink-600">
          Phase 0 · Step 2
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-ink-900">
          travel-manager Design System
        </h1>
        <p className="text-base text-ink-700">
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
          <ColorChip
            name="ink-900"
            value="#26251e"
            className="bg-ink-900"
            textColor="text-cream"
          />
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
          <ColorChip
            name="error"
            value="#cf2d56"
            className="bg-error"
            textColor="text-cream"
          />
          <ColorChip
            name="success"
            value="#1f8a65"
            className="bg-success"
            textColor="text-cream"
          />
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
        <div className="space-y-4 rounded-[8px] border border-border-primary bg-surface-100 p-6">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-ink-600">
              Display · 72px
            </p>
            <p style={{ fontSize: "4.5rem", lineHeight: 1.1, letterSpacing: "-0.03em" }}>
              여행을 계획하다
            </p>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-ink-600">
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
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-ink-600">
              Sub · 26px
            </p>
            <p style={{ fontSize: "1.625rem", lineHeight: 1.25 }}>도쿄 3박 4일</p>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-ink-600">
              Title · 22px
            </p>
            <p style={{ fontSize: "1.375rem", lineHeight: 1.3 }}>첫째 날 일정</p>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-ink-600">
              Body · 17px
            </p>
            <p style={{ fontSize: "1.08rem", lineHeight: 1.35 }}>
              아침 9시에 호텔에서 출발하여 아사쿠사로 이동합니다. 센소지에서 약 1시간 정도
              둘러본 뒤 근처 카페에서 커피 한 잔 마시고 다음 장소로 향합니다.
            </p>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-ink-600">
              Label · 14px
            </p>
            <p style={{ fontSize: "0.875rem", lineHeight: 1 }}>저장하기</p>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-ink-600">
              Caption · 13px
            </p>
            <p style={{ fontSize: "0.8125rem", lineHeight: 1.33 }}>
              파트너와 실시간으로 공유됩니다
            </p>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-ink-600">
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
                className={`${r.className} h-16 w-16 border border-border-primary bg-surface-400`}
              />
              <code className="text-[11px] text-ink-600">{r.label}</code>
            </div>
          ))}
        </div>
      </Section>

      {/* Shadows */}
      <Section title="Depth / Elevation" description="borders + atmospheric shadows.">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="flex flex-col items-center gap-2">
            <div
              className="h-24 w-full rounded-[8px] bg-surface-100"
              style={{ boxShadow: "0 0 0 1px rgba(38,37,30,0.1)" }}
            />
            <code className="text-[11px] text-ink-600">border (L1)</code>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div
              className="h-24 w-full rounded-[8px] bg-surface-100"
              style={{
                boxShadow:
                  "0 0 16px rgba(0,0,0,0.02), 0 0 8px rgba(0,0,0,0.008)",
              }}
            />
            <code className="text-[11px] text-ink-600">ambient (L2)</code>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div
              className="h-24 w-full rounded-[8px] bg-surface-100"
              style={{
                boxShadow:
                  "0 28px 70px rgba(0,0,0,0.14), 0 14px 32px rgba(0,0,0,0.1), 0 0 0 1px rgba(38,37,30,0.1)",
              }}
            />
            <code className="text-[11px] text-ink-600">elevated (L3)</code>
          </div>
        </div>
      </Section>

      {/* Motion preview */}
      <Section title="Motion Tokens (Preview)" description="값만 표시. 실제 인터랙션은 Step 3 컴포넌트에서.">
        <div className="space-y-2 rounded-[8px] border border-border-primary bg-surface-100 p-4 font-mono text-xs text-ink-700">
          <div>press-scale: transform scale(0.97); 100ms ease-out</div>
          <div>drag-lift: scale(1.03) rotate(-1.5deg); opacity 0.95</div>
          <div>slide-up-enter: translateY(20px → 0) + fade; 250ms ease-out</div>
          <div>sheet-enter: translateY(100% → 0); 300ms ease-out</div>
          <div>backdrop-fade: opacity 0 → 1; 200ms ease-out</div>
          <div>toast-hold: 3000ms / toast-exit: 150ms ease-out</div>
          <div>spring-back: cubic-bezier(0.2, 0.8, 0.2, 1); 250ms</div>
        </div>
      </Section>

      <footer className="border-t border-border-primary pt-6 text-xs text-ink-600">
        <p>
          이 페이지는 내부 검증용입니다. 프로덕션에는 노출되지 않아야 하며,
          Phase 1 이후에도 토큰 변경 시 이 페이지로 회귀 검증합니다.
        </p>
      </footer>
    </main>
  );
}
