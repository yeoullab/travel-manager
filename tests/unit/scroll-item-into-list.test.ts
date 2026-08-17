import { describe, expect, it, vi } from "vitest";
import { scrollItemIntoList } from "@/lib/schedule/scroll-item-into-list";

/** jsdom 은 레이아웃이 없으므로 rect·clientHeight 를 수동 주입한다. */
function stubRect(el: HTMLElement, rect: { top: number; height: number }) {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    top: rect.top,
    height: rect.height,
    bottom: rect.top + rect.height,
    left: 0,
    right: 0,
    width: 0,
    x: 0,
    y: rect.top,
    toJSON: () => ({}),
  } as DOMRect);
}

describe("scrollItemIntoList", () => {
  it("가장 가까운 세로 스크롤 컨테이너만 스크롤한다 (window 는 건드리지 않음)", () => {
    const scroller = document.createElement("div");
    scroller.style.overflowY = "auto";
    const item = document.createElement("li");
    scroller.appendChild(item);
    document.body.appendChild(scroller);

    Object.defineProperty(scroller, "clientHeight", { value: 400 });
    Object.defineProperty(scroller, "scrollTop", { value: 100, writable: true });
    stubRect(scroller, { top: 300, height: 400 });
    stubRect(item, { top: 900, height: 80 }); // 컨테이너 상단에서 600px 아래

    const scrollTo = vi.fn();
    scroller.scrollTo = scrollTo as unknown as typeof scroller.scrollTo;
    const windowScrollIntoView = vi.fn();
    item.scrollIntoView = windowScrollIntoView;

    scrollItemIntoList(item);

    // scrollTop(100) + 컨테이너 내 오프셋(600) - 중앙 보정((400-80)/2 = 160) = 540
    expect(scrollTo).toHaveBeenCalledWith({ top: 540, behavior: "smooth" });
    expect(windowScrollIntoView).not.toHaveBeenCalled();
  });

  it("스크롤 컨테이너가 없으면 scrollIntoView(nearest) 로 폴백한다", () => {
    const item = document.createElement("li");
    document.body.appendChild(item);
    const scrollIntoView = vi.fn();
    item.scrollIntoView = scrollIntoView;

    scrollItemIntoList(item);

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "nearest" });
  });

  it("계산 결과가 음수면 0 으로 클램프한다", () => {
    const scroller = document.createElement("div");
    scroller.style.overflowY = "scroll";
    const item = document.createElement("li");
    scroller.appendChild(item);
    document.body.appendChild(scroller);

    Object.defineProperty(scroller, "clientHeight", { value: 400 });
    Object.defineProperty(scroller, "scrollTop", { value: 0, writable: true });
    stubRect(scroller, { top: 0, height: 400 });
    stubRect(item, { top: 10, height: 40 });

    const scrollTo = vi.fn();
    scroller.scrollTo = scrollTo as unknown as typeof scroller.scrollTo;

    scrollItemIntoList(item);

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });
});
