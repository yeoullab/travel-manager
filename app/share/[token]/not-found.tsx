import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { AppBar } from "@/components/ui/app-bar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * /share/[token] 에서 토큰이 유효하지 않거나(포맷/만료/비활성/존재X) 데이터가 없을 때.
 * 존재 여부 leak 방지를 위해 원인을 구분하지 않고 단일 UI.
 */
export default function ShareNotFound() {
  return (
    <div className="flex min-h-dvh flex-col" style={{ minHeight: "100dvh" }}>
      <AppBar title="공유 링크" />
      <main className="flex-1">
        <EmptyState
          className="py-24"
          icon={<AlertCircle size={48} strokeWidth={1.5} />}
          title="만료되었거나 존재하지 않는 링크"
          description="공유를 요청한 분께 새 링크를 받아주세요."
          cta={
            <Link href="/">
              <Button variant="primary">홈으로</Button>
            </Link>
          }
        />
      </main>
    </div>
  );
}
