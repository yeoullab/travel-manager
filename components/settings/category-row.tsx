import { cn } from "@/lib/cn";

type Props = {
  /** Tailwind bg class — e.g. "bg-ti-read" */
  colorToken: string;
  /** 한글 표시 라벨 — 예: "교통" */
  name: string;
  /** code 식별자 — 예: "transport" */
  code: string;
  /** 추가 우측 슬롯 — 예: 사용 도메인 뱃지 */
  trailing?: React.ReactNode;
};

/**
 * /settings/categories 페이지의 1행. 좌측 색상 dot + 라벨/code + 우측 슬롯.
 * V1 read-only — onClick 미지원. V2 커스텀 카테고리 도입 시 액션 추가 예정.
 */
export function CategoryRow({ colorToken, name, code, trailing }: Props) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span
        aria-hidden
        className={cn(
          "border-border-primary inline-block h-4 w-4 shrink-0 rounded-full border",
          colorToken,
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="text-ink-900 truncate text-[15px] font-medium">{name}</p>
        <p className="text-ink-500 mt-0.5 truncate font-mono text-[11px]">{code}</p>
      </div>
      {trailing}
    </div>
  );
}
