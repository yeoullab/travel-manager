import type { MarkerSpec } from "../types";

/**
 * 지도 마커 DOM 단일 소스 (naver·google 공통).
 * - 배지: 카테고리색 채움(main) / 크림 바탕 + 점선(candidate). 색은 spec 인라인.
 * - 툴팁(일정명): 배지 위에 뜨는 말풍선.
 *   · 데스크톱((hover:hover)) → CSS `:hover` 로 노출/해제 (JS 불필요).
 *   · 모바일((hover:none))   → 탭 토글. 한 번 더 탭 또는 지도 다른 곳 탭 시 해제.
 */

const STYLE_ID = "tm-marker-styles";

/** 구조·툴팁 CSS 를 문서에 1회만 주입 (배지 색은 인라인이라 여기 없음). */
export function ensureMarkerStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = [
    ".tm-marker{position:relative}",
    ".tm-marker__tip{position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);" +
      "background:#26251e;color:#f2f1ed;font-size:11px;font-weight:500;line-height:1.3;" +
      "padding:3px 7px;border-radius:6px;white-space:nowrap;max-width:180px;overflow:hidden;" +
      "text-overflow:ellipsis;opacity:0;visibility:hidden;transition:opacity .12s ease;" +
      "pointer-events:none;box-shadow:0 2px 8px rgba(38,37,30,0.25);z-index:20}",
    "@media (hover:hover){.tm-marker:hover .tm-marker__tip{opacity:1;visibility:visible}}",
    ".tm-marker.tm-open .tm-marker__tip{opacity:1;visibility:visible}",
  ].join("\n");
  document.head.appendChild(style);
}

// 모바일 탭으로 열린 마커 추적 — 지도 클릭·다른 마커 탭 시 일괄 닫기.
const openMarkers = new Set<HTMLElement>();

export function closeAllMarkerTips(): void {
  openMarkers.forEach((el) => el.classList.remove("tm-open"));
  openMarkers.clear();
}

/** 한 번에 하나만 열림: 다른 팁은 닫고 이 마커만 토글. */
export function toggleMarkerTip(el: HTMLElement): void {
  const willOpen = !el.classList.contains("tm-open");
  closeAllMarkerTips();
  if (willOpen) {
    el.classList.add("tm-open");
    openMarkers.add(el);
  }
}

/** 호버가 없는(터치) 기기인가 — 모바일에서만 탭 토글을 켠다. */
export function isNoHoverDevice(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: none)").matches
  );
}

/**
 * 마커 탭 처리 (naver·google 공통).
 * - 모바일(호버 없음) + 일정명 있음 → 툴팁 토글 **그리고** `onClick` 실행.
 * - 데스크톱 → 툴팁은 CSS 호버가 담당하고 `onClick` 만 실행.
 * `onClick`(리스트 포커스 스크롤)은 리스트 컨테이너 안에서만 스크롤해야
 * 지도·탭 영역이 고정된다 — scroll-item-into-list 참고.
 * @param tipEl 툴팁을 토글할 `.tm-marker` 요소 (provider 별로 획득처가 다름)
 */
export function handleMarkerTap(tipEl: HTMLElement | null | undefined, spec: MarkerSpec): void {
  if (spec.title && isNoHoverDevice() && tipEl) toggleMarkerTip(tipEl);
  spec.onClick?.();
}

function badgeCss(spec: MarkerSpec): string {
  // 최소 22×22 (짧은 라벨 원형, 긴 라벨 알약형 — 후보탭 "1-1"/"P-1" 대응).
  const base =
    "min-width:22px;height:22px;padding:0 5px;box-sizing:border-box;border-radius:11px;" +
    "display:flex;align-items:center;justify-content:center;font-weight:600;font-size:11px;" +
    "white-space:nowrap;font-variant-numeric:tabular-nums;cursor:pointer;" +
    "box-shadow:0 2px 6px rgba(38,37,30,0.18)";
  if (spec.variant === "candidate") {
    return `background:#f2f1ed;color:${spec.color};border:2px dashed ${spec.color};${base}`;
  }
  return `background:${spec.color};color:${spec.textColor};border:2px solid #fff;${base}`;
}

/** 마커 배지 요소(라벨 + 선택적 툴팁)를 만든다. 클릭/토글 배선은 각 provider 가 담당. */
export function buildMarkerElement(spec: MarkerSpec): HTMLElement {
  ensureMarkerStyles();
  const el = document.createElement("div");
  el.className =
    "tm-marker " + (spec.variant === "candidate" ? "tm-marker--candidate" : "tm-marker--main");
  el.style.cssText = badgeCss(spec);

  const label = document.createElement("span");
  label.textContent = spec.label;
  el.appendChild(label);

  if (spec.title) {
    const tip = document.createElement("div");
    tip.className = "tm-marker__tip";
    tip.textContent = spec.title;
    el.appendChild(tip);
  }
  return el;
}
