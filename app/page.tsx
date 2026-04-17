export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold text-ink-900">travel-manager</h1>
      <p className="text-base text-ink-600">Phase 0 부트스트랩 확인용 페이지</p>
      <div className="flex gap-2">
        <span className="rounded-lg bg-surface-300 px-3 py-1 text-sm text-ink-900">
          Pretendard 400
        </span>
        <span className="rounded-lg bg-surface-300 px-3 py-1 text-sm font-medium text-ink-900">
          Pretendard 500
        </span>
        <span className="rounded-lg bg-surface-300 px-3 py-1 text-sm font-semibold text-ink-900">
          Pretendard 600
        </span>
      </div>
    </main>
  );
}
