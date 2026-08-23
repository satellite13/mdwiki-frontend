export const POPUP_MARGIN = 12

export interface ClampedPosition {
  left: number
  top: number
}

export function clampPopupPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
  margin: number = POPUP_MARGIN
): ClampedPosition {
  // Math.max(..., margin) keeps the popup anchored at the margin when it is
  // larger than the viewport; it scrolls internally instead of going negative.
  const maxLeft = Math.max(viewportWidth - width - margin, margin)
  const maxTop = Math.max(viewportHeight - height - margin, margin)
  return {
    left: Math.min(Math.max(x, margin), maxLeft),
    top: Math.min(Math.max(y, margin), maxTop)
  }
}
