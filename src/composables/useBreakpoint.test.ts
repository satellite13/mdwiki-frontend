import { afterEach, describe, expect, it } from 'vitest'
import { BP_READING_SHEET_MAX, useBreakpoint } from './useBreakpoint'

describe('useBreakpoint isReadingSheet', () => {
  afterEach(() => {
    window.dispatchEvent(new Event('resize'))
  })

  it('is true at and below BP_READING_SHEET_MAX', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: BP_READING_SHEET_MAX })
    window.dispatchEvent(new Event('resize'))
    const { isReadingSheet } = useBreakpoint()
    expect(isReadingSheet.value).toBe(true)
  })

  it('is false above BP_READING_SHEET_MAX', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: BP_READING_SHEET_MAX + 1 })
    window.dispatchEvent(new Event('resize'))
    const { isReadingSheet } = useBreakpoint()
    expect(isReadingSheet.value).toBe(false)
  })
})
