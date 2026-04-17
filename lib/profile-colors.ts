/**
 * 프로필별 컬러 매핑 (결제자·담당자 칩 시각 구분).
 *
 * Phase 0 목업 — 그룹이 2명인 경우에 한해 ME(orange) / PARTNER(blue).
 * 그룹이 3명 이상이 되면 해시 기반 팔레트로 교체 예정 (Phase 2~).
 *
 * 토큰은 globals.css와 1:1 대응 (ADR-005).
 */

import { PROFILE_ME_ID, PROFILE_PARTNER_ID } from "@/lib/mocks/profiles";

export type ProfileChipTone = "me" | "partner" | "neutral";

export type ProfileChipClass = {
  bg: string;
  text: string;
};

const TONE_CLASS: Record<ProfileChipTone, ProfileChipClass> = {
  me: { bg: "bg-accent-orange", text: "text-cream" },
  partner: { bg: "bg-ti-read", text: "text-ink-900" },
  neutral: { bg: "bg-surface-400", text: "text-ink-700" },
};

export function toneForProfile(profileId: string | null | undefined): ProfileChipTone {
  if (profileId === PROFILE_ME_ID) return "me";
  if (profileId === PROFILE_PARTNER_ID) return "partner";
  return "neutral";
}

export function chipClassForProfile(profileId: string | null | undefined): ProfileChipClass {
  return TONE_CLASS[toneForProfile(profileId)];
}
