/**
 * 사용자 입력 amount 문자열을 정규화한다.
 *
 * - 숫자, 콤마, 소수점만 남김
 * - 콤마 제거 → 숫자/소수점만 분리 → 정수부에 1,000 단위 콤마 재삽입
 * - 소수점은 1개만 허용 (두 번째 이후 무시)
 * - 빈 문자열은 빈 문자열로 통과 (validation 은 schema 가 담당)
 *
 * 캐럿 위치는 보존하지 않음 — 모바일 numeric 키보드 환경 가정 (보통 끝에서 입력).
 */
export function formatAmountInput(raw: string): string {
  if (!raw) return "";
  const cleaned = raw.replace(/[^\d.]/g, "");
  const dotIdx = cleaned.indexOf(".");
  let intPart: string;
  let fracPart: string | null = null;
  if (dotIdx === -1) {
    intPart = cleaned;
  } else {
    intPart = cleaned.slice(0, dotIdx);
    fracPart = cleaned.slice(dotIdx + 1).replace(/\./g, "");
  }
  intPart = intPart.replace(/^0+(?=\d)/, "");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fracPart === null ? grouped : `${grouped}.${fracPart}`;
}

/** 표시용 amount 문자열 → number 변환 (콤마 제거). NaN 가능. */
export function parseAmountInput(formatted: string): number {
  return Number(formatted.replace(/,/g, ""));
}
