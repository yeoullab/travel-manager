import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MapLegend } from "@/components/schedule/map-legend";

describe("MapLegend", () => {
  afterEach(() => cleanup());

  it("현재 지도에 있는 카테고리만 노출한다", () => {
    render(<MapLegend categories={["food", "cafe"]} />);
    expect(screen.getByText("식당")).toBeTruthy();
    expect(screen.getByText("카페")).toBeTruthy();
    expect(screen.queryByText("교통")).toBeNull();
    expect(screen.queryByText("숙소")).toBeNull();
  });

  it("스펙 순서(교통→관광→식당…)대로 정렬한다", () => {
    const { container } = render(<MapLegend categories={["cafe", "transport", "food"]} />);
    const labels = Array.from(container.querySelectorAll("span.flex")).map(
      (el) => el.textContent?.trim(),
    );
    expect(labels).toEqual(["교통", "식당", "카페"]);
  });

  it("표시할 카테고리가 없으면 아무것도 렌더하지 않는다", () => {
    const { container } = render(<MapLegend categories={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("알 수 없는 카테고리는 무시한다", () => {
    render(<MapLegend categories={["food", "bogus"]} />);
    expect(screen.getByText("식당")).toBeTruthy();
    expect(screen.queryByText("bogus")).toBeNull();
  });
});
