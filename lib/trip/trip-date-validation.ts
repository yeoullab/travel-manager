export function validateTripDates(start: string, end: string): string | null {
  if (start > end) return "종료일은 시작일 이후로 설정해주세요";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const days = Math.round(ms / 86400000);
  if (days > 90) return "여행 기간은 최대 90일까지 설정 가능해요";
  return null;
}
