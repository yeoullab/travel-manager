import Link from "next/link";
import { Button } from "@/components/ui/button";

export function TripUnavailable() {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center"
      role="status"
      aria-live="polite"
    >
      <p className="text-ink-900 text-[18px] font-semibold">
        파트너와의 연결이 해제되어 이 여행은 더 이상 볼 수 없어요
      </p>
      <Link href="/trips">
        <Button variant="primary">내 여행 목록으로</Button>
      </Link>
    </div>
  );
}
