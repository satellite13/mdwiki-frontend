import { describe, expect, it } from 'vitest'
import { isCaptureShortcut, isDailyNoteSlugForDate, localIsoDate, validIsoDate } from './pkm'

describe('PKM helpers', () => {
  it('accepts strict real ISO dates', () => {
    expect(validIsoDate('2026-02-28')).toBe(true)
    expect(validIsoDate('2026-02-30')).toBe(false)
    expect(validIsoDate('2026-2-8')).toBe(false)
  })

  it('formats a local date without UTC shifting', () => {
    expect(localIsoDate(new Date(2026, 0, 2, 23, 30))).toBe('2026-01-02')
  })

  it('detects daily note slugs for a specific date', () => {
    expect(isDailyNoteSlugForDate('daily-11111111-2222-3333-4444-555555555555-2026-09-06', '2026-09-06')).toBe(true)
    expect(isDailyNoteSlugForDate('daily-11111111-2222-3333-4444-555555555555-2026-09-05', '2026-09-06')).toBe(false)
    expect(isDailyNoteSlugForDate('regular-page', '2026-09-06')).toBe(false)
    expect(isDailyNoteSlugForDate('daily-2026-09-06', '2026-09-06')).toBe(false)
  })

  it('ignores capture shortcut inside editable targets', () => {
    const input = document.createElement('input')
    const editable = document.createElement('div')
    editable.contentEditable = 'true'
    const event = (target: EventTarget) => ({ key: 'N', shiftKey: true, metaKey: true, ctrlKey: false, target })

    expect(isCaptureShortcut(event(document.body) as KeyboardEvent)).toBe(true)
    expect(isCaptureShortcut(event(input) as KeyboardEvent)).toBe(false)
    expect(isCaptureShortcut(event(editable) as KeyboardEvent)).toBe(false)
  })
})
