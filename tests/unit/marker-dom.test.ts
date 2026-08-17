import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildMarkerElement,
  closeAllMarkerTips,
  handleMarkerTap,
  toggleMarkerTip,
} from "@/lib/maps/providers/marker-dom";
import type { MarkerSpec } from "@/lib/maps/types";

/** window.matchMedia 를 (hover:none) = mobile 여부로 세팅. */
function setHover(noHover: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: q.includes("hover: none") ? noHover : !noHover,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function spec(partial: Partial<MarkerSpec> = {}): MarkerSpec {
  return {
    lat: 37.5,
    lng: 127.0,
    label: "1",
    title: "성심당 본점",
    color: "#a5673f",
    textColor: "#f2f1ed",
    variant: "main",
    ...partial,
  };
}

describe("buildMarkerElement", () => {
  it("라벨과 일정명 툴팁을 렌더한다", () => {
    const el = buildMarkerElement(spec());
    expect(el.classList.contains("tm-marker")).toBe(true);
    expect(el.querySelector("span")?.textContent).toBe("1");
    const tip = el.querySelector(".tm-marker__tip");
    expect(tip?.textContent).toBe("성심당 본점");
  });

  it("title 이 없으면 툴팁을 만들지 않는다", () => {
    const el = buildMarkerElement(spec({ title: "" }));
    expect(el.querySelector(".tm-marker__tip")).toBeNull();
  });

  it("main 은 채움 배경, candidate 는 점선 테두리다", () => {
    const main = buildMarkerElement(spec({ variant: "main" }));
    expect(main.style.borderStyle).toBe("solid");
    expect(main.style.background).toContain("165"); // food fill rgb
    const cand = buildMarkerElement(spec({ variant: "candidate" }));
    expect(cand.classList.contains("tm-marker--candidate")).toBe(true);
    expect(cand.style.borderStyle).toBe("dashed");
  });

  it("구조 스타일을 문서에 1회만 주입한다", () => {
    buildMarkerElement(spec());
    buildMarkerElement(spec());
    expect(document.querySelectorAll("#tm-marker-styles").length).toBe(1);
  });
});

describe("toggleMarkerTip / closeAllMarkerTips", () => {
  beforeEach(() => closeAllMarkerTips());

  it("탭하면 열리고 다시 탭하면 닫힌다", () => {
    const el = buildMarkerElement(spec());
    toggleMarkerTip(el);
    expect(el.classList.contains("tm-open")).toBe(true);
    toggleMarkerTip(el);
    expect(el.classList.contains("tm-open")).toBe(false);
  });

  it("한 번에 하나만 열린다 (다른 마커를 탭하면 이전 것은 닫힘)", () => {
    const a = buildMarkerElement(spec());
    const b = buildMarkerElement(spec({ label: "2", title: "두번째" }));
    toggleMarkerTip(a);
    toggleMarkerTip(b);
    expect(a.classList.contains("tm-open")).toBe(false);
    expect(b.classList.contains("tm-open")).toBe(true);
  });

  it("closeAllMarkerTips 는 열린 팁을 모두 닫는다", () => {
    const el = buildMarkerElement(spec());
    toggleMarkerTip(el);
    closeAllMarkerTips();
    expect(el.classList.contains("tm-open")).toBe(false);
  });
});

describe("handleMarkerTap", () => {
  const realMatchMedia = window.matchMedia;
  beforeEach(() => closeAllMarkerTips());
  afterEach(() => {
    window.matchMedia = realMatchMedia;
  });

  it("모바일 탭: 툴팁만 열고 onClick(포커스 스크롤)은 억제한다", () => {
    setHover(true); // (hover:none) = 모바일
    const onClick = vi.fn();
    const el = buildMarkerElement(spec());
    handleMarkerTap(el, spec({ onClick }));
    expect(el.classList.contains("tm-open")).toBe(true);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("데스크톱 클릭: onClick(리스트 스크롤)을 실행한다", () => {
    setHover(false); // 호버 있는 기기
    const onClick = vi.fn();
    const el = buildMarkerElement(spec());
    handleMarkerTap(el, spec({ onClick }));
    expect(el.classList.contains("tm-open")).toBe(false);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
