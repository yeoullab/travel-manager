import { describe, expect, it } from "vitest";
import { validateTripDates } from "@/lib/trip/trip-date-validation";

describe("validateTripDates", () => {
  it("start <= end 이면 통과", () => {
    expect(validateTripDates("2026-05-01", "2026-05-10")).toBeNull();
  });

  it("start > end 이면 에러 반환", () => {
    const err = validateTripDates("2026-05-10", "2026-05-01");
    expect(err).toBe("종료일은 시작일 이후로 설정해주세요");
  });

  it("90일 초과면 에러 반환", () => {
    const err = validateTripDates("2026-01-01", "2026-04-02"); // 91일
    expect(err).toBe("여행 기간은 최대 90일까지 설정 가능해요");
  });

  it("정확히 90일은 통과", () => {
    expect(validateTripDates("2026-01-01", "2026-04-01")).toBeNull(); // 90일
  });
});
