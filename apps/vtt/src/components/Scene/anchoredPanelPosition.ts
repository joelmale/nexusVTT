export interface ViewportRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface Size {
  width: number;
  height: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

export const DEFAULT_ANCHOR_GAP = 12;
export const VIEWPORT_MARGIN = 12;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), Math.max(minimum, maximum));

export function calculateAnchoredPanelPosition(
  anchor: ViewportRect,
  panel: Size,
  viewport: ViewportSize,
  gap = DEFAULT_ANCHOR_GAP,
  margin = VIEWPORT_MARGIN,
): { left: number; top: number } {
  const rightCandidate = anchor.right + gap;
  const leftCandidate = anchor.left - gap - panel.width;
  const fitsRight = rightCandidate + panel.width <= viewport.width - margin;
  const fitsLeft = leftCandidate >= margin;

  let left: number;
  if (fitsRight) {
    left = rightCandidate;
  } else if (fitsLeft) {
    left = leftCandidate;
  } else {
    const roomOnRight = viewport.width - anchor.right;
    const roomOnLeft = anchor.left;
    left = roomOnRight >= roomOnLeft ? rightCandidate : leftCandidate;
  }

  return {
    left: clamp(left, margin, viewport.width - panel.width - margin),
    top: clamp(anchor.top, margin, viewport.height - panel.height - margin),
  };
}
