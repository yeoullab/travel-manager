import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScheduleItemModal } from "@/components/schedule/schedule-item-modal";
import type { Database } from "@/types/database";

type ScheduleItem = Database["public"]["Tables"]["schedule_items"]["Row"];

function mkItem(partial: Partial<ScheduleItem>): ScheduleItem {
  return {
    id: "x",
    trip_day_id: "d",
    trip_id: "trip-1",
    is_candidate: false,
    title: "매향",
    sort_order: 1,
    time_of_day: null,
    place_name: "매향",
    place_address: "충남 공주시",
    place_lat: 36.45,
    place_lng: 127.12,
    place_provider: "naver",
    place_external_id: "naver:123",
    place_external_url: null,
    memo: null,
    url: null,
    created_at: "2026-04-22T00:00:00Z",
    updated_at: "2026-04-22T00:00:00Z",
    category_code: "food",
    ...partial,
  };
}

function renderEditModal() {
  render(
    <ScheduleItemModal
      open
      mode="edit"
      initial={mkItem({})}
      pickedPlace={null}
      onClose={() => {}}
      onSubmit={vi.fn()}
      onOpenPlaceSearch={() => {}}
    />,
  );
}

function saveButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: "저장" }) as HTMLButtonElement;
}

describe("schedule-item-modal — 편집 중 카테고리 변경", () => {
  it("카테고리만 바꿔도 기존 장소·제목이 유지되어 저장 버튼이 활성 상태다", () => {
    renderEditModal();

    // 편집 진입: place_search stage, 저장 활성 (장소·제목 복원됨)
    expect(saveButton().disabled).toBe(false);

    // 카테고리 변경 → 카페 선택
    fireEvent.click(screen.getByRole("button", { name: "카테고리 변경" }));
    fireEvent.click(screen.getByRole("radio", { name: "카페" }));

    // 기존 장소가 유지되어 저장이 여전히 가능해야 한다 (회귀: 장소·제목 초기화로 영구 비활성)
    expect(screen.getByText("충남 공주시")).toBeTruthy();
    expect(saveButton().disabled).toBe(false);
  });

  it("카테고리 변경 후 '기타'를 선택해도 제목이 유지된다", () => {
    renderEditModal();

    fireEvent.click(screen.getByRole("button", { name: "카테고리 변경" }));
    fireEvent.click(screen.getByRole("radio", { name: "기타" }));

    expect((screen.getByLabelText("제목") as HTMLInputElement).value).toBe("매향");
    expect(saveButton().disabled).toBe(false);
  });

  it("직접 입력(수기 주소) 일정도 카테고리 변경 후 저장이 가능하다", () => {
    render(
      <ScheduleItemModal
        open
        mode="edit"
        initial={mkItem({
          place_lat: null,
          place_lng: null,
          place_provider: null,
          place_external_id: null,
        })}
        pickedPlace={null}
        onClose={() => {}}
        onSubmit={vi.fn()}
        onOpenPlaceSearch={() => {}}
      />,
    );

    // manual_place 진입 (주소 수기 입력 상태)
    expect((screen.getByLabelText("주소") as HTMLInputElement).value).toBe("충남 공주시");

    fireEvent.click(screen.getByRole("button", { name: "카테고리 변경" }));
    fireEvent.click(screen.getByRole("radio", { name: "카페" }));

    // manual_place 로 복귀해 주소·제목 유지 → 저장 가능
    expect((screen.getByLabelText("주소") as HTMLInputElement).value).toBe("충남 공주시");
    expect(saveButton().disabled).toBe(false);
  });
});
