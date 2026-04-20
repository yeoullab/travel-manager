#!/usr/bin/env node
// supabase-js 2.103.x + supabase CLI 최신판의 regenerated types 가 `PostgrestVersion: "17"` 등
// 을 덮어쓰면 update()/insert() 반환 타입이 never 가 되는 Phase 1 회귀 이슈 재발.
// 현재 fix (Phase 1): "12" 로 고정. supabase-js 가 공식 대응하면 이 스크립트 제거.
import { readFileSync, writeFileSync } from "node:fs";

const path = "types/database.ts";
const src = readFileSync(path, "utf8");
const next = src.replace(/PostgrestVersion:\s*"[0-9.]+"/g, 'PostgrestVersion: "12"');
if (src === next) {
  console.log("[fix-postgrest-version] no change (already 12 or pattern absent)");
} else {
  writeFileSync(path, next);
  console.log('[fix-postgrest-version] pinned PostgrestVersion to "12"');
}
