import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  rows?: number;
  className?: string;
};

/**
 * 리스트형 탭 (일정/경비/할일/기록) 의 isLoading fallback.
 * 텍스트 한 줄 ("불러오는 중…") 보다 시각적으로 즉각적이고 layout shift 가 작다.
 */
export function ListSkeleton({ rows = 4, className }: Props) {
  return (
    <div className={`flex flex-col gap-2 px-4 pt-4 ${className ?? ""}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="rect" className="h-[68px] w-full" />
      ))}
    </div>
  );
}
