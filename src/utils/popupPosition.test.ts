import { describe, expect, it } from 'vitest'
import { clampPopupPosition, POPUP_MARGIN } from './popupPosition'

describe('clampPopupPosition', () => {
  const width = 340
  const height = 200
  const viewportWidth = 1280
  const viewportHeight = 720

  it('keeps the position when the popup fits inside the viewport', () => {
    expect(clampPopupPosition(100, 100, width, height, viewportWidth, viewportHeight)).toEqual({
      left: 100,
      top: 100
    })
  })

  it('clamps near the right edge', () => {
    const pos = clampPopupPosition(1200, 100, width, height, viewportWidth, viewportHeight)
    expect(pos.left).toBe(viewportWidth - width - POPUP_MARGIN)
    expect(pos.top).toBe(100)
  })

  it('clamps near the bottom edge', () => {
    const pos = clampPopupPosition(100, 700, width, height, viewportWidth, viewportHeight)
    expect(pos.left).toBe(100)
    expect(pos.top).toBe(viewportHeight - height - POPUP_MARGIN)
  })

  it('clamps both edges when clicked in the bottom-right corner', () => {
    const pos = clampPopupPosition(1300, 800, width, height, viewportWidth, viewportHeight)
    expect(pos.left).toBe(viewportWidth - width - POPUP_MARGIN)
    expect(pos.top).toBe(viewportHeight - height - POPUP_MARGIN)
  })

  it('clamps negative coordinates to the margin', () => {
    expect(clampPopupPosition(-50, -10, width, height, viewportWidth, viewportHeight)).toEqual({
      left: POPUP_MARGIN,
      top: POPUP_MARGIN
    })
  })

  it('anchors at the margin when the popup is larger than the viewport', () => {
    expect(clampPopupPosition(0, 0, 2000, 2000, viewportWidth, viewportHeight)).toEqual({
      left: POPUP_MARGIN,
      top: POPUP_MARGIN
    })
  })

  it('respects a custom margin', () => {
    const pos = clampPopupPosition(1200, 700, width, height, viewportWidth, viewportHeight, 24)
    expect(pos.left).toBe(viewportWidth - width - 24)
    expect(pos.top).toBe(viewportHeight - height - 24)
  })
})
