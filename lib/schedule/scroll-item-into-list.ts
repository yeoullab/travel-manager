/** el 의 조상 중 가장 가까운 세로 스크롤 컨테이너 (overflow-y: auto|scroll). */
function findScrollParent(el: HTMLElement): HTMLElement | null {
  let cur = el.parentElement;
  while (cur) {
    const { overflowY } = getComputedStyle(cur);
    if (overflowY === "auto" || overflowY === "scroll") return cur;
    cur = cur.parentElement;
  }
  return null;
}

/**
 * 일정 카드를 리스트 스크롤 컨테이너 **안에서만** 세로 중앙으로 스크롤한다.
 * scrollIntoView 는 window 포함 모든 스크롤 조상을 움직여 지도·탭 영역까지
 * 밀어내므로, 마커 탭 포커스 이동은 반드시 이 함수를 쓴다.
 */
export function scrollItemIntoList(el: HTMLElement): void {
  const scroller = findScrollParent(el);
  if (!scroller) {
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  const elRect = el.getBoundingClientRect();
  const scRect = scroller.getBoundingClientRect();
  const centerOffset = (scroller.clientHeight - elRect.height) / 2;
  const top = scroller.scrollTop + (elRect.top - scRect.top) - centerOffset;
  scroller.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}
