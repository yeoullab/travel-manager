import type { Todo } from "@/lib/types";
import { PROFILE_ME_ID, PROFILE_PARTNER_ID } from "./profiles";
// Inlined legacy trip IDs (previously imported from ./trips, removed in Task 9).
const TRIP_TOKYO_ID = "trip_tokyo";
const TRIP_GANGNEUNG_ID = "trip_gangneung";

const TS = "2026-04-10T09:00:00Z";

/**
 * 할 일 총 7건. 도쿄 4 + 강릉 3.
 */
export const todos: Todo[] = [
  // ── 도쿄 (일부 완료) ──────────────────────────────────────────
  {
    id: "todo_tk_1",
    tripId: TRIP_TOKYO_ID,
    title: "여권 만료일 확인",
    memo: "6개월 이상 남아야 함",
    isCompleted: true,
    assignedTo: PROFILE_ME_ID,
    createdAt: TS,
  },
  {
    id: "todo_tk_2",
    tripId: TRIP_TOKYO_ID,
    title: "환전 3만엔",
    memo: "하나은행 환율 우대",
    isCompleted: true,
    assignedTo: PROFILE_PARTNER_ID,
    createdAt: TS,
  },
  {
    id: "todo_tk_3",
    tripId: TRIP_TOKYO_ID,
    title: "스카이트리 야경 티켓 예매",
    memo: null,
    isCompleted: true,
    assignedTo: PROFILE_ME_ID,
    createdAt: TS,
  },
  {
    id: "todo_tk_4",
    tripId: TRIP_TOKYO_ID,
    title: "귀국 후 기념품 정리",
    memo: null,
    isCompleted: false,
    assignedTo: null,
    createdAt: TS,
  },

  // ── 강릉 (모두 미완료) ────────────────────────────────────────
  {
    id: "todo_gn_1",
    tripId: TRIP_GANGNEUNG_ID,
    title: "KTX 예매",
    memo: "2주 전 오픈",
    isCompleted: false,
    assignedTo: PROFILE_ME_ID,
    createdAt: TS,
  },
  {
    id: "todo_gn_2",
    tripId: TRIP_GANGNEUNG_ID,
    title: "펜션 결제",
    memo: null,
    isCompleted: false,
    assignedTo: PROFILE_ME_ID,
    createdAt: TS,
  },
  {
    id: "todo_gn_3",
    tripId: TRIP_GANGNEUNG_ID,
    title: "수영복 챙기기",
    memo: null,
    isCompleted: false,
    assignedTo: PROFILE_PARTNER_ID,
    createdAt: TS,
  },
];
